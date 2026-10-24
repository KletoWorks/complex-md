/* A small repository with a known history, and a one task dataset over it,
   for driving bench/run.mjs end to end with a scripted agent.

   History on main: three base commits, then the fix (the task), then two
   later commits. Every commit after the base carries MARKER in its message
   and in a file, so a test can grep for anything the agent was not meant to
   see. The future also sits on a tag, a second branch, a remote tracking
   ref, a stash and a note, and refs are packed, because each is a separate
   path to it. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

export const MARKER = 'CXFUTURE7d3e';
const ID = { GIT_AUTHOR_NAME: 'dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };

export function git(cwd, args, env = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ID, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root, files) {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
}

export function commit(root, msg, files, date) {
  write(root, files);
  git(root, ['add', '-A']);
  const env = { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  git(root, ['commit', '-q', '-m', msg], env);
  return git(root, ['rev-parse', 'HEAD']);
}

/** Builds the repository and the dataset. Returns { dir, repo, base, fix, datasetPath, task }. */
export function buildBenchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-bench-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  commit(repo, 'feat: add a', {
    'package.json': JSON.stringify({ name: 'fixture', scripts: { test: 'node --test test/*.test.js' } }, null, 2) + '\n',
    'lib/a.js': 'export const a = (x) => x + 1;\n',
    'lib/b.js': "import { a } from './a.js';\nexport const b = (x) => a(x) * 2;\n",
    'test/a.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from '../lib/a.js';\ntest('a', () => assert.equal(a(1), 2));\n",
  }, '2026-07-01T10:00:00Z');
  commit(repo, 'fix: b doubles', { 'lib/b.js': "import { a } from './a.js';\nexport const b = (x) => a(x) * 2; // doubles\n" }, '2026-07-02T10:00:00Z');
  const base = commit(repo, 'docs: readme', { 'README.md': '# fixture\n' }, '2026-07-03T10:00:00Z');
  const fix = commit(repo, `fix: a handles strings ${MARKER}`, {
    'lib/a.js': `export const a = (x) => Number(x) + 1; // ${MARKER}\n`,
    'test/fix.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from '../lib/a.js';\ntest('a string', () => assert.equal(a('1'), 2));\n",
  }, '2026-07-10T10:00:00Z');
  commit(repo, `chore: later work ${MARKER}`, { 'lib/c.js': `export const c = '${MARKER}';\n` }, '2026-07-20T10:00:00Z');
  // Other paths to the future: a tag, a branch, a remote tracking ref, a note, a stash.
  git(repo, ['tag', '-a', 'v9.9.9', '-m', `release ${MARKER}`]);
  git(repo, ['branch', 'next']);
  git(repo, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(repo, ['notes', 'add', '-m', `note ${MARKER}`, base]);
  writeFileSync(join(repo, 'lib', 'b.js'), `// stashed ${MARKER}\n`);
  git(repo, ['stash', 'push', '-q', '-m', `wip ${MARKER}`]);
  git(repo, ['pack-refs', '--all']);
  const task = { id: fix.slice(0, 10), repo: 'fixture/bench', base, fix, date: '2026-07-10', title: 'a() fails on numeric strings', text: 'Calling a with the string "1" returns "11" instead of 2. It should treat numeric strings as numbers.', source: 'commit', gold: ['lib/a.js'], tests: ['test/fix.test.js'], names_gold: false };
  const datasetPath = join(dir, 'dataset.json');
  // prepare: a generated input the suite needs, untracked in the worktree, as undici's test certificates are.
  writeFileSync(datasetPath, JSON.stringify({ repo: 'fixture/bench', path: repo, prepare: ['mkdir -p test/certs && echo key > test/certs/key.pem'], tasks: [task] }, null, 2) + '\n');
  return { dir, repo, base, fix, datasetPath, task };
}
