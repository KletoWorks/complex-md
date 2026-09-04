// The six MCP tools, called through the server's registered handlers
// against a synthetic repository, with and without a COMPLEX.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../src/mcp.js';
import { computeSignals } from '../src/signals.js';
import { frontMatter } from '../src/generate.js';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'test'));
  writeFileSync(join(dir, 'src/a.js'), 'export function alpha() { return 1; }\n');
  writeFileSync(join(dir, 'src/b.js'), "import { alpha } from './a.js';\nexport const b = alpha();\n");
  writeFileSync(join(dir, 'test/a.test.js'), "import { alpha } from '../src/a.js';\n");
  writeFileSync(join(dir, 'package.json'), '{ "name": "x", "scripts": { "test": "node --test" } }\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(dir, 'src/a.js'), `export function alpha() { return ${i + 2}; }\n`);
    writeFileSync(join(dir, 'src/b.js'), `import { alpha } from './a.js';\nexport const b = alpha() + ${i};\n`);
    g('add', '.');
    g('commit', '-q', '-m', i % 2 ? `fix: alpha off by one (${i})` : `feat: bump alpha (${i})`);
  }
  return dir;
}

const PROSE = '\n## Where the risk lives\n\nRisk sits in src/a.js, where 2 fixes landed.\n\n## Why these files are hot\n\nsrc/a.js defines alpha and every module reads it. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nsrc/a.js and src/b.js move together by design. Open both.\n\n## What to read first\n\n1. src/a.js: the root.\n';

function writeMap(dir) {
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(computeSignals(dir), 'test') + PROSE);
}

/** Call one registered tool the way the transport would, returning its text. */
async function call(server, name, args = {}) {
  const tool = server._registeredTools[name];
  assert.ok(tool, `${name} is registered`);
  const fn = tool.handler || tool.callback;
  const r = await fn(args, {});
  return r.content.map((c) => c.text).join('\n');
}

test('all six tools are registered', () => {
  const s = buildServer(makeRepo());
  assert.deepEqual(Object.keys(s._registeredTools).sort(), ['complex_check', 'complex_impact', 'complex_lookup', 'complex_refresh', 'complex_refs', 'complex_where_to_look']);
});

test('complex_lookup: row, paragraph, partners and covering tests with a map; a pointer without one', async () => {
  const dir = makeRepo();
  const bare = await call(buildServer(dir), 'complex_lookup', { path: 'src/a.js' });
  assert.match(bare, /No COMPLEX\.md at the repository root/);
  writeMap(dir);
  const out = await call(buildServer(dir), 'complex_lookup', { path: './src/a.js' });
  assert.match(out, /^src\/a\.js: hotspot \(source\)\. score \d+, loc 1, churn 6/);
  assert.match(out, /Before editing this file, run test\/a\.test\.js\./);
  assert.match(out, /Co-change partners: src\/b\.js \(6 commits together\)/);
  assert.match(out, /Covering tests: test\/a\.test\.js/);
  assert.match(out, /Test command: npm test/);
  const miss = await call(buildServer(dir), 'complex_lookup', { path: 'src/zzz.js' });
  assert.match(miss, /not in the hotspot table/);
  assert.match(miss, /Covering tests: none references this file/);
});

test('complex_where_to_look: ranked list with the risk summary from the map, live signals without it', async () => {
  const dir = makeRepo();
  const live = await call(buildServer(dir), 'complex_where_to_look', {});
  // Ordered by churn_w times loc: the two-line b.js outranks the one-line a.js.
  assert.match(live, /Check in this order:\n1\. src\/b\.js  fixes 2, churn 6, fan_in 0\n2\. src\/a\.js  fixes 2, churn 6, fan_in 1/);
  assert.match(live, /Live signals; no COMPLEX\.md present/);
  writeMap(dir);
  const mapped = await call(buildServer(dir), 'complex_where_to_look', { keywords: ['alpha'] });
  assert.match(mapped, /^Risk sits in src\/a\.js, where 2 fixes landed\./);
  assert.match(mapped, /1\. src\/a\.js .*matches 1 keyword/, 'a keyword hit in the paragraph re-ranks a.js first');
  assert.ok(!/Live signals/.test(mapped));
});

