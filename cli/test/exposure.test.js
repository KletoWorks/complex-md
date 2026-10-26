// `complex-md exposure`: secrets in the tracked tree and in history, the
// engineer's allows and baseline, the report and SARIF files, exit codes,
// and the .gitignore keep line. Every key is a fake built from fragments
// (fixtures/fake-secrets.mjs), and every test checks that no output file
// and no printed line holds one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { runExposure } from '../src/exposure.js';
import { FAKE, ALL_FAKES } from './fixtures/fake-secrets.mjs';

const BIN = join(import.meta.dirname, '..', 'bin', 'complex-md.js');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x', GIT_AUTHOR_DATE: '2026-03-01T12:00:00Z', GIT_COMMITTER_DATE: '2026-03-01T12:00:00Z' };
const AWS = FAKE['aws-access-key'][0];
const GH = FAKE['github-token'][0];
const STRIPE = FAKE['stripe-key'][0];
const JWT = FAKE.jwt[0];

const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-exposure-'));
  git(dir, 'init', '-q');
  return dir;
}

/** Write `files` (a null value deletes the file), commit, and return the sha. */
function commit(dir, files, msg = 'change') {
  for (const [p, text] of Object.entries(files)) {
    if (text === null) { rmSync(join(dir, p)); continue; }
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', msg);
  return git(dir, 'rev-parse', 'HEAD');
}

const run = (dir, ...args) => spawnSync(process.execPath, [BIN, 'exposure', ...args], { cwd: dir, env: ENV, encoding: 'utf8' });

function assertNoValue(text, where) {
  for (const v of ALL_FAKES) assert.ok(!text.includes(v), `${where} holds the value ${v.slice(0, 6)}...`);
}

test('a key in the tree, a key that history holds, and the commits that added and removed it', async () => {
  const dir = repo();
  const c1 = commit(dir, { 'src/a.js': `export const id = '${AWS}';\n` }, 'add a');
  const c2 = commit(dir, { 'src/a.js': 'export const id = process.env.AWS_ID;\n' }, 'fix: read the key from the environment');
  const c3 = commit(dir, { 'src/b.js': `const t = '${GH}';\n` }, 'add b');
  const r = await runExposure(dir, { version: 'test' });
  assert.equal(r.scope.history.mode, 'head');
  assert.equal(r.scope.history.commits, 3);
  const tree = r.findings.filter((f) => f.where === 'tree');
  const hist = r.findings.filter((f) => f.where === 'history');
  assert.deepEqual(tree.map((f) => [f.rule, f.path, f.line, f.added_in]), [['github-token', 'src/b.js', 1, c3]]);
  assert.deepEqual(hist.map((f) => [f.rule, f.path, f.line, f.added_in, f.removed_in]), [['aws-access-key', 'src/a.js', 1, c1, c2]]);
  for (const f of r.findings) {
    assert.match(f.fingerprint, /^[0-9a-f]{16}$/);
    assert.equal(f.status, 'new');
    assert.equal(f.established, 'exact');
  }
  assert.deepEqual(r.counts, { new: 2, baselined: 0, allowed: 0, tree: 1, history: 1, by_rule: { 'aws-access-key': 1, 'github-token': 1 } });

  const out = run(dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /findings: 2 new, 0 baselined, 0 allowed/);
  assert.match(out.stdout, /aws-access-key .*src\/a\.js:1 {2}\(history: added [0-9a-f]{7}, removed [0-9a-f]{7}\)/);
  assertNoValue(out.stdout + out.stderr, 'the terminal output');
  assertNoValue(readFileSync(join(dir, '.complex-md/exposure-report.json'), 'utf8'), 'the report');
  assert.equal(run(dir, '--strict').status, 1, '--strict exits 1 on a new finding');
});

test('a secret in a deleted file is removed by the commit that deleted the file', async () => {
  const dir = repo();
  const c1 = commit(dir, { 'deploy/key.txt': `token=${GH}\n`, 'README.md': 'x\n' });
  const c2 = commit(dir, { 'deploy/key.txt': null }, 'remove the key file');
  const r = await runExposure(dir, { version: 'test' });
  assert.deepEqual(r.findings.map((f) => [f.where, f.path, f.added_in, f.removed_in]), [['history', 'deploy/key.txt', c1, c2]]);
});

test('a secret that moved to another file is in the tree there and in history at the old path', async () => {
  const dir = repo();
  const c1 = commit(dir, { 'auth/constants.go': `const k = "${GH}"\n` });
  const c2 = commit(dir, { 'auth/constants.go': 'const k = ""\n', 'etc/config.json': `{"k": "${GH}"}\n` }, 'move the key to config');
  const r = await runExposure(dir, { version: 'test' });
  assert.deepEqual(r.findings.map((f) => [f.where, f.path, f.added_in, f.removed_in ?? null]), [['tree', 'etc/config.json', c1, null], ['history', 'auth/constants.go', c1, c2]]);
  assert.equal(r.findings[0].fingerprint, r.findings[1].fingerprint, 'one key, one fingerprint');
});

test('two runs on one commit write the same bytes', () => {
  const dir = repo();
  commit(dir, { 'a.js': `const a = '${AWS}';\nconst b = '${GH}';\n` });
  assert.equal(run(dir, '--sarif').status, 0);
  const report = readFileSync(join(dir, '.complex-md/exposure-report.json'), 'utf8');
  const sarif = readFileSync(join(dir, '.complex-md/exposure.sarif'), 'utf8');
  assert.equal(run(dir, '--sarif').status, 0);
  assert.equal(readFileSync(join(dir, '.complex-md/exposure-report.json'), 'utf8'), report);
  assert.equal(readFileSync(join(dir, '.complex-md/exposure.sarif'), 'utf8'), sarif);
  assert.doesNotMatch(report, /\d{4}-\d{2}-\d{2}T\d{2}:/, 'no clock in the report');
});

test('allows: an inline comment, a path allow, an expired allow, and a disabled rule', async () => {
  const dir = repo();
  const config = {
    disable: ['jwt'],
    allow: [
      { rule: 'github-token', paths: ['test/**'], reason: 'fixture for the client tests' },
      { rule: 'stripe-key', reason: 'old demo key', expires: '2026-01-31' },
    ],
  };
  commit(dir, {
    '.complex-md/exposure.json': JSON.stringify(config),
    'test/fx.js': `export const t = '${GH}';\n`,
    'src/pay.js': `const k = '${STRIPE}';\n`,
    'src/jwt.js': `const j = '${JWT}';\n`,
    'src/aws.js': `// complex-md: allow aws-access-key revoked on 2026-02-01, kept for the parser test\nconst a = '${AWS}';\n`,
    'src/aws2.js': `const a = '${AWS}'; // complex-md: allow aws-access-key\n`,
  });
  const r = await runExposure(dir, { history: false, version: 'test' });
  const by = Object.fromEntries(r.findings.map((f) => [f.path, f]));
  assert.equal(by['src/jwt.js'], undefined, 'a disabled rule does not run');
  assert.deepEqual(by['test/fx.js'].allow, { kind: 'config', reason: 'fixture for the client tests' });
  assert.equal(by['src/aws.js'].status, 'allowed');
  assert.deepEqual(by['src/aws.js'].allow, { kind: 'inline', reason: 'revoked on 2026-02-01, kept for the parser test' });
  assert.equal(by['src/aws2.js'].status, 'new', 'an allow comment without a reason allows nothing');
  assert.equal(by['src/pay.js'].status, 'new', 'the allow expired before the commit date of HEAD');
  assert.equal(r.head_date, '2026-03-01');
  assert.ok(r.blind_spots.some((b) => /1 finding matched an allow that expired before 2026-03-01/.test(b)), JSON.stringify(r.blind_spots));
  assert.deepEqual(r.config.disabled, ['jwt']);
  assert.equal(r.config.inline_allows, 1);
});

test('--baseline accepts the findings; --strict then passes until a new key arrives', () => {
  const dir = repo();
  commit(dir, { 'a.js': `const a = '${AWS}';\n` });
  const b = run(dir, '--baseline');
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stderr, /baseline: 1 finding added to \.complex-md\/exposure\.json/);
  const cfg = JSON.parse(readFileSync(join(dir, '.complex-md/exposure.json'), 'utf8'));
  assert.deepEqual(Object.keys(cfg.baseline[0]), ['rule', 'fingerprint', 'reason']);
  assertNoValue(JSON.stringify(cfg), 'the baseline');
  const s = run(dir, '--strict');
  assert.equal(s.status, 0, s.stdout);
  assert.match(s.stdout, /0 new, 1 baselined/);
  // The same key in another file keeps its baseline entry: the fingerprint has no path.
  writeFileSync(join(dir, 'b.js'), `const b = '${AWS}';\n`);
  git(dir, 'add', 'b.js');
  assert.equal(run(dir, '--strict', '--no-history').status, 0);
  writeFileSync(join(dir, 'c.js'), `const c = '${GH}';\n`);
  git(dir, 'add', 'c.js');
  assert.equal(run(dir, '--strict', '--no-history').status, 1);
});

