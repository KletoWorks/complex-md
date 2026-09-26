/* Consequence analysis.
 *
 * The property these protect is the one Dempsey and Wrage (DOI
 * 10.58012/4c2e-xd64) name: "Without the first row, a clean and analyzable
 * model can still answer the wrong question." The first row is the engineer
 * declaring what is acceptable. So the tests below care less about whether
 * the arithmetic is right (it is small) than about whether the tool ever
 * decides for itself what is acceptable. It must not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyse, reach, loadBounds, formatImpact } from '../src/impact.js';

/* a <- b <- c, and d imports a directly. Only c has a covering test. */
const GRAPH = {
  fanIn: new Map([
    ['a.js', new Set(['b.js', 'd.js'])],
    ['b.js', new Set(['c.js'])],
  ]),
  tests: new Map([['c.js', new Set(['c.test.js'])]]),
  kinds: new Map(),
};

test('reach is transitive and records the depth each file was reached at', () => {
  const r = reach(GRAPH.fanIn, 'a.js');
  assert.deepEqual([...r.entries()].sort(), [['b.js', 1], ['c.js', 2], ['d.js', 1]]);
  assert.ok(!r.has('a.js'), 'the file itself is not part of its own reach');
});

test('a cycle terminates', () => {
  const cyclic = new Map([['x.js', new Set(['y.js'])], ['y.js', new Set(['x.js'])]]);
  const r = reach(cyclic, 'x.js');
  assert.deepEqual([...r.keys()], ['y.js']);
});

test('maxDepth truncates rather than hanging', () => {
  const r = reach(GRAPH.fanIn, 'a.js', { maxDepth: 1 });
  assert.deepEqual([...r.keys()].sort(), ['b.js', 'd.js']);
});

test('a consequence decomposes into contributions, not one number', () => {
  const a = analyse('a.js', { graph: GRAPH });
  const names = a.contributions.map((c) => c.name);
  assert.deepEqual(names, ['reach', 'direct', 'untested_reach', 'hot_reach']);
  assert.equal(a.contributions.find((c) => c.name === 'reach').value, 3);
  assert.equal(a.contributions.find((c) => c.name === 'direct').value, 2);
  assert.equal(a.contributions.find((c) => c.name === 'untested_reach').value, 2, 'b.js and d.js lack tests');
});

test('with no bounds declared the answer is unbounded, which is not passing', () => {
  const a = analyse('a.js', { graph: GRAPH });
  assert.equal(a.status, 'unbounded');
  assert.notEqual(a.status, 'within', 'silence from the engineer must never render as success');
  for (const c of a.contributions) assert.equal(c.bound, null);
  assert.match(formatImpact(a), /no bounds declared/);
});

test('a declared bound produces margin, and exceeding it is reported as over', () => {
  const a = analyse('a.js', { graph: GRAPH, bounds: { reach: 5, untested_reach: 1 } });
  assert.equal(a.status, 'over');
  assert.deepEqual(a.over, ['untested_reach']);
  const reachC = a.contributions.find((c) => c.name === 'reach');
  assert.equal(reachC.status, 'within');
  assert.equal(reachC.margin, 2);
  const un = a.contributions.find((c) => c.name === 'untested_reach');
  assert.equal(un.margin, -1);
  assert.match(formatImpact(a), /OVER bound 1 by 1/);
});

test('hot_reach counts only files the map itself ranks', () => {
  const map = { row: (p) => (p === 'c.js' ? { path: 'c.js', churn: 9 } : null) };
  const a = analyse('a.js', { graph: GRAPH, map });
  assert.equal(a.contributions.find((c) => c.name === 'hot_reach').value, 1);
});

test('a boundary function adds crossing as its own contribution', () => {
  const boundaryOf = (p) => (p === 'd.js' ? 'other' : 'home');
  const a = analyse('a.js', { graph: GRAPH, boundaryOf });
  const x = a.contributions.find((c) => c.name === 'cross_boundary');
  assert.equal(x.value, 1);
  assert.deepEqual(x.contributors, ['d.js']);
});

test('a malformed bounds file is not read as an absence of bounds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-bounds-'));
  mkdirSync(join(dir, '.complex-md'));
  writeFileSync(join(dir, '.complex-md/bounds.json'), '{ this is not json');
  assert.deepEqual(loadBounds(dir), { __invalid: true });
});

test('bounds are read, and nonsense values are dropped rather than trusted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-bounds2-'));
  mkdirSync(join(dir, '.complex-md'));
  writeFileSync(
    join(dir, '.complex-md/bounds.json'),
    JSON.stringify({ reach: 10, untested_reach: -1, hot_reach: 'three', nonsense: 4 }),
  );
  assert.deepEqual(loadBounds(dir), { reach: 10 });
});

test('an absent bounds file is null, distinct from an empty one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-bounds3-'));
  assert.equal(loadBounds(dir), null);
});