test('complex_impact: importers, partners, covering tests and the test command', async () => {
  const dir = makeRepo();
  const live = await call(buildServer(dir), 'complex_impact', { path: 'src/a.js' });
  assert.match(live, /^src\/a\.js \(source\): 1 dependent files/);
  assert.match(live, /- src\/b\.js/);
  assert.match(live, /Co-change partners: src\/b\.js \(6\)/, 'partners come from live signals without a map');
  assert.match(live, /Covering tests: test\/a\.test\.js/);
  assert.match(live, /Test command: npm test/);
  writeMap(dir);
  const mapped = await call(buildServer(dir), 'complex_impact', { path: 'src/b.js', limit: 1 });
  assert.match(mapped, /^src\/b\.js \(source\): 0 dependent files/);
  assert.match(mapped, /Co-change partners: src\/a\.js \(6\)/);
  assert.match(mapped, /Covering tests: none found/);
});

test('complex_refs: definitions and references, hotspots first, tests labeled', async () => {
  const dir = makeRepo();
  writeMap(dir);
  const out = await call(buildServer(dir), 'complex_refs', { symbol: 'alpha' });
  assert.match(out, /^alpha: 1 definition, 3 references in 2 files\./);
  assert.match(out, /Defined in:\n- src\/a\.js:1  \[hotspot\]/);
  assert.match(out, /- src\/b\.js:\d+  \[hotspot\]/);
  assert.match(out, /- test\/a\.test\.js:1  \[test\]/);
  assert.match(out, /Hotspots involved: src\/a\.js, src\/b\.js\. Run complex_lookup on each before editing\./);
  const none = await call(buildServer(dir), 'complex_refs', { symbol: 'nosuchsymbol' });
  assert.match(none, /^nosuchsymbol: 0 definitions, 0 references in 0 files\./);
});

test('complex_check: explicit files against the map; pointer without a map', async () => {
  const dir = makeRepo();
  assert.match(await call(buildServer(dir), 'complex_check', { files: ['src/a.js'] }), /No COMPLEX\.md at the repository root/);
  writeMap(dir);
  const s = buildServer(dir);
  const out = await call(s, 'complex_check', { files: ['src/a.js'] });
  assert.match(out, /^COMPLEX\.md check\nHotspots touched \(1\):\n- src\/a\.js/);
  assert.match(out, /Before editing this file, run test\/a\.test\.js\./);
  assert.match(out, /Co-change partners not touched \(1\):\n- src\/a\.js changed; unchanged partners: src\/b\.js \(6 commits together\)/);
  assert.match(out, /Run: test\/a\.test\.js  \(or npm test\)/);
  const clean = await call(s, 'complex_check', { files: ['src/a.js', 'src/b.js', 'package.json'] });
  assert.ok(!/partners not touched/.test(clean));
});

test('complex_refresh: live table, co-change and a stale-map notice', async () => {
  const dir = makeRepo();
  writeMap(dir);
  const s = buildServer(dir);
  const fresh = await call(s, 'complex_refresh', {});
  assert.match(fresh, /^Live signals at [0-9a-f]+: 2 rankable files, 2 dependency edges, 6 of the last 6 commits analyzed \(2 labeled fixes\)/);
  assert.match(fresh, /score\tpath\tkind\tloc\tchurn/);
  assert.match(fresh, /co_change:\n- src\/a\.js \+ src\/b\.js  \(6 shared commits, coupling 100%\)/);
  assert.match(fresh, /blind spots:\n- /);
  assert.ok(!/regenerate with/.test(fresh), 'map at HEAD is not stale');
  // One more commit makes the map stale.
  writeFileSync(join(dir, 'src/a.js'), 'export function alpha() { return 99; }\n');
  execFileSync('git', ['commit', '-q', '-am', 'feat: more'], { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  const stale = await call(buildServer(dir), 'complex_refresh', {});
  assert.match(stale, /COMPLEX\.md was generated at [0-9a-f]+; regenerate with `npx complex-md`/);
});
