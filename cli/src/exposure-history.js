// The history walk for E1: every line that a commit added, in every commit
// that HEAD reaches (or every ref, with --all-refs).
//
// A line is read once, at the commit that added it, so a key that sat in
// 500 later snapshots costs 1 scan, and a key in a file that was deleted
// later is still found. git streams the patches through spawn; the output
// is never buffered whole, because 10,000 commits of a large repository
// came to more than 1 GB. Lockfiles and vendored folders are excluded in
// the git command itself, so git never prints their diffs.
//
// The caller checks for a partial clone first: on a blobless clone, git
// fetches each missing blob from the remote to print its patch, and that
// is a network request (cli/src/git.js, partialCloneFilter).
import { spawn } from 'node:child_process';
import { scanText, inlineAllow } from './exposure-scan.js';
import { historyRenameArgs } from './git.js';
import { BINARY_RE } from './graph.js';

/* Paths that hold no hand-written secret and a large share of the patch
   text: lockfiles, vendored and installed dependencies, minified copies. */
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'Cargo.lock', 'go.sum', 'poetry.lock', 'Pipfile.lock', 'composer.lock', 'Gemfile.lock', 'uv.lock', 'packages.lock.json', 'gradle.lockfile', 'flake.lock'];
const VENDORED_DIRS = ['node_modules', 'vendor', 'third_party', 'third-party', 'bower_components', '.yarn', '.pnpm'];
const MINIFIED = ['*.min.js', '*.min.css'];

