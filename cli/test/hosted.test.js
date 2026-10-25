// scripts/hosted-pages.mjs: the export's maps.json in, static hosted map
// pages out. Owners, repository names and every path in a map come from
// strangers, so most of these tests feed it hostile input. Runs only inside
// the repository checkout; the published CLI package has no scripts/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { hostileInput, entry, cleanMap, RLO, LONG, SUBJECT } from './fixtures/hosted-maps.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts/hosted-pages.mjs');
const inCheckout = existsSync(SCRIPT) || existsSync(join(ROOT, 'scripts/build.mjs'));

/** Run the generator on an input object; returns { dir, out, status, stderr }. */
function run(input, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-hosted-'));
  const inFile = join(dir, 'maps.json');
  writeFileSync(inFile, typeof input === 'string' ? input : JSON.stringify(input));
  const out = join(dir, 'out');
  const r = spawnSync(process.execPath, [SCRIPT, '--in', inFile, '--out', out, ...args], { encoding: 'utf8' });
  return { dir, out, status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every file under dir, as relative paths, sorted. */
function files(dir) {
  const acc = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else acc.push(relative(dir, p));
    }
  };
  if (existsSync(dir)) walk(dir);
  return acc.sort();
}

const basic = () => ({
  version: 1,
  site: 'https://complex.md',
  exported_at: '2026-10-24T03:00:00Z',
  maps: [
    entry('Acme', 'Widgets.js'),
    entry('beta', 'thing', { indexable: false, raw_text: cleanMap({ hot: ['app/[slug]/page.tsx', 'lib/@scope/x.js'], pair: ['app/[slug]/page.tsx', 'lib/@scope/x.js'] }) }),
  ],
  committed: [{ repo_key: 'gamma/done', url: 'https://github.com/Gamma/Done/blob/main/COMPLEX.md' }],
});

test('the generator writes each page, its raw file, the index and the sitemap, and nothing else', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const input = basic();
  const r = run(input);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(files(r.out), [
    'acme/widgets.js/COMPLEX.md', 'acme/widgets.js/index.html',
    'beta/thing/COMPLEX.md', 'beta/thing/index.html',
    'maps/index.json', 'sitemap-maps.xml',
  ]);
  assert.equal(readFileSync(join(r.out, 'acme/widgets.js/COMPLEX.md'), 'utf8'), input.maps[0].raw_text, 'the raw file is raw_text exactly');
  assert.deepEqual(JSON.parse(readFileSync(join(r.out, 'maps/index.json'), 'utf8')), {
    maps: ['acme/widgets.js', 'beta/thing'],
    committed: { 'gamma/done': 'https://github.com/Gamma/Done/blob/main/COMPLEX.md' },
  });
  const sitemap = readFileSync(join(r.out, 'sitemap-maps.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.ok(sitemap.includes('<loc>https://complex.md/acme/widgets.js/</loc><lastmod>2026-10-20</lastmod>'));
  assert.ok(!sitemap.includes('beta/thing'), 'a page that is not indexable stays out of the sitemap');
  // Only the generator's own directory under the temp folder: nothing written beside it.
  assert.deepEqual(readdirSync(r.dir).sort(), ['maps.json', 'out']);
});

test('the same input gives byte identical output', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const a = run(hostileInput());
  const b = run(hostileInput());
  assert.equal(a.status, 0, a.stderr);
  const fa = files(a.out);
  assert.deepEqual(fa, files(b.out));
  for (const f of fa) assert.ok(readFileSync(join(a.out, f)).equals(readFileSync(join(b.out, f))), f);
});

test('a page leads with the directives, then the commit panel, the treemap, co-change and blind spots', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(basic());
  const html = readFileSync(join(r.out, 'acme/widgets.js/index.html'), 'utf8');
  const at = (s) => { const i = html.indexOf(s); assert.ok(i > 0, s); return i; };
  const order = [at('id="directives"'), at('id="commit"'), at('id="hotspots"'), at('id="co-change"'), at('id="blind-spots"'), at('class="prov"')];
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
  assert.match(html, /<h1>Acme\/Widgets\.js<\/h1>/, 'the name as GitHub spells it');
  assert.match(html, /Before editing this file, run <code>npm test -- engine<\/code>\./);
  const panel = html.slice(at('id="commit"'), at('id="hotspots"'));
  assert.match(panel, /<code>npx complex-md<\/code>/);
  assert.match(panel, /AGENTS\.md/);
  assert.match(panel, /Before editing a file listed under <code>hotspots<\/code> or <code>load_bearing<\/code> in COMPLEX\.md/);
});

