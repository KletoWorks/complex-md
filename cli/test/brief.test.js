/* Per path briefs: the payload arrives at the path, not a pointer to it.
 *
 * What these protect, which the wiring tests do not: that a brief says only
 * what the map asserts about that path, that the directory is cleared so a
 * brief never outlives the listing that produced it, and that a path which is
 * only a co-change partner is not introduced as a risky file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseComplexMd } from '../src/complexmd.js';
import { briefFor, pathBriefs, slugFor } from '../src/brief.js';

const MAP = parseComplexMd(`---
complex_md: "0.3"
hotspots:
  - path: src/core.js
    churn: 9
    fixes: 3
    fan_in: 5
    tests: 1
    score: 900
load_bearing:
  - path: src/legacy.js
    fan_in: 6
    tests: 0
co_change:
  - files: [src/render.js, src/render.css]
    count: 4
    coupling: 100
---

## Where the risk lives

x

## Why these files are hot

src/core.js is the hub every module imports. Before editing this file, run test/core.test.js.

## Change coupling

x

## What to read first

1. src/core.js
`);

test('a brief carries the numbers, the paragraph, the partners and the directive', () => {
  const t = briefFor(MAP, 'src/core.js');
  assert.match(t, /^# src\/core\.js/m);
  assert.match(t, /churn 9 {2}fixes 3 {2}fan_in 5 {2}tests 1/);
  assert.match(t, /is the hub every module imports/);
  assert.match(t, /\*\*Before editing this file, run test\/core\.test\.js\.\*\*/);
});

test('a load bearing file is described as load bearing, not as churning', () => {
  const t = briefFor(MAP, 'src/legacy.js');
  assert.match(t, /Load bearing/);
  assert.doesNotMatch(t, /edits are risky/);
});

test('a co-change partner that is not ranked is not called risky', () => {
  const t = briefFor(MAP, 'src/render.css');
  assert.match(t, /Not ranked in COMPLEX\.md/);
  assert.doesNotMatch(t, /edits are risky/);
  assert.match(t, /src\/render\.js \(100% of this file's commits, 4 together\)/);
});

test('a path the map says nothing about gets no brief', () => {
  assert.equal(briefFor(MAP, 'src/unknown.js'), null);
});

test('pathBriefs covers hotspots, load bearing and partners, in a stable order', () => {
  const a = pathBriefs(MAP).map((b) => b.path);
  const b = pathBriefs(MAP).map((x) => x.path);
  assert.deepEqual(a, b, 'stable across runs');
  assert.deepEqual(a, ['src/core.js', 'src/legacy.js', 'src/render.css', 'src/render.js']);
});

test('slugs are filename safe and do not collide across similar paths', () => {
  const s1 = slugFor('a/b.js');
  const s2 = slugFor('a-b.js');
  assert.notEqual(s1, s2, 'a/b.js and a-b.js must not share a filename');
  for (const s of [s1, s2, slugFor('src/app/views/Chat.tsx')]) {
    assert.match(s, /^[A-Za-z0-9._-]+$/);
  }
});

test('wiring clears briefs for paths the map no longer lists', async () => {
  const { wire } = await import('../src/wire.js');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');

  const dir = mkdtempSync(join(tmpdir(), 'cx-brief-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/core.js'), 'export const a = 1;\n');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));

  /* A brief left over from an earlier run, for a path the map has since
     dropped. Advice nothing recomputes is worse than no advice. */
  const rulesDir = join(dir, '.claude/rules/complex-md');
  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(join(rulesDir, 'stale-file-abcdef.md'), '# src/gone.js\n');

  wire(dir, { agents: ['claude'] });
  const files = existsSync(rulesDir) ? readdirSync(rulesDir) : [];
  assert.ok(!files.includes('stale-file-abcdef.md'), 'the stale brief is removed');
  assert.ok(files.length > 0, 'current briefs are written');
  assert.ok(
    files.some((f) => readFileSync(join(rulesDir, f), 'utf8').includes('paths: src/core.js')),
    'each brief is scoped to its own path',
  );
});
