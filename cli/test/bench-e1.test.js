// The test selection backtest: at a fix's parent commit, which selector
// names the test files the fix itself changed. Runs only inside the
// repository checkout; the published CLI package has no bench/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCH = join(ROOT, 'bench');
const load = () => import(pathToFileURL(join(BENCH, 'e1.mjs')).href);

/* lib/core.js is imported by lib/mid.js and by the barrel lib/index.js,
   which the package root index.js re-exports. Each test reaches core.js a
   different way:
     core.test   imports lib/core.js            direct
     mid.test    imports lib/mid.js             depth 2
     root.test   imports '..', the package root through the root and barrel
     dir.test    imports '../lib/', the barrel, by its directory
     other.test  imports lib/other.js -> mid    depth 3, full closure only
     side.test   imports nothing of these       co-change history only */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-e1-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env });
  const w = (p, s) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
  const commit = (msg) => { g('add', '-A'); g('commit', '-q', '-m', msg); };
  g('init', '-q');
  w('package.json', JSON.stringify({ name: 'pkg', main: 'index.js', scripts: { test: 'node --test test/*.test.js' } }));
  w('index.js', "module.exports = require('./lib/index.js')\n");
  w('lib/index.js', "module.exports = {\n  core: require('./core'),\n  mid: require('./mid'),\n}\n");
  w('lib/core.js', 'module.exports = 1\n');
  w('lib/mid.js', "const core = require('./core')\nmodule.exports = core + 1\nconst a = 1\nconst b = 2\nconst c = 3\n");
  w('lib/other.js', "const mid = require('./mid')\nmodule.exports = mid + 1\nconst a = 1\nconst b = 2\nconst c = 3\n");
  w('test/core.test.js', "require('../lib/core.js')\n");
  w('test/mid.test.js', "require('../lib/mid.js')\n");
  w('test/root.test.js', "require('..')\n");
  w('test/dir.test.js', "require('../lib/')\n");
  w('test/other.test.js', "require('../lib/other.js')\n");
  w('test/side.test.js', '// side\n');
  commit('feat: start');
  w('lib/core.js', 'module.exports = 2\n');
  w('test/side.test.js', '// side 2\n');
  commit('feat: core and side together');
  w('README.md', '# pkg\n');
  commit('docs: readme');
  /* The fix to score: it changes core.js and the existing root test. */
  w('lib/core.js', 'module.exports = 3\n');
  w('test/root.test.js', "require('..')\n// covers core\n");
  commit('fix: core returns the wrong number');
  /* A fix whose only test is new: no selector can name a file that does not exist yet. */
  w('lib/mid.js', "const core = require('./core')\nmodule.exports = core + 2\nconst a = 1\nconst b = 2\nconst c = 3\n");
  w('test/new.test.js', "require('../lib/mid.js')\n");
  commit('fix: mid adds two');
  /* A fix with no test change at all. */
  w('lib/other.js', "const mid = require('./mid')\nmodule.exports = mid + 2\nconst a = 1\nconst b = 2\nconst c = 3\n");
  commit('fix: other adds two');
  return dir;
}

test('bandOf puts fan-in into the bands the decision bar uses', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { bandOf } = await load();
  assert.deepEqual([0, 1, 5, 6, 20, 21, 400].map(bandOf), ['0', '1-5', '1-5', '6-20', '6-20', '>20', '>20']);
});