test('a broken .complex-md/exposure.json exits 2 and is never read as empty', () => {
  const cases = [
    ['{ not json', /not readable JSON/],
    [JSON.stringify({ allow: [{ rule: 'aws-access-key' }] }), /allow\[0\]: reason is required/],
    [JSON.stringify({ disable: ['no-such-rule'] }), /not a rule id/],
    [JSON.stringify({ rules: [{ id: 'own', slice: 'E1', title: 'Own', established: 'exact', severity: 'high', confidence: 'high', cwe: 'CWE-798', directive: 'Rotate it.', match: { type: 'content', keywords: ['own_'], regex: '(own_.*)' } }] }), /no upper bound/],
    [JSON.stringify({ allow: [{ rule: 'aws-access-key', reason: 'x y', expires: 'next week' }] }), /expires must be a date/],
  ];
  for (const [text, why] of cases) {
    const dir = repo();
    commit(dir, { 'a.js': 'x\n', '.complex-md/exposure.json': text });
    const r = run(dir);
    assert.equal(r.status, 2, text);
    assert.match(r.stderr, why, text);
  }
});

test('an own rule in .complex-md/exposure.json runs beside the shipped rules', async () => {
  const dir = repo();
  const own = { id: 'acme-token', slice: 'E1', title: 'Acme deploy token', established: 'exact', severity: 'high', confidence: 'high', cwe: 'CWE-798', directive: 'Rotate it in the Acme console.', match: { type: 'content', keywords: ['acme_'], regex: '\\b(acme_[a-z0-9]{20})\\b' } };
  commit(dir, { '.complex-md/exposure.json': JSON.stringify({ rules: [own] }), 'deploy.sh': `TOKEN=${['acme', '_', 'fake0123456789fake01'].join('')}\n` });
  const r = await runExposure(dir, { history: false, version: 'test' });
  assert.deepEqual(r.findings.map((f) => f.rule), ['acme-token']);
  assert.equal(r.config.own_rules, 1);
});

