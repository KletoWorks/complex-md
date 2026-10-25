/* A bench map stays under the size the spec recommends: 8,192 bytes, front
   matter and prose together (spec 0.4, section 4). The undici maps of the
   published runs were 10 to 12 KB and the fastify maps 8 to 10 KB. The
   harness cuts list rows from the end of the front matter and gives the
   model a byte budget for the prose. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_CAP, fitSignals, sizeNote, assertFits } from '../../bench/fit.mjs';

const row = (i) => ({ path: `lib/file-${i}.js`, n: i });
const sig = () => ({ hotspots: Array.from({ length: 15 }, (_, i) => row(i)), load_bearing: [row(90), row(91)], co_change: Array.from({ length: 6 }, (_, i) => ({ files: [`a${i}`, `b${i}`] })), seams: [{ dirs: ['x', 'y'] }], other: 'kept' });
const render = (s) => JSON.stringify(s);
const bytes = (s) => Buffer.byteLength(s);

test('the cap is the 8,192 bytes the spec recommends', () => {
  assert.equal(MAP_CAP, 8192);
});

test('fitSignals cuts rows from the end of the lists until the front matter fits', () => {
  const s = sig();
  const budget = Math.floor(bytes(render(s)) * 0.6);
  const fit = fitSignals(s, render, budget);
  assert.ok(bytes(render(fit)) <= budget, `${bytes(render(fit))} > ${budget}`);
  assert.ok(fit.hotspots.length < 15);
  assert.deepEqual(fit.hotspots, s.hotspots.slice(0, fit.hotspots.length), 'the first rows stay, in order');
  assert.equal(fit.other, 'kept');
  assert.equal(s.hotspots.length, 15, 'the input is not changed');
});

test('fitSignals leaves a front matter that already fits as it is', () => {
  const s = sig();
  assert.deepEqual(fitSignals(s, render, bytes(render(s))), s);
});

test('fitSignals keeps three hotspots and one co-change pair at least', () => {
  const fit = fitSignals(sig(), render, 10);
  assert.equal(fit.hotspots.length, 3);
  assert.equal(fit.co_change.length, 1);
});

test('sizeNote gives the prose a byte budget below what is left after the front matter', () => {
  const fm = 'x'.repeat(3000);
  const { note, proseBytes } = sizeNote(fm, MAP_CAP);
  assert.ok(proseBytes > 0 && proseBytes < MAP_CAP - 3000);
  assert.match(note, /8,192 bytes/);
  assert.match(note, new RegExp(`${proseBytes.toLocaleString('en-US')} bytes`));
});

test('assertFits passes a map under the cap and refuses one over it', () => {
  assert.equal(assertFits('a'.repeat(8192), MAP_CAP), 8192);
  assert.throws(() => assertFits('a'.repeat(8193), MAP_CAP), /8,193 bytes, over the 8,192 byte cap/);
  assert.equal(assertFits('a'.repeat(9000), 0), 9000, 'a cap of 0 turns the check off');
});