test('the five selectors at the parent of a fix, on a repository with a root and a barrel', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runRepo } = await load();
  const dir = makeRepo();
  const wt = mkdtempSync(join(tmpdir(), 'cx-e1-wt-'));
  rmSync(wt, { recursive: true, force: true });
  try {
    const r = runRepo({ repo: dir, name: 'fixture', max: 150, worktree: wt });
    assert.equal(r.counts.scored, 1);
    assert.equal(r.counts.dropped.test_added_only, 1);
    assert.equal(r.counts.dropped.no_test_changed, 1);
    const fx = r.fixes[0];
    assert.equal(fx.subject, 'fix: core returns the wrong number');
    assert.deepEqual(fx.truth, ['test/root.test.js']);
    assert.equal(fx.suite, 6);
    assert.deepEqual(fx.changed, [{ path: 'lib/core.js', fan_in: 2, band: '1-5' }]);
    assert.equal(fx.band, '1-5');
    const sel = (k) => fx.selectors[k];
    assert.deepEqual(sel('a').tests, ['test/core.test.js']);
    assert.deepEqual(sel('b').tests, ['test/core.test.js', 'test/mid.test.js']);
    assert.deepEqual(sel('c').tests, ['test/core.test.js', 'test/dir.test.js', 'test/root.test.js']);
    assert.deepEqual(sel('d').tests, ['test/side.test.js']);
    assert.deepEqual(sel('e').tests, ['test/core.test.js', 'test/dir.test.js', 'test/mid.test.js', 'test/other.test.js', 'test/root.test.js']);
    assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((k) => sel(k).hits), [0, 0, 1, 0, 1]);
    /* Ranked cuts at 15% and 20% of a 6 file suite keep one test each:
       by import distance (e) or by co-change count first (m). */
    assert.deepEqual(sel('e15').tests, ['test/core.test.js']);
    assert.deepEqual(sel('e20').tests, ['test/core.test.js']);
    assert.deepEqual(sel('m15').tests, ['test/side.test.js']);
    assert.deepEqual(sel('m20').tests, ['test/side.test.js']);
    const s = r.summary.by_fix['1-5'];
    assert.equal(s.c.recall, 1);
    assert.equal(s.c.share_mean, 0.5);
    assert.equal(s.a.recall, 0);
    assert.equal(s.e.share_mean, 0.8333);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(wt, { recursive: true, force: true });
  }
});

test('verdict applies the decision bar to the two lower bands', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { verdict } = await load();
  const band = (recall, share) => ({ fixes: 10, recall, share_mean: share });
  const v = verdict({
    '1-5': { a: band(0.5, 0.02), e: band(0.9, 0.12) },
    '6-20': { a: band(0.4, 0.03), e: band(0.85, 0.14) },
    '>20': { a: band(0.1, 0.01), e: band(1, 0.9) },
  });
  assert.deepEqual(v.meets_bar, ['e']);
  assert.equal(v.full_suite_advice, false);
  const k = verdict({ '1-5': { a: band(0.5, 0.1) }, '6-20': { a: band(0.55, 0.19) } });
  assert.deepEqual(k.meets_bar, []);
  assert.equal(k.full_suite_advice, true);
});

test('knownBreaks scores each selector on the tests an agent patch broke', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { knownBreaks } = await load();
  const dir = makeRepo();
  const wt = mkdtempSync(join(tmpdir(), 'cx-e1-wt-'));
  rmSync(wt, { recursive: true, force: true });
  try {
    const base = execFileSync('git', ['rev-list', '--max-count=1', '--grep', '^docs: readme', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    /* Two arms broke the same test on the same task; one arm broke nothing. */
    const rows = [
      { task: 't1', arm: 'none', edited: ['lib/core.js'], regressions: ['test/other.test.js :: adds one'] },
      { task: 't1', arm: 'file', edited: ['lib/core.js', 'test/core.test.js'], regressions: ['test/other.test.js :: adds one'] },
      { task: 't2', arm: 'none', edited: ['lib/mid.js'], regressions: [] },
    ];
    const r = knownBreaks({ repo: dir, worktree: wt, rows, dataset: { tasks: [{ id: 't1', base }, { id: 't2', base }] } });
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].edited, ['lib/core.js']);
    assert.deepEqual(r[0].broken, ['test/other.test.js']);
    assert.deepEqual(r[0].caught, { a: 0, b: 0, c: 0, d: 0, e: 1, e15: 0, e20: 0, m15: 0, m20: 0 });
    assert.equal(r[0].selectors.e.size, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(wt, { recursive: true, force: true });
  }
});
