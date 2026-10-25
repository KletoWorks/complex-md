// .complex-md/manifest.json records every file and block wire wrote, with
// a hash of what it wrote, so unwire can tell what is complex-md's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { MANIFEST_PATH, readManifest } from '../src/manifest.js';
import { findRegion, normalizedHash } from '../src/markers.js';
import { ignoreWorkDir } from '../src/gitignore.js';

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-man-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

test('the manifest lists every file and block wire wrote, each with the hash of what it wrote', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n', 'REVIEW.md': '# Review\n', '.claude': null, '.cursor': null });
  wire(dir, { agents: ['claude', 'cursor', 'review'], profile: 'full' });
  const m = readManifest(dir);
  assert.equal(m.generator.name, 'complex-md');
  assert.match(m.spec, /^\d+\.\d+$/);
  const blocks = m.blocks.map((b) => b.path);
  assert.deepEqual(blocks.filter((p) => p !== '.gitattributes').sort(), ['AGENTS.md', 'REVIEW.md']);
  for (const b of m.blocks) assert.equal(b.sha256, normalizedHash(findRegion(read(dir, b.path)).text), b.path);
  assert.ok(m.files.length >= 8, `${m.files.length} files`);
  for (const f of m.files) assert.equal(f.sha256, normalizedHash(read(dir, f.path)), f.path);
  assert.ok(m.files.some((f) => f.path.startsWith('.claude/rules/complex-md/')));
  assert.ok(m.files.some((f) => f.path.startsWith('.cursor/rules/complex-md/')));
  assert.ok(statSync(join(dir, MANIFEST_PATH)).size < 8192, 'small enough to commit and read');
});

test('a second wire leaves the manifest byte identical', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const first = read(dir, MANIFEST_PATH);
  wire(dir, { agents: ['claude'], profile: 'full' });
  assert.equal(read(dir, MANIFEST_PATH), first);
  assert.doesNotMatch(first, /"(date|time|timestamp)"/, 'no clock in the manifest, so a rewire is no diff');
});

test('the manifest stays committable under the .gitignore entry for the working files', () => {
  const dir = repo();
  ignoreWorkDir(dir);
  wire(dir, {});
  assert.ok(existsSync(join(dir, MANIFEST_PATH)));
  const ignored = spawnSync('git', ['check-ignore', '-q', MANIFEST_PATH], { cwd: dir });
  assert.equal(ignored.status, 1, 'git does not ignore the manifest');
  const prompt = spawnSync('git', ['check-ignore', '-q', '.complex-md/prompt.md'], { cwd: dir });
  assert.equal(prompt.status, 0, 'the working files stay ignored');
});

test('a wire that finds the manifest ignored says how to commit it', () => {
  const dir = repo({ '.gitignore': '.complex-md/\n' });
  const lines = [];
  wire(dir, { log: (s) => lines.push(s) });
  assert.ok(lines.some((l) => l.includes('!.complex-md/manifest.json')), lines.join('\n'));
});
