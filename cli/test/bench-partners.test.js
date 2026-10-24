// Co-change partner misses: when an agent edits one file of a co-change
// pair, does it look at the other. Runs only inside the repository
// checkout; the published CLI package has no bench/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCH = join(ROOT, 'bench');
const RESULTS = join(BENCH, 'results');
const load = () => import(pathToFileURL(join(BENCH, 'partners.mjs')).href);
const dataset = (name) => JSON.parse(readFileSync(join(BENCH, 'data', name), 'utf8'));
const committed = () => existsSync(join(RESULTS, 'undici-damage/baseline')) && existsSync(join(RESULTS, 'fastify-damage/baseline'));

test('sourcePairs keeps pairs of source files and drops prose partners', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { sourcePairs } = await load();
  assert.deepEqual(sourcePairs([['a.js', 'b.js'], ['a.js', 'README.md'], ['docs/x.mdx', 'c.js']]), [['a.js', 'b.js']]);
});

test('mentions matches a whole repository path, never a longer path that ends with it', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { mentions } = await load();
  assert.ok(mentions('cat lib/route.js', 'lib/route.js'));
  assert.ok(mentions('{"file_path":"/tmp/wt/lib/route.js"}', 'lib/route.js', '/tmp/wt'));
  assert.ok(!mentions('{"file_path":"/tmp/wt/test/lib/route.js"}', 'lib/route.js', '/tmp/wt'));
  assert.ok(mentions('node -e "require(\'./lib/route.js\')"', 'lib/route.js'));
  assert.ok(mentions("sed -n 1,40p 'lib/route.js'", 'lib/route.js'));
  assert.ok(!mentions('cat test/lib/route.js', 'lib/route.js'));
  assert.ok(!mentions('cat lib/route.json', 'lib/route.js'));
  assert.ok(!mentions('cat lib/router.js', 'lib/route.js'));
});

test('callTargets counts a call that opens or names the file, not a search for its name', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { callTargets } = await load();
  const p = 'lib/route.js';
  assert.ok(callTargets({ name: 'Read', input: { file_path: '/tmp/wt/lib/route.js' } }, p, '/tmp/wt'));
  assert.ok(callTargets({ name: 'Grep', input: { pattern: 'onRequest', path: '/tmp/wt/lib/route.js' } }, p, '/tmp/wt'));
  assert.ok(callTargets({ name: 'Bash', input: { command: 'sed -n 1,80p lib/route.js' } }, p, '/tmp/wt'));
  assert.ok(!callTargets({ name: 'Grep', input: { pattern: 'lib/route.js', path: '/tmp/wt/test' } }, p, '/tmp/wt'));
  assert.ok(!callTargets({ name: 'Bash', input: { command: 'grep -n "lib/route.js" COMPLEX.md' } }, p, '/tmp/wt'));
  assert.ok(!callTargets({ name: 'Read', input: { file_path: '/tmp/wt/lib/router.js' } }, p, '/tmp/wt'));
});

test('partnerOutcomes names the unseen partner of each edited file', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { partnerOutcomes } = await load();
  const pairs = [['a.js', 'b.js'], ['a.js', 'c.js'], ['d.js', 'e.js']];
  const seen = new Set(['a.js', 'c.js']);
  assert.deepEqual(partnerOutcomes(['a.js', 'z.js'], pairs, (p) => seen.has(p)), { 'a.js': ['b.js'] });
  assert.deepEqual(partnerOutcomes(['z.js'], pairs, () => false), {});
});

test('the recorded metric reproduces partners_missed on every committed run', async (t) => {
  if (!committed()) return t.skip('bench results are not in this checkout');
  const { scoreDir } = await load();
  for (const [dir, ds] of [['undici-damage', 'undici-danger.json'], ['fastify-damage', 'fastify-danger.json']]) {
    const s = scoreDir(join(RESULTS, dir), dataset(ds));
    assert.ok(s.runs.length >= 60, `${dir}: ${s.runs.length} runs`);
    /* Two fastify rows were recorded before the harness left prose partners
       out (bench/run.mjs, 2026-09-27); the module applies that rule to all. */
    const source = (f) => !/\.(md|mdx|txt|rst)$/i.test(f);
    for (const r of s.runs) assert.deepEqual([...r.recordedMissed].sort(), r.row.partners_missed.filter(source).sort(), `${dir} ${r.row.task}-${r.row.arm}`);
  }
});

test('run level counts match the harness: undici 11 of 27 and 7 of 28, fastify 25, 24 and 19 of 30', async (t) => {
  if (!committed()) return t.skip('bench results are not in this checkout');
  const { scoreDir } = await load();
  const count = (s, arm) => {
    const runs = s.runs.filter((r) => r.row.arm === arm && !r.row.error);
    return [runs.filter((r) => r.recordedMissed.length).length, runs.length];
  };
  const u = scoreDir(join(RESULTS, 'undici-damage'), dataset('undici-danger.json'));
  assert.deepEqual(count(u, 'none'), [11, 27]);
  assert.deepEqual(count(u, 'file'), [7, 28]);
  const f = scoreDir(join(RESULTS, 'fastify-damage'), dataset('fastify-danger.json'));
  assert.deepEqual(count(f, 'none'), [25, 30]);
  assert.deepEqual(count(f, 'file'), [24, 30]);
  assert.deepEqual(count(f, 'hooks'), [19, 30]);
});

test('bench/results/e0.json is what the module computes from the committed runs', async (t) => {
  if (!committed()) return t.skip('bench results are not in this checkout');
  const { e0Report } = await load();
  const path = join(RESULTS, 'e0.json');
  assert.ok(existsSync(path), 'bench/results/e0.json is missing');
  const onDisk = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(e0Report(ROOT))));
  /* The corrected definition came after the recorded result; the file says so. */
  assert.equal(onDisk.primary, 'edit_recorded');
  assert.match(onDisk.exploratory, /corrected/);
});
