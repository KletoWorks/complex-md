#!/usr/bin/env node
// Build the hosted map pages from the export's maps.json:
//
//   node scripts/hosted-pages.mjs --in maps.json --out <dir>
//
// It writes, under <dir> only, for each page:
//
//   <repo_key>/index.html   the page
//   <repo_key>/COMPLEX.md   the raw map
//   <repo_key>/og.png       its Open Graph image, 1200 by 630 (og-image.mjs)
//
// and, once, maps/index.json for the /map lookup and sitemap-maps.xml with
// the indexable pages. <repo_key> is the lower case owner/name. A step that
// publishes the tree copies every file of each page folder, og.png
// included: the page names its image by absolute URL. No network, no clock:
// the same input gives the same bytes. An entry that fails a check is
// left out with one line on stderr, and the run still exits 0. A missing
// argument or an unreadable input exits 2 and writes nothing. Pass an empty
// <dir>: the command adds files and removes none.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { checkEntry, checkCommitted, renderHostedPage, ogFacts, sitemap, mapsIndex, siteOf, LIMITS } from './hosted.mjs';
import { renderOgImage } from './og-image.mjs';

const USAGE = 'usage: node scripts/hosted-pages.mjs --in maps.json --out <dir>';
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const fail = (msg) => { console.error(msg); process.exit(2); };

const inFile = opt('--in');
const outArg = opt('--out');
if (!inFile || !outArg) fail(USAGE);

let input;
try {
  input = JSON.parse(readFileSync(inFile, 'utf8'));
} catch (e) {
  fail(`hosted-pages: cannot read ${inFile} as JSON: ${e.message}`);
}
if (!input || input.version !== 1 || !Array.isArray(input.maps)) fail('hosted-pages: the input needs "version": 1 and a "maps" list');

const out = resolve(outArg);
const site = siteOf(input.site);
const { committed, dropped: badCommitted } = checkCommitted(input.committed);
for (const k of badCommitted) console.error(`hosted-pages: committed entry ${JSON.stringify(k)} dropped: its url is not the COMPLEX.md file of that repository on GitHub`);

const pages = [];
const seen = new Set();
const committedKeys = new Set(Object.keys(committed));
for (const [i, e] of input.maps.entries()) {
  const repoKey = typeof e?.repo_key === 'string' ? e.repo_key.slice(0, 100) : '?';
  const label = `maps[${i}] (${JSON.stringify(repoKey)})`;
  const reject = (reason) => console.error(`hosted-pages: ${label} dropped: ${reason}`);
  try {
    const r = checkEntry(e, { committed: committedKeys });
    if (r.drop) { reject(r.drop); continue; }
    if (seen.has(r.page.key)) { reject(`a second entry for ${r.page.key}`); continue; }
    const html = renderHostedPage(r.page, { site });
    if (Buffer.byteLength(html) > LIMITS.page) { reject(`the page is over ${LIMITS.page} bytes`); continue; }
    const og = renderOgImage(ogFacts(r.page));
    seen.add(r.page.key);
    pages.push({ ...r.page, html, og });
  } catch (error) {
    reject(error instanceof Error ? error.message : 'unknown error');
  }
}
pages.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

/** A path under out, or an error: the checks above make this unreachable. */
function under(...segs) {
  const p = resolve(out, ...segs);
  if (!p.startsWith(out + sep)) throw new Error(`refusing to write outside ${out}: ${p}`);
  return p;
}

for (const p of pages) {
  const [owner, name] = p.key.split('/');
  const dir = under(owner, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), p.html);
  writeFileSync(join(dir, 'COMPLEX.md'), p.raw);
  writeFileSync(join(dir, 'og.png'), p.og);
}
mkdirSync(under('maps'), { recursive: true });
writeFileSync(under('maps', 'index.json'), mapsIndex(pages, committed));
writeFileSync(under('sitemap-maps.xml'), sitemap(pages, site));

const indexed = pages.filter((p) => p.indexable).length;
console.log(`hosted-pages: wrote ${pages.length} pages (${indexed} indexable), ${Object.keys(committed).length} committed, to ${out}`);
