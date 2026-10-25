// site/reserved.json names the first path segments that never name a
// repository owner on complex.md. Hosted map pages live at /OWNER/REPO, so
// a page under a site path would hide it, and the hosted page generator
// and the server routes read this one list. Runs only inside the
// repository checkout; the published CLI package has no site/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const reserved = () => JSON.parse(readFileSync(join(ROOT, 'site/reserved.json'), 'utf8'));

// The paths the server routes and the export rely on, besides the built site.
const ROUTED = ['spec', 'skill', 'articles', 'bench', 'map', 'maps', 'r', 'schema', 'api', 'fonts', 'icons', 'logos', 'assets',
  'collect', 'analytics.js', 'platform.css', 'robots.txt', 'sitemap.xml', 'sitemap-maps.xml', 'llms.txt', 'llms-full.txt'];

test('reserved.json is a sorted list of unique lower case names, with every routed path', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const list = reserved();
  assert.ok(Array.isArray(list) && list.every((s) => typeof s === 'string' && s && s === s.toLowerCase() && !s.includes('/')));
  assert.deepEqual(list, [...new Set(list)].sort(), 'sorted, no duplicates');
  for (const name of ROUTED) assert.ok(list.includes(name), `reserves ${name}`);
});

test('every top level name the site build writes is reserved', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const out = mkdtempSync(join(tmpdir(), 'cx-reserved-'));
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', out], { stdio: 'pipe' });
  const list = new Set(reserved());
  const missing = readdirSync(out).filter((name) => !list.has(name.toLowerCase()));
  assert.deepEqual(missing, [], 'add each new top level name to site/reserved.json');
});
