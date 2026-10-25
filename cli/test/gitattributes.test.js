// Each generated path gets eol=lf and linguist-generated in a marked block
// of .gitattributes: LF on every checkout, so a Windows clone with
// core.autocrlf does not rewrite them, and folded in GitHub diffs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { readManifest } from '../src/manifest.js';
import { findRegion, outsideRegion } from '../src/markers.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const attr = (dir, path, name) => execFileSync('git', ['check-attr', name, '--', path], { cwd: dir, encoding: 'utf8' }).trim().split(': ').at(-1);

test('a default wire marks COMPLEX.md and the manifest as generated, with LF line endings', () => {
  const dir = repo();
  wire(dir, {});
  const region = findRegion(read(dir, '.gitattributes')).text;
  assert.match(region, /^# BEGIN complex-md \(spec [\d.]+\)$/m);
  assert.match(region, /^\/COMPLEX\.md eol=lf linguist-generated$/m);
  assert.match(region, /^\/\.complex-md\/manifest\.json eol=lf linguist-generated$/m);
  assert.equal(attr(dir, 'COMPLEX.md', 'eol'), 'lf');
  assert.equal(attr(dir, 'COMPLEX.md', 'linguist-generated'), 'set');
  assert.equal(attr(dir, 'AGENTS.md', 'linguist-generated'), 'unspecified', 'a file the user keeps is not marked');
});

test('the full profile lists every file wire wrote whole, and a rewire keeps the list current', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { profile: 'full' });
  const listed = (d) => [...findRegion(read(d, '.gitattributes')).text.matchAll(/^\/(\S+) eol=lf linguist-generated$/gm)].map((m) => m[1]).sort();
  const files = readManifest(dir).files.map((f) => f.path);
  assert.deepEqual(listed(dir), ['.complex-md/manifest.json', 'COMPLEX.md', ...files].sort());
  wire(dir, {});
  assert.deepEqual(listed(dir), ['.complex-md/manifest.json', 'COMPLEX.md'], 'the briefs left the list with the briefs');
});

test('an existing .gitattributes keeps its own lines, and unwire returns it byte for byte', () => {
  const user = '* text=auto\n*.png binary\n';
  const dir = repo({ '.gitattributes': user });
  const before = snapshot(dir);
  wire(dir, { profile: 'full' });
  const text = read(dir, '.gitattributes');
  assert.ok(text.startsWith(user));
  assert.equal(outsideRegion(text).replace(/\n+$/, '\n'), user);
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});