test('the provenance line names the version, the commit, the date and the template, and links the raw file', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(basic());
  const html = readFileSync(join(r.out, 'acme/widgets.js/index.html'), 'utf8');
  const prov = html.slice(html.indexOf('class="prov"'));
  assert.match(prov, /Generated by complex-md 0\.10\.0 from public git history at commit <code>aaaaaaa<\/code> on 2026-10-20\./);
  assert.match(prov, /A template wrote the prose/);
  assert.match(prov, /href="\/acme\/widgets\.js\/COMPLEX\.md"/);
  assert.match(prov, /href="\/map\/remove\/\?repo=acme\/widgets\.js"/, 'the removal form, filled in for this page');
});

test('an indexable page is canonical to itself; any other is noindex and canonical to GitHub', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(basic());
  const yes = readFileSync(join(r.out, 'acme/widgets.js/index.html'), 'utf8');
  const no = readFileSync(join(r.out, 'beta/thing/index.html'), 'utf8');
  assert.match(yes, /<link rel="canonical" href="https:\/\/complex\.md\/acme\/widgets\.js\/">/);
  assert.doesNotMatch(yes, /noindex/);
  assert.match(no, /<meta name="robots" content="noindex">/);
  assert.match(no, /<link rel="canonical" href="https:\/\/github\.com\/beta\/thing">/);
});

test('a page runs under a strict policy: no inline script or style, nothing from another origin', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(hostileInput());
  for (const f of files(r.out).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join(r.out, f), 'utf8');
    assert.ok(!/<style\b/i.test(html), `${f}: no style element`);
    assert.ok(!/\sstyle=/i.test(html), `${f}: no style attribute`);
    for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) assert.ok(!/\son[a-z]+=/i.test(tag), `${f}: no event handler attribute: ${tag.slice(0, 80)}`);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) assert.match(m[1], /^ src="\/[a-z.-]+\.js" defer$/, `${f}: every script is a site file`);
    for (const m of html.matchAll(/<link rel="(stylesheet|icon|apple-touch-icon)" href="([^"]*)"/g)) assert.ok(m[2].startsWith('/'), `${f}: ${m[2]}`);
    assert.ok(!/\ssrc="(?!\/)/i.test(html), `${f}: every src is on this origin`);
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1];
    assert.ok(csp && !csp.includes('unsafe-inline') && /script-src 'self'/.test(csp) && /style-src 'self'/.test(csp), `${f}: ${csp}`);
  }
});

test('hostile identities are dropped, and nothing is written outside --out', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(hostileInput());
  assert.equal(r.status, 0, r.stderr);
  const pages = files(r.out).filter((f) => f.endsWith('/index.html') && !f.startsWith('maps/')).map((f) => f.replace(/\/index\.html$/, ''));
  assert.deepEqual(pages, ['acme/widgets.js', 'evil-org/trap', 'quiet/model-prose']);
  assert.deepEqual(readdirSync(r.dir).sort(), ['maps.json', 'out']);
  assert.ok(!existsSync(join(r.dir, '..', 'escape')));
  const index = JSON.parse(readFileSync(join(r.out, 'maps/index.json'), 'utf8'));
  assert.deepEqual(index.maps, pages);
  assert.deepEqual(index.committed, { 'acme/committed': 'https://github.com/acme/committed/blob/main/COMPLEX.md' }, 'a committed URL must be the GitHub file of the same repository');
  // The first of two entries for one repository wins.
  assert.ok(!readFileSync(join(r.out, 'acme/widgets.js/index.html'), 'utf8').includes('dup/first.js'));
  for (const why of ['reserved', 'commit_sha', 'generated_at', 'hosted: false', 'committed', 'front matter', 'raw_text']) assert.match(r.stderr, new RegExp(why.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `stderr says why: ${why}`);
});

