// Collateral damage: the tests the agent's patch broke that had nothing to do
// with the task. The suite is run file by file so every result has a file, and
// the TAP output of each file is read so a regression has a test name, not
// only a file. A test counts as a regression when it passed at the base commit
// and fails after the patch, on two runs; a test that fails at the base is
// out of scope for every arm.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* The runner the repository uses, from every script value in package.json:
   a `test` script that runs `npm run unit` names no runner itself. Nothing
   detected is null, never a guess. */
export function detectRunner(wt) {
  let scripts = '';
  try { scripts = Object.values(JSON.parse(readFileSync(join(wt, 'package.json'), 'utf8')).scripts || {}).join(' '); } catch {}
  if (/\btap\b/.test(scripts)) return { name: 'tap', cmd: 'npx', args: ['tap', '--no-coverage', '--reporter=tap'], tap: true };
  /* borp is a thin node:test wrapper (fastify uses it); node --test runs
     the same files without the wrapper. */
  if (/node --test|node:test|\bborp\b/.test(scripts)) return { name: 'node', cmd: 'node', args: ['--test', '--test-reporter=tap'], tap: true };
  if (/\bmocha\b/.test(scripts)) return { name: 'mocha', cmd: 'npx', args: ['mocha'], tap: false };
  if (/\bvitest\b/.test(scripts)) return { name: 'vitest', cmd: 'npx', args: ['vitest', 'run'], tap: false };
  if (/\bjest\b/.test(scripts)) return { name: 'jest', cmd: 'npx', args: ['jest'], tap: false };
  return null;
}

const TEST_FILE = /\.(test|spec)\.(m?js|cjs|ts|mts)$/;

/* Test files under test/, tests/ or __tests__/, recursively. A repository
   that keeps them elsewhere gets an empty list and null suite metrics. */
export function listTestFiles(wt) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(wt, dir))) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const rel = join(dir, e);
      const st = statSync(join(wt, rel));
      if (st.isDirectory()) walk(rel);
      else if (TEST_FILE.test(e)) out.push(rel);
    }
  };
  for (const d of ['test', 'tests', '__tests__']) if (existsSync(join(wt, d))) walk(d);
  return out.sort();
}

/* Top level TAP lines only; nested subtests are indented. */
function parseTap(stdout) {
  const tests = {};
  for (const line of stdout.split('\n')) {
    const m = /^(not )?ok \d+ - (.+?)\s*(#.*)?$/.exec(line);
    if (m) tests[m[2]] = !m[1];
  }
  return tests;
}

/* One file: { ok, tests: { name: passed } }. A timeout or a crash is a
   failed file with whatever tests were reported before it. Asynchronous so
   a pool of these actually overlaps; spawnSync would serialise the pool. */
export function runTestFile(wt, runner, file, { timeout = 120000 } = {}) {
  return new Promise((res) => {
    const child = spawn(runner.cmd, [...runner.args, file], { cwd: wt, env: { ...process.env, CI: '1' }, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('close', (code) => {
      clearTimeout(timer);
      res({ ok: code === 0, tests: runner.tap ? parseTap(out) : {} });
    });
  });
}

/* The whole list, a few files at a time. Returns { file: { ok, tests } }. */
export async function runSuite(wt, runner, files, { concurrency = 4, timeout = 120000 } = {}) {
  const results = {};
  let i = 0;
  const worker = async () => {
    while (i < files.length) {
      const f = files[i++];
      results[f] = await runTestFile(wt, runner, f, { timeout });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return results;
}

/* Tests that passed at the baseline and fail now, keyed `file :: name`; a
   file that passed and now fails as a whole (crash, timeout) is one entry
   under `file :: (file)`. `exclude` is the set of test files the task's real
   fix changed: their base version may assert the bug, so they are judged by
   the gold tests instead. */
export function regressions(baseline, after, exclude = new Set()) {
  const out = [];
  for (const [file, b] of Object.entries(baseline)) {
    if (exclude.has(file)) continue;
    const a = after[file];
    if (!a) { if (b.ok) out.push(`${file} :: (file)`); continue; }
    for (const [name, passed] of Object.entries(b.tests)) {
      if (passed && a.tests[name] === false) out.push(`${file} :: ${name}`);
      else if (passed && a.tests[name] === undefined && !a.ok) out.push(`${file} :: ${name}`);
    }
    if (b.ok && !a.ok && !Object.keys(b.tests).length) out.push(`${file} :: (file)`);
  }
  return out;
}

/* Re-run only the files that regressed and keep the regressions that repeat.
   One flaky test in a suite this size would otherwise decide a pair. */
export async function confirm(wt, runner, baseline, after, exclude, opts) {
  const first = regressions(baseline, after, exclude);
  if (!first.length) return [];
  const files = [...new Set(first.map((k) => k.split(' :: ')[0]))];
  const again = await runSuite(wt, runner, files, opts);
  const second = new Set(regressions(Object.fromEntries(files.map((f) => [f, baseline[f]])), again, exclude));
  return first.filter((k) => second.has(k));
}