/** The pathspecs that keep those paths out of `git log -p`. */
export const EXCLUDE_PATHSPECS = [
  ...LOCKFILES.map((f) => `:(exclude,glob)**/${f}`),
  ...VENDORED_DIRS.map((d) => `:(exclude,glob)**/${d}/**`),
  ...MINIFIED.map((m) => `:(exclude,glob)**/${m}`),
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The same set as 1 expression, for the tree scan. */
export const SKIP_PATH_RE = new RegExp(`(^|/)(${LOCKFILES.map(esc).join('|')})$|(^|/)(${VENDORED_DIRS.map(esc).join('|')})/|\\.min\\.(js|css)$`);

/** The arguments of the streamed log, before the pathspecs. */
export function logArgs(root, { allRefs = false } = {}) {
  return [
    '-c', 'core.quotePath=false', '-c', 'log.showSignature=false',
    'log', '-p', '-U0', '--no-color', '--no-ext-diff', '--no-textconv',
    '--diff-filter=ACMR', '--format=%x00%H', ...historyRenameArgs(root),
    allRefs ? '--all' : 'HEAD',
    '--', '.', ...EXCLUDE_PATHSPECS,
  ];
}

/* A path that git printed in quotes: C escapes, with octal bytes for
   characters outside ASCII. */
function unquote(p) {
  if (!p.startsWith('"')) return p;
  const bytes = [];
  const s = p.slice(1, -1);
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { bytes.push(...Buffer.from(s[i])); continue; }
    const n = s[++i];
    if (/[0-7]/.test(n)) { bytes.push(parseInt(s.slice(i, i + 3), 8)); i += 2; continue; }
    bytes.push(({ n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 })[n] ?? n.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

const MAX_LINE = 4096;
const LINE_CAP = MAX_LINE + 2;
const MAX_FRAGMENT = 1024 * 1024;

/**
 * Walk the history. For each match on an added line, onAdd({ commit,
 * path, line, column, match, allow }); for each match on a removed line,
 * onRemove({ commit, path, match }). `match.value` is the secret: the
 * callbacks fingerprint it and drop it. Resolves to counts:
 * { commits, long_lines, large_fragments }.
 */
export function walkHistory(root, compiled, { allRefs = false, onAdd, onRemove } = {}) {
  return new Promise((resolve, reject) => {
    // GIT_NO_LAZY_FETCH (git 2.44 and later) refuses a lazy fetch even if
    // a partial clone slips past the caller's check.
    const child = spawn('git', logArgs(root, { allRefs }), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
    const stats = { commits: 0, long_lines: 0, large_fragments: 0 };
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { if (stderr.length < 4096) stderr += d; });

    let commit = null, path = null, header = false, oldLine = 0, newLine = 0;
    // Lines of the current file change. Past MAX_FRAGMENT the change is
    // counted and its lines are dropped as they arrive, so 1 large file
    // never sits in memory whole.
    let adds = [], dels = [], addSize = 0, delSize = 0;

    const keep = (text) => {
      if (text.length <= MAX_LINE) return text;
      stats.long_lines++;
      return '';
    };
    const scanFragment = (rows, kind) => {
      const texts = rows.map((r) => r.text);
      const text = texts.join('\n');
      for (const m of scanText(text, compiled)) {
        const i = m.line - 1;
        if (kind === 'del') { onRemove?.({ commit, path, match: m }); continue; }
        const prev = i > 0 && rows[i - 1].line === rows[i].line - 1 ? texts[i - 1] : null;
        onAdd?.({ commit, path, line: rows[i].line, column: m.column, match: m, allow: inlineAllow(m.rule.id, texts[i], prev) });
      }
    };
    const flush = () => {
      if (addSize > MAX_FRAGMENT) stats.large_fragments++;
      else if (path && adds.length) scanFragment(adds, 'add');
      if (delSize <= MAX_FRAGMENT && path && dels.length) scanFragment(dels, 'del');
      adds = [];
      dels = [];
      addSize = 0;
      delSize = 0;
    };

    const onLine = (line) => {
      if (line.charCodeAt(0) === 0) {
        flush();
        commit = line.slice(1).trim();
        stats.commits++;
        path = null;
        header = false;
        return;
      }
      if (line.startsWith('diff --git ')) {
        flush();
        path = null;
        header = true;
        return;
      }
      if (header) {
        if (line.startsWith('+++ ')) {
          const p = line.slice(4);
          path = p === '/dev/null' ? null : unquote(p).replace(/^b\//, '');
          // git prints a text diff for an image it cannot tell is binary.
          if (path && BINARY_RE.test(path)) path = null;
          return;
        }
        if (!line.startsWith('@@')) return;
        header = false;
      }
      if (line.startsWith('@@')) {
        const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (m) { oldLine = Number(m[1]); newLine = Number(m[2]); }
        return;
      }
      if (!path) return;
      const c = line[0];
      if (c === '+') {
        addSize += line.length;
        if (addSize <= MAX_FRAGMENT) adds.push({ line: newLine, text: keep(line.slice(1)) });
        newLine++;
      } else if (c === '-') {
        delSize += line.length;
        if (delSize <= MAX_FRAGMENT) dels.push({ line: oldLine, text: keep(line.slice(1)) });
        oldLine++;
      }
    };
    // Lines, split by hand: a minified bundle can be 1 line of 100 MB, and
    // a line reader would hold it whole. Past LINE_CAP characters the rest
    // of a line is dropped; keep() then counts it as a long line.
    child.stdout.setEncoding('utf8');
    let part = '';
    let over = false;
    child.stdout.on('data', (chunk) => {
      let start = 0;
      for (let nl = chunk.indexOf('\n'); nl !== -1; nl = chunk.indexOf('\n', start)) {
        const piece = chunk.slice(start, nl);
        const line = over ? part : part + piece;
        part = '';
        over = false;
        onLine(line.endsWith('\r') ? line.slice(0, -1) : line);
        start = nl + 1;
      }
      if (over) return;
      part += chunk.slice(start);
      if (part.length > LINE_CAP) { part = part.slice(0, LINE_CAP); over = true; }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (part) onLine(part);
      flush();
      if (code !== 0) reject(new Error(`git log failed: ${stderr.trim()}`));
      else resolve(stats);
    });
  });
}
