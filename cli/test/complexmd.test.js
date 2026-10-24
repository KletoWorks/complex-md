/* Reading a COMPLEX.md: which paragraph belongs to which path.
 *
 * The paragraph a lookup returns is the text the edit gate, the Stop report,
 * `check`, the briefs and the MCP server all hand to an agent. A paragraph
 * about another file is worse than none, because it reads as authoritative.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComplexMd } from '../src/complexmd.js';

const MONOREPO = `---
complex_md: "0.3"
hotspots:
  - path: packages/server/src/core/index.ts
    churn: 9
    fixes: 4
    score: 900
  - path: packages/server/src/adapters/http/index.ts
    churn: 6
    fixes: 2
    score: 400
  - path: src/index.ts
    churn: 3
    fixes: 1
    score: 100
  - path: packages/server/src/router.ts
    churn: 5
    fixes: 2
    score: 300
co_change:
  - files: [packages/server/src/core/index.ts, packages/server/src/router.ts]
    count: 4
    coupling: 80
---

## Where the risk lives

x

## Why these files are hot

packages/server/src/core/index.ts re-exports the public API. Every package imports it. Before editing this file, run the core suite.

packages/server/src/adapters/http/index.ts turns a request into a call. Before editing this file, run the adapter tests.

The router in router.ts dispatches every call. Before editing this file, run the router tests.

## Change coupling

packages/server/src/core/index.ts and packages/server/src/router.ts move together. Open both.

## What to read first

1. packages/server/src/core/index.ts
`;

test('a file that shares a basename gets its own paragraph, not the first index.ts', () => {
  const m = parseComplexMd(MONOREPO);
  assert.match(m.paragraphFor('packages/server/src/adapters/http/index.ts'), /turns a request into a call/);
  assert.equal(m.directive('packages/server/src/adapters/http/index.ts'), 'Before editing this file, run the adapter tests.');
  assert.match(m.paragraphFor('packages/server/src/core/index.ts'), /re-exports the public API/);
});

test('a path is not matched inside a longer path that ends with it', () => {
  const m = parseComplexMd(MONOREPO);
  assert.equal(m.paragraphFor('src/index.ts'), null, 'src/index.ts has no paragraph of its own');
  assert.equal(m.directive('src/index.ts'), null);
  assert.deepEqual(m.couplingFor('src/index.ts'), []);
});

test('a basename alone still finds the paragraph when no other mapped path shares it', () => {
  const m = parseComplexMd(MONOREPO);
  assert.match(m.paragraphFor('packages/server/src/router.ts'), /dispatches every call/);
  assert.equal(m.couplingFor('packages/server/src/router.ts').length, 1);
});

test('a basename alone never matches a path the map does not list', () => {
  const m = parseComplexMd(MONOREPO);
  assert.equal(m.paragraphFor('packages/client/src/router.ts'), null);
});
