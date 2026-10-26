// `complex-md exposure`: E1, secrets in the tracked tree and in history.
//
// The scan is opt in and runs only in this command: generate, the hooks
// and check do not run it. It writes .complex-md/exposure-report.json,
// which git ignores, and on request a SARIF 2.1.0 file. No output holds a
// secret value: a finding carries its rule, path, line, commit, the
// value's length and entropy, and a fingerprint (exposure-scan.js).
//
// The engineer's file, .complex-md/exposure.json, is committed. It holds
// rule ids to disable, allows (each with a reason and an optional expiry
// date, compared with the commit date of HEAD so a commit gives the same
// result on any day), accepted findings under `baseline`, and own rules
// in the format of cli/rules/exposure.json. In CI, --config-ref reads it
// from the base branch, so a pull request cannot silence its own finding.
import { readFileSync, writeFileSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { shippedRules, compileRules, checkRuleFile, entropy } from './exposure-rules.js';
import { scanText, fingerprint, inlineAllow } from './exposure-scan.js';
import { walkHistory, SKIP_PATH_RE } from './exposure-history.js';
import { git, trackedFiles, readAt, commitSha, partialCloneFilter } from './git.js';
import { BINARY_RE, classify } from './graph.js';
import { ignoreWorkDir, keepExposureConfig, WORK_DIR } from './gitignore.js';
import { toSarif } from './sarif.js';

export const CONFIG_PATH = `${WORK_DIR}/exposure.json`;
export const REPORT_PATH = `${WORK_DIR}/exposure-report.json`;
export const SARIF_PATH = `${WORK_DIR}/exposure.sarif`;
const MAX_READ = 1024 * 1024;
const FIXTURE_RE = /(^|\/)(fixtures?|__fixtures__|testdata|test-data|__mocks__|mocks?)\//;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FP_RE = /^[0-9a-f]{16}$/;
const LOWER = { critical: 'high', high: 'medium', medium: 'low', low: 'low' };

/** A rule file or .complex-md/exposure.json that cannot be read as written. */
export class ExposureConfigError extends Error {}

/* A path glob: `**` crosses folders, `*` and `?` stay inside 1 name. A
   glob with no slash matches the name in any folder. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(glob.includes('/') ? `^${re}$` : `(^|/)${re}$`);
}

function checkConfig(cfg, where, ruleIds) {
  const errs = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return [`${where}: not a JSON object`];
  const known = new Set(['disable', 'allow', 'baseline', 'rules', 'placeholders', 'stopwords', 'format', 'version']);
  for (const k of Object.keys(cfg)) if (!known.has(k)) errs.push(`${where}: unknown key ${JSON.stringify(k)}`);
  if (cfg.disable !== undefined && (!Array.isArray(cfg.disable) || cfg.disable.some((d) => typeof d !== 'string'))) errs.push(`${where}: disable must be a list of rule ids`);
  for (const d of Array.isArray(cfg.disable) ? cfg.disable : []) if (typeof d === 'string' && !ruleIds.has(d)) errs.push(`${where}: disable names ${JSON.stringify(d)}, which is not a rule id`);
  if (cfg.allow !== undefined && !Array.isArray(cfg.allow)) errs.push(`${where}: allow must be a list`);
  for (const [i, a] of (Array.isArray(cfg.allow) ? cfg.allow : []).entries()) {
    const at = `${where}: allow[${i}]`;
    if (!a || typeof a !== 'object') { errs.push(`${at}: not an object`); continue; }
    if (a.rule === undefined && a.fingerprint === undefined) errs.push(`${at}: needs a rule or a fingerprint`);
    if (a.rule !== undefined && !ruleIds.has(a.rule)) errs.push(`${at}: rule ${JSON.stringify(a.rule)} is not a rule id`);
    if (a.fingerprint !== undefined && !(typeof a.fingerprint === 'string' && FP_RE.test(a.fingerprint))) errs.push(`${at}: fingerprint must be 16 hex characters from a report`);
    if (a.paths !== undefined && (!Array.isArray(a.paths) || a.paths.some((p) => typeof p !== 'string' || !p))) errs.push(`${at}: paths must be a list of globs`);
    if (typeof a.reason !== 'string' || !/[A-Za-z]/.test(a.reason)) errs.push(`${at}: reason is required`);
    if (a.expires !== undefined && !(typeof a.expires === 'string' && DATE_RE.test(a.expires))) errs.push(`${at}: expires must be a date, YYYY-MM-DD`);
  }
  if (cfg.baseline !== undefined && !Array.isArray(cfg.baseline)) errs.push(`${where}: baseline must be a list`);
  for (const [i, b] of (Array.isArray(cfg.baseline) ? cfg.baseline : []).entries()) {
    if (!b || typeof b.rule !== 'string' || !(typeof b.fingerprint === 'string' && FP_RE.test(b.fingerprint))) errs.push(`${where}: baseline[${i}] needs a rule and a 16 hex character fingerprint`);
  }
  return errs;
}

/**
 * Read .complex-md/exposure.json from the working tree, or from commit
 * `ref`. Throws ExposureConfigError when the file is there but cannot be
 * used: a broken file is never read as "no configuration".
 */
export function loadConfig(root, { ref = null } = {}) {
  const where = ref ? `${ref}:${CONFIG_PATH}` : CONFIG_PATH;
  const p = join(root, CONFIG_PATH);
  const text = ref ? readAt(root, ref, CONFIG_PATH) : existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (text === null) return { config: {}, source: null };
  let cfg;
  try { cfg = JSON.parse(text); } catch (e) { throw new ExposureConfigError(`complex-md: ${where} is not readable JSON (${e.message}); refusing to scan as if it held no allows or baseline.`); }
  const shipped = shippedRules();
  const own = Array.isArray(cfg?.rules) ? cfg.rules : [];
  const errs = own.length ? checkRuleFile({ rules: own }, where) : [];
  const shippedIds = new Set(shipped.rules.map((r) => r.id));
  for (const r of own) if (shippedIds.has(r?.id)) errs.push(`${where}: rule ${r.id} has the id of a shipped rule; give it its own id`);
  errs.push(...checkConfig(cfg, where, new Set([...shippedIds, ...own.map((r) => r?.id)])));
  if (errs.length) throw new ExposureConfigError(`complex-md: ${where} has ${errs.length} problem${errs.length === 1 ? '' : 's'}:\n  ${errs.join('\n  ')}`);
  return { config: cfg, source: where };
}

function headDate(root) {
  return git(['log', '-1', '--format=%cs', 'HEAD'], { cwd: root, allowFail: true }).trim() || null;
}

/* Which allow from the configuration applies to finding f, if any.
   Returns { allow, expired } so an expired allow can be counted. */
function configAllow(f, allows, today) {
  let expired = null;
  for (const a of allows) {
    if (a.fingerprint && a.fingerprint !== f.fingerprint) continue;
    if (a.rule && a.rule !== f.rule) continue;
    if (a.paths && !a.paths.some((g) => globToRegExp(g).test(f.path))) continue;
    if (a.expires && today && a.expires < today) { expired ||= a; continue; }
    return { allow: a };
  }
  return { allow: null, expired };
}

function isTestPath(path) {
  return FIXTURE_RE.test(path) || classify(path) === 'test';
}

function ruleFields(rule) {
  return { rule: rule.id, slice: rule.slice, established: rule.established, confidence: rule.confidence, cwe: rule.cwe };
}

/* The tree scan: every tracked text file, read from the working tree. */
function scanTree(root, compiled, skipped) {
  const out = [];
  for (const path of trackedFiles(root)) {
    if (BINARY_RE.test(path)) { skipped.binary++; continue; }
    if (SKIP_PATH_RE.test(path)) { skipped.lockfile_or_vendored++; continue; }
    let st;
    try { st = lstatSync(join(root, path)); } catch { skipped.missing++; continue; }
    if (st.isSymbolicLink()) { skipped.symlink++; continue; }
    if (!st.isFile()) continue;
    if (st.size > MAX_READ) { skipped.over_1mb++; continue; }
    const text = readFileSync(join(root, path), 'utf8');
    skipped.read++;
    const matches = scanText(text, compiled);
    if (!matches.length) continue;
    const lines = text.split('\n');
    for (const m of matches) {
      out.push({
        where: 'tree', path, line: m.line, column: m.column, ruleRef: m.rule,
        fingerprint: fingerprint(m.rule.id, m.value),
        evidence: { length: m.value.length, entropy: Math.round(entropy(m.value) * 10) / 10 },
        inline: inlineAllow(m.rule.id, lines[m.line - 1], m.line > 1 ? lines[m.line - 2] : null),
      });
    }
  }
  return out;
}

/* The history walk: every add and every removal of a secret, by commit.
   runExposure folds them into findings. A secret that a tracked file
   still holds is a tree finding with `added_in`; a secret that left a path
   is a history finding there, with `added_in` and `removed_in`. */
async function scanHistory(root, compiled, { allRefs }) {
  const adds = []; // newest commit first, the order git prints
  const removals = new Map(); // fingerprint \0 path -> [index in stream]
  let n = 0;
  const stats = await walkHistory(root, compiled, {
    allRefs,
    onAdd: ({ commit, path, line, column, match, allow }) => {
      adds.push({ i: n++, commit, path, line, column, ruleRef: match.rule, fingerprint: fingerprint(match.rule.id, match.value), evidence: { length: match.value.length, entropy: Math.round(entropy(match.value) * 10) / 10 }, inline: allow });
    },
    onRemove: ({ commit, path, match }) => {
      const k = `${fingerprint(match.rule.id, match.value)}\0${path}`;
      if (!removals.has(k)) removals.set(k, []);
      removals.get(k).push({ i: n++, commit });
    },
  });
  return { adds, removals, stats };
}

/**
 * Run the E1 scan. Resolves to the report object that
 * .complex-md/exposure-report.json holds. Throws ExposureConfigError for
 * an unusable configuration.
 */
export async function runExposure(root, { configRef = null, history = true, allRefs = false, version = '0.0.0' } = {}) {
  const shipped = shippedRules();
  const { config, source } = loadConfig(root, { ref: configRef });
  const disabled = [...new Set(config.disable || [])].sort();
  const defs = [...shipped.rules, ...(config.rules || [])];
  const compiled = compileRules(defs, { disable: disabled, placeholders: [...shipped.placeholders, ...(config.placeholders || [])], stopwords: [...shipped.stopwords, ...(config.stopwords || [])] });
  const today = headDate(root);
  const blind = [];

  const skipped = { read: 0, binary: 0, lockfile_or_vendored: 0, over_1mb: 0, symlink: 0, missing: 0 };
  const tree = scanTree(root, compiled, skipped);
  if (skipped.over_1mb) blind.push(`${skipped.over_1mb} tracked file${skipped.over_1mb === 1 ? '' : 's'} over 1 MB not scanned`);
  if (skipped.symlink) blind.push(`${skipped.symlink} symbolic link${skipped.symlink === 1 ? '' : 's'} not followed`);

  const hist = { mode: history ? (allRefs ? 'all-refs' : 'head') : 'off', commits: 0, shallow: false };
  let found = [...tree];
  if (history) {
    const filter = partialCloneFilter(root);
    if (filter) {
      hist.mode = 'skipped';
      blind.push(`history not scanned: this is a partial clone (filter ${filter}), and reading old patches would fetch each missing blob from the remote; scan a full clone for history`);
    } else {
      const { adds, removals, stats } = await scanHistory(root, compiled, { allRefs });
      hist.commits = stats.commits;
      hist.shallow = git(['rev-parse', '--is-shallow-repository'], { cwd: root, allowFail: true }).trim() === 'true';
      if (hist.shallow) blind.push(`shallow clone: the history scan covers the ${stats.commits} commits present`);
      const merges = Number(git(['rev-list', '--merges', '--count', allRefs ? '--all' : 'HEAD'], { cwd: root, allowFail: true }).trim()) || 0;
      if (merges) blind.push(`${merges} merge commit${merges === 1 ? '' : 's'}: a line that only a merge resolution added is not scanned`);
      if (stats.long_lines) blind.push(`${stats.long_lines} added or removed line${stats.long_lines === 1 ? '' : 's'} over 4,096 characters not scanned`);
      if (stats.large_fragments) blind.push(`${stats.large_fragments} file change${stats.large_fragments === 1 ? '' : 's'} over 1 MB of added lines not scanned`);
      // The oldest commit that added each secret: the last one git printed.
      const firstAdd = new Map();
      for (const a of adds) firstAdd.set(a.fingerprint, a.commit);
      for (const t of tree) t.added_in = firstAdd.get(t.fingerprint) || null;
      // A secret that left a path is a history finding there, even when the
      // tree still holds it at another path: the old path is still in every
      // clone of the history.
      const inTree = new Set(tree.map((t) => `${t.fingerprint}\0${t.path}`));
      const tracked = new Set(trackedFiles(root));
      const byKey = new Map();
      for (const a of adds) {
        const k = `${a.fingerprint}\0${a.path}`;
        if (!inTree.has(k)) byKey.set(k, a);
      }
      for (const [k, a] of byKey) {
        // The removal closest after the add: the oldest one git printed before it.
        const rem = (removals.get(k) || []).filter((r) => r.i < a.i).sort((x, y) => y.i - x.i)[0];
        let removed = rem?.commit || null;
        if (!removed && !tracked.has(a.path)) {
          removed = git(['log', '-1', '--format=%H', '--diff-filter=D', allRefs ? '--all' : 'HEAD', '--', a.path], { cwd: root, allowFail: true }).trim() || null;
        }
        found.push({ where: 'history', path: a.path, line: a.line, column: a.column, ruleRef: a.ruleRef, fingerprint: a.fingerprint, evidence: a.evidence, inline: a.inline, added_in: a.commit, removed_in: removed });
      }
    }
  }

  const allows = config.allow || [];
  const baseline = new Set((config.baseline || []).map((b) => `${b.rule}\0${b.fingerprint}`));
  let expiredAllows = 0, inlineAllows = 0;
  const findings = found.map((f) => {
    const rule = f.ruleRef;
    const test = isTestPath(f.path);
    const out = {
      fingerprint: f.fingerprint,
      ...ruleFields(rule),
      severity: test ? LOWER[rule.severity] : rule.severity,
      where: f.where,
      path: f.path,
      line: f.line,
      column: f.column,
      test_path: test,
      added_in: f.added_in ?? null,
      ...(f.where === 'history' ? { removed_in: f.removed_in } : {}),
      status: 'new',
      evidence: f.evidence,
    };
    if (f.inline) {
      inlineAllows++;
      return { ...out, status: 'allowed', allow: { kind: 'inline', reason: f.inline.reason } };
    }
    const { allow, expired } = configAllow(out, allows, today);
    if (allow) return { ...out, status: 'allowed', allow: { kind: 'config', reason: allow.reason, ...(allow.expires ? { expires: allow.expires } : {}) } };
    if (expired) expiredAllows++;
    if (baseline.has(`${out.rule}\0${out.fingerprint}`)) return { ...out, status: 'baselined' };
    return out;
  });
  if (expiredAllows) blind.push(`${expiredAllows} finding${expiredAllows === 1 ? '' : 's'} matched an allow that expired before ${today}, the commit date of HEAD`);
  const order = { tree: 0, history: 1 };
  findings.sort((a, b) => order[a.where] - order[b.where] || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.line - b.line || a.column - b.column || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));

  const counts = { new: 0, baselined: 0, allowed: 0, tree: 0, history: 0, by_rule: {} };
  for (const f of findings) {
    counts[f.status]++;
    counts[f.where]++;
    counts.by_rule[f.rule] = (counts.by_rule[f.rule] || 0) + 1;
  }
  counts.by_rule = Object.fromEntries(Object.entries(counts.by_rule).sort(([a], [b]) => (a < b ? -1 : 1)));

  return {
    format: 'complex-md/exposure-report',
    version: 1,
    generator: `complex-md/${version}`,
    commit: commitSha(root, 'HEAD'),
    head_date: today,
    rules_version: shipped.hash,
    slices: ['E1'],
    config: { source, disabled, own_rules: (config.rules || []).length, allows: allows.length, inline_allows: inlineAllows, expired_allows: expiredAllows, baseline: baseline.size },
    rules: compiled.rules.map((r) => ({ id: r.id, slice: r.slice, title: r.title, established: r.established, severity: r.severity, confidence: r.confidence, cwe: r.cwe, directive: r.directive })),
    scope: { files: { read: skipped.read, binary: skipped.binary, lockfile_or_vendored: skipped.lockfile_or_vendored, over_1mb: skipped.over_1mb, symlink: skipped.symlink }, history: hist },
    counts,
    findings,
    blind_spots: blind,
  };
}

