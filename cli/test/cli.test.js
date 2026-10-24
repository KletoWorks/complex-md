// The bin's guard rails, run as a real process: outside a repository and
// in a repository with no commits, it exits 2 with one friendly line and
// nothing from git itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');

function run(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(cwd) } });
}

test('a fresh git init with no commits exits 2 with the no-commits message', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-empty-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  const r = run(dir, ['signals']);
  assert.equal(r.status, 2);
  assert.equal(r.stderr.trim(), 'complex-md: this repository has no commits yet; the map needs history. Make a first commit and run again.');
  assert.ok(!/fatal:/.test(r.stderr + r.stdout), 'no raw git error leaks');
});

function smallRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-nokey-'));
  const env = { GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  const g = (...a) => spawnSync('git', a, { cwd: dir, env: { ...process.env, ...env } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  return dir;
}

/* The environment of a new user: no provider key of any kind. */
const NO_KEYS = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/_API_KEY$|^COMPLEX_MD_|^OLLAMA_HOST$/.test(k)));
const runNoKey = (dir, args) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8', env: { ...NO_KEYS, GIT_CEILING_DIRECTORIES: dirname(dir) } });

test('a run with no provider key writes COMPLEX.md with template prose and wires it', () => {
  const dir = smallRepo();
  const r = runNoKey(dir, ['generate']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), /^prose: template$/m);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /## COMPLEX\.md: the structural risk map/);
});

test('the run prints the file plan before it writes, and an open stdin that is not a terminal never blocks it', async () => {
  const dir = smallRepo();
  const child = spawn(process.execPath, [BIN], { cwd: dir, env: { ...NO_KEYS, GIT_CEILING_DIRECTORIES: dirname(dir) }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill(), 30000);
  const code = await new Promise((resolve) => child.on('close', resolve));
  clearTimeout(timer);
  assert.equal(code, 0, `exited on its own with stdin still open: ${stderr}`);
  const plan = stderr.indexOf('File plan:');
  assert.ok(plan >= 0, stderr);
  assert.ok(plan < stderr.indexOf('wrote COMPLEX.md'), 'the plan comes before the first write');
  for (const f of ['create  COMPLEX.md', 'create  .complex-md/prompt.md', 'create  .gitignore', 'create  AGENTS.md']) assert.ok(stderr.includes(f), f);
  assert.ok(!stderr.includes('Write these files?'), 'no question without a terminal');
});

test('--yes runs the whole first run with no question', () => {
  const dir = smallRepo();
  const r = runNoKey(dir, ['--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
});

test('the run ends with one computed fact and the site URL', () => {
  const dir = smallRepo();
  const r = runNoKey(dir, ['--yes']);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stderr.trim().split('\n');
  assert.equal(lines.at(-1), 'https://complex.md/?utm_source=cli');
  assert.match(lines.at(-2), /^Fact: .*src\/a\.js.*\.$/);
});

test('a flag with no command runs generate', () => {
  const dir = smallRepo();
  const r = runNoKey(dir, ['--no-wire']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'COMPLEX.md')));
  assert.ok(!existsSync(join(dir, 'AGENTS.md')), '--no-wire was read as a flag');
});

test('outside a git repository exits 2 with the not-a-repository message and no git stderr', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-norepo-'));
  const r = run(dir, ['signals']);
  assert.equal(r.status, 2);
  assert.equal(r.stderr.trim(), 'complex-md: not inside a git repository. It reads git history; run it from inside a checked-out repository.');
  assert.ok(!/fatal:/.test(r.stderr + r.stdout), 'no raw git error leaks');
});

function committedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-base-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  const g = (...a) => spawnSync('git', a, { cwd: dir, env });
  g('init', '-q');
  writeFileSync(join(dir, 'a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'COMPLEX.md'), '---\ncomplex_md: "0.3"\nhotspots:\n  - path: a.js\n    score: 10\n---\n\n## Where the risk lives\n\nx\n');
  g('add', '.');
  g('commit', '-qm', 'one');
  return dir;
}

test('check --base with a ref the checkout lacks exits 2 and names the ref, with or without --strict', () => {
  const dir = committedRepo();
  for (const args of [['check', '--base', 'origin/does-not-exist', '--strict'], ['check', '--base', 'origin/does-not-exist']]) {
    const r = run(dir, args);
    assert.equal(r.status, 2, `${args.join(' ')} must fail, not report a clean change`);
    assert.match(r.stderr, /origin\/does-not-exist/);
    assert.match(r.stderr, /fetch-depth: 0/);
    assert.ok(!/no hotspot or co-change partner/.test(r.stdout), 'no clean report for a diff that never ran');
    assert.ok(!/fatal:/.test(r.stderr + r.stdout), 'no raw git error leaks');
  }
});

test('check --base with no ref after it exits 2', () => {
  const r = run(committedRepo(), ['check', '--base']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--base needs a ref/);
});

test('check --base with a ref that resolves still runs the check', () => {
  const r = run(committedRepo(), ['check', '--base', 'HEAD', '--strict']);
  assert.equal(r.status, 0, r.stderr);
});

/* The --for list in --help was typed by hand and drifted from the target
   table. It is built from TARGET_NAMES, less the retired targets that only
   clean up files earlier versions wrote. */
test('--help lists exactly the offered --for targets, built from the target table', async () => {
  const { TARGET_NAMES, OFFERED_TARGETS } = await import('../src/targets.js');
  const r = spawnSync(process.execPath, [BIN, 'help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  const listed = /--for ([a-z,\s]+?)\s*\(default/.exec(r.stdout)[1].replace(/\s+/g, '').split(',');
  assert.deepEqual(listed, OFFERED_TARGETS);
  assert.ok(OFFERED_TARGETS.every((n) => TARGET_NAMES.includes(n)));
  assert.ok(!listed.includes('roo'), 'Roo reads AGENTS.md; no rule file is offered for it');
  for (const line of r.stdout.split('\n')) assert.ok(line.length <= 120, `help line over 120 columns: ${line}`);
});
