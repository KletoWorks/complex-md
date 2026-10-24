// The paths a map's prose names, and the ones that do not exist. A map that
// sends an agent to a file the repository does not have is worse than no map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { namedPaths, inventedPaths } from '../src/paths.js';
import { trackedFiles } from '../src/git.js';

const FILES = ['src/a.js', 'src/lib/b.ts', 'README.md', 'app/[slug]/page.tsx', 'bin/tool', 'packages/x/src/index.ts'];

test('a path with a slash and an extension is a file the repository must have', () => {
  assert.deepEqual(inventedPaths('Edit src/a.js, then src/missing.js.', FILES), ['src/missing.js']);
});

test('punctuation, a possessive, a line number and a leading ./ do not change the path', () => {
  const prose = 'Open (src/a.js), src/a.js: and src/a.js\'s exports; see ./src/lib/b.ts:42 and `src/lib/b.ts`.';
  assert.deepEqual(inventedPaths(prose, FILES), []);
  assert.deepEqual(namedPaths(prose).map((p) => p.path), ['src/a.js', 'src/lib/b.ts']);
});

test('a suffix of a tracked path counts as that path', () => {
  assert.deepEqual(inventedPaths('src/index.ts holds the entry point.', FILES), []);
});

test('a directory counts when its first segment is a top level directory', () => {
  assert.deepEqual(inventedPaths('The src and src/lib areas move together; src/gone does not exist.', FILES), ['src/gone']);
  assert.deepEqual(inventedPaths('Use and/or, pass/fail, owner/repo and deepseek/deepseek-v4-pro freely.', FILES), []);
});

test('URLs, flags, globs, absolute paths and scoped packages are not repository paths', () => {
  const prose = 'See https://complex.md/spec, run with --for claude/cursor, match src/**/*.js, read /etc/hosts.conf and @scope/pkg.js.';
  assert.deepEqual(inventedPaths(prose, FILES), []);
});

test('a bare file name is judged only inside backticks', () => {
  assert.deepEqual(inventedPaths('Node.js runs a.js.', FILES), []);
  assert.deepEqual(inventedPaths('Read `a.js` and `nothere.py`.', FILES), ['nothere.py']);
});

test('route paths with brackets and files the tool writes are not invented', () => {
  assert.deepEqual(inventedPaths('app/[slug]/page.tsx renders it. Regenerate COMPLEX.md and read .complex-md/prompt.md.', FILES), []);
});

test("this repository's own map names no invented path", (t) => {
  const root = join(import.meta.dirname, '..', '..');
  if (!existsSync(join(root, 'COMPLEX.md'))) return t.skip('not a repository checkout');
  const text = readFileSync(join(root, 'COMPLEX.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  assert.deepEqual(inventedPaths(text, trackedFiles(root)), []);
});

test('a member access in backticks is code, not a file name', () => {
  const prose = 'Use `ky.create` and `response.ok`; `json.dumps` and `Signer.sign` run; `flag.Parse` and `Node.js` too. Go uses net/http.Request.';
  assert.deepEqual(inventedPaths(prose, [...FILES, 'src/main.go', 'signer.py']), []);
});

test('a file extension the repository uses still marks an invented name', () => {
  assert.deepEqual(inventedPaths('Read `routes.go` and `src/gone.go`.', ['src/main.go']), ['src/gone.go', 'routes.go']);
});
