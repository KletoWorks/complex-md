/* bench/damage.mjs: damage per run, the screen set, the 15 and 15
   selection, and the per task comparison. Pure functions; no model. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDamage, goldBroken, allocate, classify, select, perTask, compare, holm, hashOrder } from '../../bench/damage.mjs';

const row = (task, arm, regressions, extra = {}) => ({ task, arm, seed: 1, error: null, regressions, ...extra });

test('a run is damaged by a regression the gold patch does not also cause', () => {
  const gold = goldBroken([row('t1', 'gold', ['test/a.js :: flaky'])]);
  assert.equal(runDamage(row('t1', 'none', ['test/a.js :: flaky']), gold), false, 'a test the real fix also breaks is not damage');
  assert.equal(runDamage(row('t1', 'none', ['test/a.js :: flaky', 'test/b.js :: x']), gold), true);
  assert.equal(runDamage(row('t1', 'none', []), gold), false);
  assert.equal(runDamage(row('t1', 'none', null), gold), null, 'no suite, no verdict');
  assert.equal(runDamage(row('t1', 'none', [], { error: 'harness: boom' }), gold), null, 'an errored run has no verdict');
  assert.equal(runDamage(row('t2', 'none', ['test/c.js :: y']), gold), true, 'a task without a gold row filters nothing');
});

test('the screen set takes up to 20 usable tasks a repository and fills a short one in turns', () => {
  const usable = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, usable: true }));
  const sets = { fastify: usable(26, 'f'), mocha: usable(18, 'm'), 'uptime-kuma': [...usable(2, 'x').map((t) => ({ ...t, usable: false })), ...usable(24, 'u')] };
  const got = allocate(sets, { total: 60, quota: 20 });
  assert.deepEqual(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.length])), { fastify: 21, mocha: 18, 'uptime-kuma': 21 });
  assert.deepEqual(got.fastify.slice(0, 2), ['f0', 'f1'], 'dataset order, newest first');
  assert.equal(got['uptime-kuma'][0], 'u0', 'an unusable task is replaced by the next one');
});

test('a screen row makes its task damaged, clean or unusable', () => {
  const gold = goldBroken([]);
  assert.equal(classify(row('a', 'none', ['t :: x']), gold), 'damaged');
  assert.equal(classify(row('a', 'none', []), gold), 'clean');
  assert.equal(classify(row('a', 'none', null), gold), 'unusable');
  assert.equal(classify(undefined, gold), 'unusable');
});

test('selection keeps 15 damaged and 15 clean in hash order, alternating repositories', () => {
  const tasks = [];
  for (const repo of ['a/x', 'b/y']) for (let i = 0; i < 12; i++) tasks.push({ id: `${repo[0]}d${i}`, repo, cls: 'damaged' }, { id: `${repo[0]}c${i}`, repo, cls: 'clean' });
  const s = select(tasks);
  assert.equal(s.kill, false);
  assert.equal(s.damaged.length, 15);
  assert.equal(s.clean.length, 15);
  const aDamaged = s.damaged.filter((id) => id.startsWith('a')).length;
  assert.ok(aDamaged === 8 || aDamaged === 7, `repositories alternate: ${aDamaged} of 15 from a/x`);
  const firstA = hashOrder(tasks.filter((t) => t.repo === 'a/x' && t.cls === 'damaged').map((t) => t.id))[0];
  assert.ok(s.damaged.includes(firstA), 'the lowest hash of each repository is taken first');
  assert.deepEqual(select([...tasks].reverse()), s, 'input order does not change the result');
});

test('fewer than 15 damaged keeps them all and fills to 30 with clean; under 15% kills', () => {
  const mk = (d, c, u = 0) => [
    ...Array.from({ length: d }, (_, i) => ({ id: `d${i}`, repo: 'r', cls: 'damaged' })),
    ...Array.from({ length: c }, (_, i) => ({ id: `c${i}`, repo: 'r', cls: 'clean' })),
    ...Array.from({ length: u }, (_, i) => ({ id: `u${i}`, repo: 'r', cls: 'unusable' })),
  ];
  const s = select(mk(10, 48, 2));
  assert.equal(s.kill, false);
  assert.equal(s.rate, 10 / 58);
  assert.equal(s.damaged.length, 10);
  assert.equal(s.clean.length, 20);
  const k = select(mk(8, 50, 2));
  assert.equal(k.kill, true, '8 of 58 usable is under 15%');
  assert.deepEqual([k.damaged, k.clean], [[], []]);
});

test('per task, an arm scores the seeds it damaged, and a task missing a verdict drops out', () => {
  const gold = goldBroken([]);
  const rows = [
    row('t1', 'none', ['x :: 1']), { ...row('t1', 'none', ['x :: 1']), seed: 2 },
    row('t1', 'file', []), { ...row('t1', 'file', ['x :: 1']), seed: 2 },
    row('t2', 'none', []), { ...row('t2', 'none', []), seed: 2 },
    row('t2', 'file', null), { ...row('t2', 'file', []), seed: 2 },
  ];
  assert.deepEqual(perTask(rows, gold, 'none', ['t1', 't2'], [1, 2]), { t1: 2, t2: 0 });
  assert.deepEqual(perTask(rows, gold, 'file', ['t1', 't2'], [1, 2]), { t1: 1, t2: null });
});

test('the comparison counts tasks for and against the arm and applies the success rule', () => {
  const tasks = Array.from({ length: 30 }, (_, i) => `t${i}`);
  const base = Object.fromEntries(tasks.map((t) => [t, 0]));
  const none = { ...base }, arm = { ...base };
  for (let i = 0; i < 6; i++) none[`t${i}`] = 2;
  const six = compare(none, arm);
  assert.deepEqual([six.for, six.against, six.ties, six.n], [6, 0, 24, 30]);
  assert.ok(Math.abs(six.p - 0.03125) < 1e-9);
  assert.equal(six.success, true);
  arm.t29 = 1;
  const sixOne = compare(none, arm);
  assert.deepEqual([sixOne.for, sixOne.against], [6, 1]);
  assert.ok(Math.abs(sixOne.p - 0.125) < 1e-9);
  assert.equal(sixOne.success, false, '6 for and 1 against is p 0.125, over 0.05');
  none.t6 = 1; none.t7 = 2;
  const eightOne = compare(none, arm);
  assert.deepEqual([eightOne.for, eightOne.against], [8, 1]);
  assert.equal(eightOne.success, true);
  const missing = compare({ a: 2, b: null }, { a: 0, b: 0 });
  assert.equal(missing.n, 1, 'a task with no verdict in either arm is left out');
});

test('Holm adjusts the secondary p values step down and keeps them monotone', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => Number(p.toFixed(4))), [0.03, 0.06, 0.06]);
  assert.deepEqual(holm([0.5, 0.9]), [1, 1]);
});

test('the replay says whether the tests the map names for the edited files hold each break', async () => {
  const { replay } = await import('../../bench/damage.mjs');
  const gold = goldBroken([row('t1', 'gold', ['test/flaky.js :: f'])]);
  const named = { t1: { 'lib/core.js': ['test/core.test.js', 'test/api.test.js'], 'lib/other.js': ['test/other.test.js'] } };
  const rows = [
    row('t1', 'none', ['test/api.test.js :: get', 'test/far.test.js :: x', 'test/flaky.js :: f'], { edited: ['lib/core.js', 'README.md'] }),
    row('t1', 'file', [], { edited: ['lib/core.js'] }),
  ];
  const r = replay(rows, gold, named);
  assert.deepEqual(r.breaks, [
    { task: 't1', arm: 'none', seed: 1, test: 'test/api.test.js :: get', caught: true },
    { task: 't1', arm: 'none', seed: 1, test: 'test/far.test.js :: x', caught: false },
  ]);
  assert.deepEqual([r.caught, r.total], [1, 2]);
});
