// The map card on the home page draws one real COMPLEX.md. Every number,
// path and directive on it comes from that file at build time, so a card
// that drifts from its source fails here. Runs only inside the repository
// checkout; the published CLI package has no scripts/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseComplexMd } from '../src/complexmd.js';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const demo = () => import(pathToFileURL(join(ROOT, 'scripts/demo-map.mjs')).href);
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('the demo map is a committed map of the repository it names', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { DEMO } = await demo();
  assert.ok(existsSync(join(ROOT, DEMO.file)), DEMO.file);
  assert.match(DEMO.repo, /^[\w.-]+\/[\w.-]+$/);
  assert.ok(DEMO.file.split('/').pop().startsWith(DEMO.repo.replace('/', '-') + '-'), 'the bench writes a map under owner-name-month');
});

test('the card names the map\'s repository, commit, date and tool, read from the file', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { DEMO, demoCard } = await demo();
  const text = readFileSync(join(ROOT, DEMO.file), 'utf8');
  const fm = parseComplexMd(text).front;
  const html = demoCard(text, DEMO);
  for (const v of [DEMO.repo, fm.commit, fm.generated, fm.tool, `spec ${fm.complex_md}`]) assert.ok(html.includes(esc(v)), `names ${v}`);
  assert.ok(html.includes(Number(fm.profile.commits_analyzed).toLocaleString('en-US')), 'commits read');
  assert.ok(html.includes(`href="https://github.com/KletoWorks/complex-md/blob/main/${DEMO.file}"`), 'links the source file');
});

test('one tile and one panel per hotspot, with the map\'s numbers and directives', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { DEMO, demoCard } = await demo();
  const text = readFileSync(join(ROOT, DEMO.file), 'utf8');
  const map = parseComplexMd(text);
  const html = demoCard(text, DEMO);
  const hot = map.front.hotspots;
  // Two layouts, wide and tall, each with every hotspot once.
  assert.equal((html.match(/<g class="tile /g) || []).length, hot.length * 2);
  assert.equal((html.match(/<div class="panel"/g) || []).length, hot.length);
  hot.forEach((h, i) => {
    assert.ok(html.includes(`<title>${esc(h.path)}: ${Number(h.loc).toLocaleString('en-US')} lines, ${h.churn} commits, ${h.fixes} fixes`), `tile title for ${h.path}`);
    const panel = new RegExp(`<div class="panel"[^>]*id="hot-${i}"[\\s\\S]*?</div>`).exec(html)?.[0] || '';
    assert.ok(panel.includes(`<code>${esc(h.path)}</code>`), `panel ${i} names ${h.path}`);
    const d = map.directive(h.path);
    if (d) assert.ok(panel.includes(esc(d).replace(/`([^`]+)`/g, '<code>$1</code>')), `panel ${i} carries the directive`);
  });
  // Exactly one panel shows without script: the first in the cycle.
  assert.equal((html.match(/<div class="panel"[^>]*hidden/g) || []).length, hot.length - 1);
  const cycle = /data-cycle="([\d ]+)"/.exec(html)[1].split(' ').map(Number);
  assert.ok(cycle.every((i) => map.directive(hot[i].path)), 'the cycle visits only files with a directive');
  assert.match(html, new RegExp(`<div class="panel" id="hot-${cycle[0]}" data-i="${cycle[0]}">`));
});

test('the legend steps follow the most fixed file and the File view is the front matter verbatim', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { DEMO, demoCard, heatSteps } = await demo();
  const text = readFileSync(join(ROOT, DEMO.file), 'utf8');
  const html = demoCard(text, DEMO);
  assert.deepEqual(heatSteps(51), [[1, 12], [13, 25], [26, 38], [39, 51]]);
  assert.deepEqual(heatSteps(2), [[1, 1], [2, 2]], 'an empty step is left out');
  const max = Math.max(...parseComplexMd(text).front.hotspots.map((h) => h.fixes));
  assert.ok(html.includes(`to ${max}</li>`), 'the last step ends at the most fixed file');
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)[1];
  const shown = (/<pre class="yaml"[^>]*>([\s\S]*?)<\/pre>/.exec(html)?.[1] || '').replace(/<[^>]+>/g, '');
  assert.equal(shown, esc(`---\n${fm}\n---`));
});

test('the card holds no style attribute, no script and no dash punctuation', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { DEMO, demoCard } = await demo();
  const html = demoCard(readFileSync(join(ROOT, DEMO.file), 'utf8'), DEMO);
  assert.ok(!/\sstyle=/.test(html), 'no style attribute');
  assert.ok(!/<script/.test(html), 'no script');
  assert.ok(!/[–—]/.test(html), 'no en or em dash');
});

test('a path from a stranger\'s map is escaped everywhere it appears', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { demoCard } = await demo();
  const text = `---\ncomplex_md: "0.3"\ngenerated: 2026-01-01\ncommit: abc1234\ntool: complex-md/0.11.0\nfiles_analyzed: 1\nprofile:\n  commits_analyzed: 3\nhotspots:\n  - path: "src/<img src=x>.js"\n    loc: 10\n    churn: 3\n    fixes: 1\n    fan_in: 0\n    tests: 0\n---\n\n## Why these files are hot\n\nsrc/<img src=x>.js is small. Before editing this file, run <b>tests</b>.\n`;
  const html = demoCard(text, { repo: 'a/b', file: 'x.md' });
  assert.ok(!html.includes('<img'), 'no markup from the map');
  assert.ok(!html.includes('<b>'), 'no markup from the prose');
});