test('--config-ref reads the allows from a commit, so a change cannot silence itself', () => {
  const dir = repo();
  commit(dir, { '.complex-md/exposure.json': '{}\n', 'a.js': `const a = '${GH}';\n` });
  writeFileSync(join(dir, '.complex-md/exposure.json'), JSON.stringify({ disable: ['github-token'] }));
  assert.match(run(dir).stdout, /0 new/, 'the working tree file disables the rule');
  const r = run(dir, '--config-ref', 'HEAD', '--no-history');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 new/, 'the committed file does not');
  assert.equal(run(dir, '--config-ref', 'no-such-ref').status, 2);
  assert.equal(run(dir, '--config-ref', 'HEAD', '--baseline').status, 2);
});

test('SARIF 2.1.0: tree findings with fingerprints, allows as suppressions, no values', () => {
  const dir = repo();
  commit(dir, { 'old.js': `const o = '${STRIPE}';\n` });
  commit(dir, { 'old.js': null, 'a.js': `const a = '${AWS}';\n// complex-md: allow github-token sample for the docs\nconst g = '${GH}';\n` });
  const out = run(dir, '--sarif', 'out/scan.sarif');
  assert.equal(out.status, 0, out.stderr);
  const text = readFileSync(join(dir, 'out/scan.sarif'), 'utf8');
  assertNoValue(text, 'the SARIF file');
  const s = JSON.parse(text);
  assert.equal(s.version, '2.1.0');
  const run0 = s.runs[0];
  assert.equal(run0.tool.driver.name, 'complex-md');
  assert.equal(run0.tool.driver.rules.length, 54);
  assert.deepEqual(run0.results.map((r) => [r.ruleId, r.locations[0].physicalLocation.artifactLocation.uri, r.locations[0].physicalLocation.region.startLine]), [['aws-access-key', 'a.js', 1], ['github-token', 'a.js', 3]]);
  for (const r of run0.results) {
    assert.match(r.partialFingerprints['complexMd/v1'], /^[0-9a-f]{16}:1$/);
    assert.match(r.partialFingerprints.primaryLocationLineHash, /^[0-9a-f]{16}:1$/);
    assert.equal(run0.tool.driver.rules[r.ruleIndex].id, r.ruleId);
  }
  assert.deepEqual(run0.results[1].suppressions, [{ kind: 'inSource', status: 'accepted', justification: 'sample for the docs' }]);
  assert.equal(run0.properties.historyOnlyFindings, 1, 'the deleted stripe key stays out of the results');
  const rule = run0.tool.driver.rules.find((r) => r.id === 'aws-access-key');
  assert.equal(rule.properties['security-severity'], '9.5');
  assert.deepEqual(rule.properties.tags, ['security', 'external/cwe/cwe-798', 'complex-md/E1']);
});

