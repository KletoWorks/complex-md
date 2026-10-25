// The report renderer: one self contained HTML page from a parsed map. It
// must escape every string that came from the repository (file names are
// attacker controlled on a hosted page), load nothing from the network, and
// carry the treemap data a second time as a table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseComplexMd } from '../src/complexmd.js';
import { computeSignals } from '../src/signals.js';
import { renderReport, squarify } from '../src/render.js';

const here = dirname(fileURLToPath(import.meta.url));
const map = parseComplexMd(readFileSync(join(here, 'fixtures', 'render-map.md'), 'utf8'));
const html = renderReport(map, { repo: 'acme/widgets' });

test('the page is one complete HTML document with a title naming the repository', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>acme\/widgets: COMPLEX\.md report<\/title>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<\/html>\s*$/);
});

test('the header names the repository, the commit and the generation date', () => {
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(header, /acme\/widgets/);
  assert.match(header, /1234567/);
  assert.match(header, /2026-10-20/);
});

// The reader reads a 0.3 `tool` as a 0.4 `generator` map, so the footer
// reads the producer from `generator`. A front built in code, as the hosted
// page builds one, may still carry `tool`.
const footerOf = (page) => page.slice(page.indexOf('Rendered from COMPLEX.md'), page.indexOf('Learn the format'));
const withFront = (front) => parseComplexMd(`---\ncomplex_md: "0.4"\ncommit: "abc1234"\n${front}\nhotspots:\n---\n\n## Where the risk lives\n\nNothing.\n`);

test('the footer names the producer of a 0.3 map, read through generator', () => {
  assert.deepEqual(map.front.generator, { name: 'complex-md', version: '0.9.2' });
  assert.match(footerOf(html), /\(complex-md\/0\.9\.2\)/);
});