/**
 * Accept every finding that is not allowed: write it to `baseline` in
 * .complex-md/exposure.json, keeping each reason already there and every
 * other key. Returns the report with those findings marked baselined, and
 * how many entries were added.
 */
export function writeBaseline(root, report) {
  const p = join(root, CONFIG_PATH);
  const cfg = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  const old = new Map((cfg.baseline || []).map((b) => [`${b.rule}\0${b.fingerprint}`, b]));
  const next = new Map(old);
  for (const f of report.findings) {
    if (f.status === 'allowed') continue;
    const k = `${f.rule}\0${f.fingerprint}`;
    if (!next.has(k)) next.set(k, { rule: f.rule, fingerprint: f.fingerprint, reason: 'accepted by complex-md exposure --baseline' });
  }
  cfg.baseline = [...next.values()].sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : a.fingerprint < b.fingerprint ? -1 : 1));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  const findings = report.findings.map((f) => (f.status === 'new' ? { ...f, status: 'baselined' } : f));
  const moved = report.counts.new;
  return {
    added: next.size - old.size,
    report: { ...report, config: { ...report.config, baseline: next.size }, counts: { ...report.counts, new: 0, baselined: report.counts.baselined + moved }, findings },
  };
}

/**
 * Write the report, and the SARIF file when `sarif` names a path. Keeps
 * the report out of git: the working directory entry goes into
 * .gitignore, and an entry that is already there gets the keep line for
 * .complex-md/exposure.json once. Returns the paths written.
 */
