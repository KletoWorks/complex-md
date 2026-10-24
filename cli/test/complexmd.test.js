/* Reading a COMPLEX.md: which paragraph belongs to which path.
 *
 * The paragraph a lookup returns is the text the edit gate, the Stop report,
 * `check`, the briefs and the MCP server all hand to an agent. A paragraph
 * about another file is worse than none, because it reads as authoritative.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseComplexMd, loadComplexMd, parseFrontMatter } from '../src/complexmd.js';

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

/* Route based frameworks name files with brackets, parentheses and a plus
   sign: app/[slug]/page.tsx, app/(shop)/cart/page.tsx, src/routes/+page.svelte.
   A paragraph that names such a path in full must still be found. */
test('a path with brackets, parentheses or a plus sign finds its paragraph', () => {
  const paths = ['app/[slug]/page.tsx', 'app/(shop)/cart/page.tsx', 'src/routes/+page.svelte', 'lib/a b.ts'];
  const map = '---\ncomplex_md: "0.3"\nhotspots:\n' + paths.map((p) => `  - path: ${p}\n    score: 1\n`).join('') +
    '---\n\n## Why these files are hot\n\n' + paths.map((p, i) => `\`${p}\` is hot for reason ${i}.`).join('\n\n') + '\n';
  const m = parseComplexMd(map);
  paths.forEach((p, i) => assert.match(m.paragraphFor(p) || '', new RegExp(`reason ${i}\\.`), p));
  assert.equal(m.paragraphFor('app/(shop)/page.tsx'), null, 'a path is not found inside a longer one');
});

test('a full path counts after ./ and before sentence punctuation, never inside a longer name', () => {
  const map = '---\ncomplex_md: "0.3"\nhotspots:\n  - path: src/a.ts\n    score: 1\n  - path: src/b.ts\n    score: 1\n  - path: src/c.ts\n    score: 1\n' +
    '---\n\n## Why these files are hot\n\nEdit ./src/a.ts with care.\n\nThe last one is src/b.ts.\n\nSee src/c.ts.bak and lib/src/c.ts only.\n';
  const m = parseComplexMd(map);
  assert.match(m.paragraphFor('src/a.ts') || '', /with care/);
  assert.match(m.paragraphFor('src/b.ts') || '', /last one/);
  assert.equal(m.paragraphFor('src/c.ts'), null);
});

/* Git for Windows checks text out with CRLF line ends by default
   (core.autocrlf=true). A teammate on Windows who cloned a repository with a
   committed map got a map that parsed to null, so every hook went silent. */
test('a CRLF checkout of the map parses the same as the LF original', () => {
  const lf = parseComplexMd(MONOREPO);
  const crlf = parseComplexMd(MONOREPO.replace(/\n/g, '\r\n'));
  assert.ok(crlf, 'a CRLF map is still a map');
  assert.deepEqual(crlf.front, lf.front);
  assert.deepEqual(crlf.sections, lf.sections);
  const path = 'packages/server/src/adapters/http/index.ts';
  assert.equal(crlf.paragraphFor(path), lf.paragraphFor(path));
  assert.equal(crlf.directive(path), 'Before editing this file, run the adapter tests.');
  assert.ok(!/\r/.test(JSON.stringify(crlf.front)), 'no carriage return survives in a value');
});

test('a CRLF map on disk loads, and a leading byte order mark is ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-crlf-'));
  writeFileSync(join(dir, 'COMPLEX.md'), '\uFEFF' + MONOREPO.replace(/\n/g, '\r\n'));
  const m = loadComplexMd(dir);
  assert.ok(m, 'loadComplexMd returns the map');
  assert.equal(m.hotspots.length, 4);
  assert.equal(m.row('src/index.ts').score, 100);
});

test('parseFrontMatter accepts CRLF input on its own', () => {
  const fm = parseFrontMatter('complex_md: "0.3"\r\nhotspots:\r\n  - path: a.js\r\n    score: 5\r\n');
  assert.equal(fm.complex_md, '0.3');
  assert.deepEqual(fm.hotspots, [{ path: 'a.js', score: 5 }]);
});

test('a paragraph that names the full path beats an earlier mention of the basename', () => {
  // The first paragraph names generate.js by its basename near its start.
  // The second paragraph is the file's own, and it names the full path a
  // little later in its text. Position alone would pick the first one.
  const m = parseComplexMd(`---\ncomplex_md: "0.3"\nhotspots:\n  - path: cli/src/signals.js\n  - path: cli/src/generate.js\n---\n\n## Why these files are hot\n\ncli/src/signals.js hands its rows to generate.js. Before editing this file, run test/signals.test.js.\n\nThe model call and the reply checks live in cli/src/generate.js. Before editing this file, run test/generate.test.js.\n`);
  assert.equal(m.directive('cli/src/generate.js'), 'Before editing this file, run test/generate.test.js.');
  assert.equal(m.directive('cli/src/signals.js'), 'Before editing this file, run test/signals.test.js.');
});

test('among suffix mentions of a path, the earliest one wins', () => {
  const m = parseComplexMd(`---\ncomplex_md: "0.3"\nhotspots:\n  - path: lib/core/router.js\n  - path: lib/core/server.js\n---\n\n## Why these files are hot\n\nThe server in server.js starts every listener and calls router.js. Before editing this file, run the server tests.\n\nrouter.js dispatches each request. Before editing this file, run the router tests.\n`);
  assert.equal(m.directive('lib/core/router.js'), 'Before editing this file, run the router tests.');
  assert.equal(m.directive('lib/core/server.js'), 'Before editing this file, run the server tests.');
});