test('the footer names the producer of a 0.4 generator map, with and without a version', () => {
  assert.match(footerOf(renderReport(withFront('generator:\n  name: complex-md\n  version: "0.11.0"'))), /\(complex-md\/0\.11\.0\)/);
  assert.match(footerOf(renderReport(withFront('generator:\n  name: by-hand'))), /\(by-hand\)/);
  assert.doesNotMatch(footerOf(renderReport(withFront('generated: 2026-10-25'))), /\(/);
});

test('the footer still names a tool that a front built in code carries', () => {
  const built = { ...map, front: { ...map.front, generator: undefined, tool: 'complex-md/0.11.0' } };
  assert.match(footerOf(renderReport(built)), /\(complex-md\/0\.11\.0\)/);
});

// The wide and the phone layout each draw every tile; the tests read the wide one.
const wideSvg = () => html.slice(html.indexOf('<svg class="tm-svg wide"'), html.indexOf('</svg>', html.indexOf('<svg class="tm-svg wide"')));

test('the treemap draws one focusable tile per hotspot, sized by lines and colored by fixes', () => {
  const tiles = wideSvg().match(/<a class="tile[^"]*"[^>]*>/g) || [];
  assert.equal(tiles.length, map.hotspots.length);
  for (const t of tiles) assert.match(t, /href="#f-\d+"/);
  assert.match(html, /area: lines/i);
  // engine.js has the most fixes, so it carries the top heat step.
  const engine = tiles.find((t) => t.includes('data-path="src/core/engine.js"'));
  assert.match(engine, /class="tile h4/);
  const odd = tiles.find((t) => t.includes('data-fixes="0"'));
  assert.match(odd, /class="tile h0/);
});

test('a table view carries the treemap data', () => {
  const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
  for (const h of map.hotspots.filter((x) => !/[<>&"']/.test(x.path))) assert.ok(table.includes(h.path), h.path);
  assert.match(table, /<th scope="col">Fixes<\/th>/);
  assert.match(table, /820/);
});

test('every hot file gets its directive sentence, load bearing files included', () => {
  assert.match(html, /Before editing this file, run <code>npm test -- engine<\/code> and keep the job order stable\./);
  assert.match(html, /Before editing this file, run the archive round trip in test\/codec\.test\.js\./);
  assert.ok(html.includes('src/legacy/codec.js'));
});

test('co-change pairs and seams are listed with count and coupling', () => {
  const sec = html.slice(html.indexOf('id="co-change"'));
  assert.match(sec, /src\/core\/engine\.js[\s\S]*src\/net\/parser\.js[\s\S]*7 commits[\s\S]*64%/);
  assert.match(sec, /src\/core[\s\S]*src\/net/);
});

test('blind spots are listed, and files search tools skip are named one by one', () => {
  const sec = html.slice(html.indexOf('id="blind-spots"'));
  assert.match(sec, /2 generated or lock files excluded/);
  assert.match(sec, /<li><code>src\/net\/parser\.js<\/code><\/li>/);
  // The tile of a file search tools skip is marked as such, and the legend says so.
  assert.match(html, /hatched: search tools skip the file/);
  // GNU grep prints a notice for a binary file, so the page never says grep prints nothing.
  assert.doesNotMatch(html, /prints nothing/);
  assert.match(html, /<a class="tile[^"]*\bblind\b[^"]*"[^>]*data-path="src\/net\/parser\.js"/);
});

/* A hosted page is served under a Content-Security-Policy with no
   'unsafe-inline' for styles, and a browser drops every style attribute
   under it. The treemap places its tiles with SVG geometry attributes, so
   the same markup lays out in both places. */
test('the treemap is SVG and the markup carries no style attribute', () => {
  assert.ok(!/\sstyle=/.test(html), 'no style attribute anywhere');
  for (const kind of ['wide', 'tall']) {
    const at = html.indexOf(`<svg class="tm-svg ${kind}"`);
    assert.ok(at > 0, `the ${kind} layout is drawn`);
    const svg = html.slice(at, html.indexOf('</svg>', at));
    assert.equal((svg.match(/<a class="tile/g) || []).length, map.hotspots.length, `${kind}: one tile per hotspot`);
    for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
      const [x, y, w, h] = m.slice(1).map(Number);
      const [W, H] = kind === 'wide' ? [1000, 500] : [400, 500];
      assert.ok(x >= 0 && y >= 0 && x + w <= W + 0.01 && y + h <= H + 0.01, `${kind} tile inside the view box`);
    }
  }
});

test('reportParts gives the sections a hosted page composes, and the CSS a site file can carry', async () => {
  const { reportParts, REPORT_CSS, REPORT_JS } = await import('../src/render.js');
  const parts = reportParts(map, { repo: 'acme/widgets' });
  for (const k of ['facts', 'lede', 'hotspots', 'directives', 'coupling', 'blindSpots']) assert.equal(typeof parts[k], 'string', k);
  assert.match(parts.directives, /Before editing this file, run <code>npm test -- engine<\/code>/);
  assert.match(parts.hotspots, /<svg class="tm-svg wide"/);
  // Scoped: every rule sits under .cxr, so the site's own styles stay as they are.
  for (const rule of REPORT_CSS.replace(/@media[^{]*\{/g, '').split('}').map((r) => r.trim()).filter((r) => r && r.includes('{'))) {
    assert.match(rule, /^\.cxr\b/, rule.slice(0, 60));
  }
  assert.ok(!REPORT_CSS.includes('url('), 'the CSS fetches nothing');
  assert.ok(REPORT_JS.includes("querySelectorAll('.tile')"));
});

// The renderer reads the file names out of the NUL byte blind spot sentence.
// The sentence explains what each search tool does, and that explanation
// changes; the list after the colon and the git grep advice do not.
const grepList = (note) => {
  const out = renderReport({ front: { hotspots: [], blind_spots: [note] } }, { repo: 'x' });
  const sec = out.slice(out.indexOf('id="blind-spots"'));
  return [...sec.matchAll(/<li><code>([^<]*)<\/code><\/li>/g)].map((m) => m[1]);
};

test('files that search tools skip are found whatever the sentence says about the tools', () => {
  const files = 'src/a.js, src/b.js';
  const tail = '. Search with git grep -I --text, and fix the byte.';
  assert.deepEqual(grepList(`2 source files contain a NUL byte, so grep treats them as binary and skips them in silence: ${files}${tail}`), ['src/a.js', 'src/b.js']);
  assert.deepEqual(grepList(`2 source files contain a NUL byte, so ripgrep skips them with no match and no warning, and GNU grep prints a binary file notice and no line: ${files}${tail}`), ['src/a.js', 'src/b.js']);
  assert.deepEqual(grepList('2 generated or lock files excluded'), []);
});

test('the files a NUL byte hides are found in the blind spot the signals write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-render-nul-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/clean.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/late.js'), `// ${'x'.repeat(9000)}\nconst k = \`a\0b\`;\n`);
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  const note = computeSignals(dir).blind_spots.find((b) => /NUL byte/.test(b));
  assert.ok(note);
  assert.deepEqual(grepList(note), ['src/late.js']);
});

test('hostile file names are escaped in text and in attributes', () => {
  assert.ok(!html.includes('<script>alert'), 'a file name never opens a script element');
  assert.ok(!html.includes('<b>banner</b>'), 'prose never injects markup');
  assert.ok(html.includes('src/&lt;script&gt;alert(1)&lt;/script&gt;.js'));
  assert.ok(html.includes('lib/it&#39;s &quot;quoted&quot; &amp; odd.js'));
  // Every attribute value stays inside its quotes: no raw quote in a data-path.
  for (const m of html.matchAll(/data-path="([^"]*)"/g)) assert.ok(!/[<>']/.test(m[1]), m[1]);
  // The page has exactly one script element, its own.
  assert.equal((html.match(/<script\b/g) || []).length, 1);
});

test('the page loads nothing from the network', () => {
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
  assert.ok(!/<link\b/i.test(html), 'no stylesheet or icon links');
  assert.ok(!/\bsrc=/i.test(html), 'no src attribute anywhere');
  // url(#id) names a pattern in the same document and fetches nothing.
  assert.ok(!/@import|url\((?!#)/i.test(html), 'no CSS fetches');
  // The only http(s) text is the one outbound anchor to the project.
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(urls)], ['https://complex.md']);
  assert.match(html, /<a href="https:\/\/complex\.md">/);
});

test('the renderer is pure: the same map renders the same bytes', () => {
  assert.equal(renderReport(map, { repo: 'acme/widgets' }), html);
});

test('a hand written map without loc sizes tiles by churn and survives empty lists', () => {
  const small = parseComplexMd(`---\ncomplex_md: "0.3"\nhotspots:\n  - path: a.js\n    churn: 4\n    fixes: 1\n  - path: b.js\n    churn: 2\n    fixes: 0\nco_change: []\n---\n\n## Why these files are hot\n\na.js is the hub. Before editing this file, run the tests.\n`);
  const out = renderReport(small, { repo: 'x' });
  assert.match(out, /area: commits/i);
  assert.match(out, /Before editing this file, run the tests\./);
  assert.match(out, /No co-change pairs/);
  assert.match(out, /No blind spots/);
});

test('squarify fills the rectangle exactly and keeps every tile inside it', () => {
  const rects = squarify([6, 6, 4, 3, 2, 2, 1], 0, 0, 6, 4);
  const area = rects.reduce((s, r) => s + r.w * r.h, 0);
  assert.ok(Math.abs(area - 24) < 1e-9);
  for (const r of rects) {
    assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 6 + 1e-9 && r.y + r.h <= 4 + 1e-9);
  }
  assert.deepEqual(squarify([], 0, 0, 1, 1), []);
});