test('hostile paths, prose and front matter never reach the page as markup', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(hostileInput());
  const html = readFileSync(join(r.out, 'evil-org/trap/index.html'), 'utf8');
  assert.equal((html.match(/<script\b/g) || []).length, 3, 'only the three site scripts');
  assert.ok(!html.includes('<img'), 'no image element from a blind spot or the prose');
  assert.ok(!html.includes('<b>'), 'no markup from the prose');
  assert.ok(!html.includes(RLO), 'no bidi control character');
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u202A-\u202E\u2066-\u2069]/.test(html), 'no control character');
  assert.ok(!html.includes('a'.repeat(300)), 'the 10,000 character path is dropped');
  assert.ok(!html.includes('etc/passwd'), 'a path that climbs out of the repository is dropped');
  assert.ok(!html.includes('sj.txt'), 'a path with a bidi override is dropped');
  assert.ok(!html.includes('script&gt;alert(1)'), 'a path outside the safe set is dropped, not just escaped');
  assert.ok(!html.includes('quoted'), 'a path with quotes is dropped');
  assert.ok(!html.includes('onerror'), 'the hostile blind spot and the image in the prose are gone or escaped away');
  assert.ok(!html.includes('Jane Doe') && !html.includes(SUBJECT.slice(0, 12)), 'no commit subject');
  assert.ok(!html.includes('data-path="src/closer.js"') && !html.includes('<code>src/closer.js</code></h3>'), 'a value that tried to close the front matter adds no file');
  assert.ok(!html.includes('hosted: true'), 'front matter written after an early close is not read as front matter, and its prose is left out');
  assert.ok(html.includes('src/core/engine.js') && html.includes('src/ok/after.js'), 'the safe paths stay');
  assert.ok(!html.includes('<dt>Commits read</dt>'), 'a count the map does not give is left out, not shown as 0');
  // Every attribute value stays inside its quotes.
  for (const m of html.matchAll(/\s[a-z-]+="([^"]*)"/g)) assert.ok(!/[<>]/.test(m[1]), m[1].slice(0, 80));
  assert.ok(Buffer.byteLength(html) < 200_000, `the page is capped: ${Buffer.byteLength(html)} bytes`);
  assert.equal(readFileSync(join(r.out, 'evil-org/trap/COMPLEX.md'), 'utf8'), hostileInput().maps[1].raw_text, 'the raw file stays exact; it is served as text');
});

test('a page shows template prose only: other prose is left out and the page says so', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const r = run(hostileInput());
  const html = readFileSync(join(r.out, 'quiet/model-prose/index.html'), 'utf8');
  assert.ok(!html.includes('Before editing this file, run'), 'no directive from model prose');
  assert.ok(!html.includes('Change risk concentrates'), 'no summary from model prose');
  assert.match(html, /leaves out the map's prose/);
  assert.ok(html.includes('src/core/engine.js'), 'the numbers stay');
});

test('lists are capped, so a map with many rows makes a bounded page', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const hot = Array.from({ length: 400 }, (_, i) => `src/m${i}.js`);
  const r = run({ version: 1, site: 'https://complex.md', maps: [entry('big', 'repo', { raw_text: cleanMap({ hot }) })], committed: [] });
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(join(r.out, 'big/repo/index.html'), 'utf8');
  const svg = html.slice(html.indexOf('<svg class="tm-svg wide"'), html.indexOf('</svg>', html.indexOf('<svg class="tm-svg wide"')));
  assert.equal((svg.match(/<a class="tile/g) || []).length, 25);
  assert.ok(Buffer.byteLength(html) < 200_000, `${Buffer.byteLength(html)} bytes`);
});

test('bad usage and a bad input file exit 2 and write nothing', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const none = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /usage: node scripts\/hosted-pages\.mjs --in maps\.json --out <dir>/);
  for (const bad of ['not json', JSON.stringify({ version: 2, maps: [] }), JSON.stringify({ version: 1 })]) {
    const r = run(bad);
    assert.equal(r.status, 2, bad);
    assert.ok(!existsSync(r.out), 'nothing written');
  }
});

test('the generator refuses an owner that site/reserved.json reserves, whatever its case', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const reserved = JSON.parse(readFileSync(join(ROOT, 'site/reserved.json'), 'utf8')).filter((n) => /^[a-z0-9-]+$/.test(n));
  const maps = reserved.map((n) => entry(n.toUpperCase(), 'repo'));
  const r = run({ version: 1, site: 'https://complex.md', maps, committed: [] });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(r.out, 'maps/index.json'), 'utf8')).maps, []);
  mkdirSync(r.out, { recursive: true });
});

/* A hosted page loads its styles and scripts from the site. Each local file
   it names must be in the site build, or the page renders unstyled. The two
   files platform-api serves are the exception. */
test('the site build carries every file a hosted page loads', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const site = mkdtempSync(join(tmpdir(), 'cx-hosted-site-'));
  spawnSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', site], { encoding: 'utf8' });
  const r = run(basic());
  const html = readFileSync(join(r.out, 'acme/widgets.js/index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"?#]*\.(?:css|js|svg|png))"/g)].map((m) => m[1]).filter((u) => !u.startsWith('/acme/'));
  for (const u of new Set(refs)) {
    if (u === '/platform.css' || u === '/analytics.js') continue;
    assert.ok(existsSync(join(site, u)), `the site build has ${u}`);
  }
  const { REPORT_CSS, REPORT_JS } = await import('../src/render.js');
  assert.equal(readFileSync(join(site, 'report.css'), 'utf8'), REPORT_CSS);
  assert.equal(readFileSync(join(site, 'report.js'), 'utf8'), REPORT_JS);
});