export function writeExposure(root, report, { sarif = null, log = () => {} } = {}) {
  if (ignoreWorkDir(root)) log(`added ${WORK_DIR}/* to .gitignore, so its working files stay out of commits; ${CONFIG_PATH} stays committable.`);
  const kept = keepExposureConfig(root);
  if (kept === 'added') log(`added !${CONFIG_PATH} to .gitignore, so the allows and the baseline can be committed.`);
  else if (kept === 'blocked') log(`.gitignore ignores the whole ${WORK_DIR} folder, so ${CONFIG_PATH} cannot be committed; change that entry to ${WORK_DIR}/* to keep it.`);
  mkdirSync(join(root, WORK_DIR), { recursive: true });
  writeFileSync(join(root, REPORT_PATH), JSON.stringify(report, null, 2) + '\n');
  const written = [REPORT_PATH];
  if (sarif) {
    const out = resolve(root, sarif);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(toSarif(report), null, 2) + '\n');
    written.push(sarif);
  }
  return written;
}

const MAX_ROWS = 40;

/** The terminal summary. It names rules, paths, lines and commits, never a value. */
export function formatExposure(report) {
  const c = report.counts;
  const s = report.scope;
  const h = s.history;
  const lines = [];
  lines.push(`complex-md exposure: E1 secrets, ${report.rules.length} rules${report.config.disabled.length ? ` (${report.config.disabled.length} disabled)` : ''}`);
  lines.push(`tree: ${s.files.read} tracked files read; skipped ${s.files.lockfile_or_vendored} lockfile or vendored, ${s.files.binary} binary, ${s.files.over_1mb} over 1 MB`);
  lines.push(`history: ${h.mode === 'off' ? 'not scanned (--no-history)' : h.mode === 'skipped' ? 'not scanned (partial clone)' : `${h.commits} commits from ${h.mode === 'all-refs' ? 'every ref' : 'HEAD'}`}`);
  lines.push(`findings: ${c.new} new, ${c.baselined} baselined, ${c.allowed} allowed`);
  const shown = report.findings.filter((f) => f.status === 'new').slice(0, MAX_ROWS);
  for (const f of shown) {
    const tail = [f.test_path ? 'test path' : null, f.where === 'history' ? `history: added ${f.added_in?.slice(0, 7)}${f.removed_in ? `, removed ${f.removed_in.slice(0, 7)}` : ''}` : null].filter(Boolean);
    lines.push(`  ${f.severity.padEnd(8)}  ${f.rule.padEnd(22)}  ${f.established.padEnd(10)}  ${f.path}:${f.line}${tail.length ? `  (${tail.join('; ')})` : ''}`);
  }
  if (c.new > shown.length) lines.push(`  ... ${c.new - shown.length} more in ${REPORT_PATH}`);
  if (c.new) lines.push('Rotate a real credential with its issuer first: a commit that deletes it from the file does not remove it from the history.');
  lines.push(`report: ${REPORT_PATH}`);
  for (const b of report.blind_spots) lines.push(`note: ${b}`);
  return lines.join('\n');
}