test('a finding in a test path is labelled and 1 severity step lower', async () => {
  const dir = repo();
  commit(dir, { 'src/a.test.js': `const a = '${AWS}';\n`, 'test/fixtures/k.txt': `${AWS}\n`, 'src/a.js': `const a = '${AWS}';\n` });
  const r = await runExposure(dir, { history: false, version: 'test' });
  assert.deepEqual(r.findings.map((f) => [f.path, f.test_path, f.severity]), [['src/a.js', false, 'critical'], ['src/a.test.js', true, 'high'], ['test/fixtures/k.txt', true, 'high']]);
});

test('history reads HEAD by default; --all-refs adds every branch; --no-history skips it', async () => {
  const dir = repo();
  commit(dir, { 'a.js': 'x\n' });
  const main = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'side');
  commit(dir, { 'b.js': `const b = '${GH}';\n` });
  git(dir, 'checkout', '-q', main);
  assert.equal((await runExposure(dir, { version: 'test' })).findings.length, 0);
  const all = await runExposure(dir, { allRefs: true, version: 'test' });
  assert.equal(all.scope.history.mode, 'all-refs');
  assert.deepEqual(all.findings.map((f) => [f.where, f.path]), [['history', 'b.js']]);
  const off = await runExposure(dir, { history: false, version: 'test' });
  assert.equal(off.scope.history.mode, 'off');
});

test('lockfiles, vendored folders and binary files are skipped, in the tree and in history', async () => {
  const dir = repo();
  commit(dir, { 'package-lock.json': `{"k": "${GH}"}\n`, 'vendor/lib.js': `x = '${GH}'\n`, 'node_modules/m/i.js': `x = '${GH}'\n`, 'logo.png': `${GH}\n`, 'app.min.js': `x='${GH}'\n` });
  const r = await runExposure(dir, { version: 'test' });
  assert.deepEqual(r.findings, []);
  assert.equal(r.scope.files.lockfile_or_vendored, 4);
  assert.equal(r.scope.files.binary, 1);
});

test('.gitignore: a new entry keeps exposure.json; an old entry gets the keep line once', () => {
  const fresh = repo();
  commit(fresh, { 'a.js': 'x\n' });
  run(fresh);
  writeFileSync(join(fresh, '.complex-md/exposure.json'), '{}\n');
  const st = git(fresh, 'status', '--porcelain', '--untracked-files=all');
  assert.match(st, /\.complex-md\/exposure\.json/, 'exposure.json can be committed');
  assert.doesNotMatch(st, /exposure-report\.json/, 'the report stays out of commits');

  const old = repo();
  commit(old, { '.gitignore': 'node_modules/\n.complex-md/*\n!.complex-md/bounds.json\n', 'a.js': 'x\n' });
  const r1 = run(old);
  assert.match(r1.stderr, /added !\.complex-md\/exposure\.json to \.gitignore/);
  const once = readFileSync(join(old, '.gitignore'), 'utf8');
  assert.equal(once.match(/^!\.complex-md\/exposure\.json$/gm).length, 1);
  run(old);
  assert.equal(readFileSync(join(old, '.gitignore'), 'utf8'), once, 'a second run changes nothing');

  const whole = repo();
  commit(whole, { '.gitignore': '.complex-md/\n', 'a.js': 'x\n' });
  assert.match(run(whole).stderr, /ignores the whole \.complex-md folder/);
  assert.equal(readFileSync(join(whole, '.gitignore'), 'utf8'), '.complex-md/\n');
});

test('--json prints the report, and a fresh repository with no key reports nothing', () => {
  const dir = repo();
  commit(dir, { 'a.js': 'export const a = 1;\n' });
  const r = run(dir, '--json');
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.format, 'complex-md/exposure-report');
  assert.deepEqual(j.findings, []);
  assert.equal(j.rules.length, 54);
  assert.ok(existsSync(join(dir, '.complex-md/exposure-report.json')));
});
