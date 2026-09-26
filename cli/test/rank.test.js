import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageRank, rankScaled } from '../src/rank.js';

/* hub <- a, b, c ; a <- x1..x5. fan_in ranks a (5 importers) above hub (3).
   PageRank ranks hub above a, because a's importance flows on to hub. That
   inversion is the case the method exists for. */
function graph() {
  return new Map([
    ['hub.js', new Set(['a.js', 'b.js', 'c.js'])],
    ['a.js', new Set(['x1.js', 'x2.js', 'x3.js', 'x4.js', 'x5.js'])],
  ]);
}

test('rank flows through importers: a hub outranks a file with more direct importers', () => {
  const r = pageRank(graph());
  assert.ok(r.get('hub.js') > r.get('a.js'), 'hub.js should outrank a.js');
  assert.ok(r.get('a.js') > r.get('x1.js'), 'a.js should outrank a leaf');
});

test('scores form a distribution', () => {
  const sum = [...pageRank(graph()).values()].reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6, `sum ${sum}`);
});

test('a leaf with no imports keeps a positive score', () => {
  const r = pageRank(graph());
  assert.ok(r.has('x1.js') && r.get('x1.js') > 0);
});

test('an empty graph and a cycle both terminate', () => {
  assert.equal(pageRank(new Map()).size, 0);
  const r = pageRank(new Map([['a.js', new Set(['b.js'])], ['b.js', new Set(['a.js'])]]));
  assert.ok(Math.abs(r.get('a.js') - r.get('b.js')) < 1e-9, 'a symmetric cycle ranks equally');
});

test('rankScaled puts the top file at 100', () => {
  const s = rankScaled(graph());
  assert.equal(s.get('hub.js'), 100);
  assert.ok(s.get('x1.js') >= 0 && s.get('x1.js') < 100);
});
