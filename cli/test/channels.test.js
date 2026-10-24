// Wiring channels: which file each agent or review bot reads, and that
// complex-md writes each piece of context once, where that reader looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';

const HEADING = '## COMPLEX.md: the structural risk map';
const count = (text, s) => text.split(s).length - 1;
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

/* A repository with the brief fixture as its map: one hotspot, one load
   bearing file and one co-change pair, so four briefed paths. */
function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-ch-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

test('a CLAUDE.md or GEMINI.md that imports AGENTS.md gets no second copy of the block', () => {
  const dir = repo({
    'AGENTS.md': '# House rules\n\nNever rebase a shared branch.\n',
    'CLAUDE.md': '@AGENTS.md\n',
    'GEMINI.md': '# Gemini\n\n@./AGENTS.md\n',
  });
  const r = wire(dir, { agents: ['claude'] });
  assert.equal(count(read(dir, 'AGENTS.md'), HEADING), 1, 'AGENTS.md carries the block');
  assert.equal(count(read(dir, 'CLAUDE.md'), HEADING), 0, 'CLAUDE.md reads it through the import');
  assert.equal(count(read(dir, 'GEMINI.md'), HEADING), 0, 'GEMINI.md reads it through the import');
  assert.match(read(dir, 'CLAUDE.md'), /^@COMPLEX\.md$/m, 'the map import is still added');
  assert.deepEqual(r.primary.filter((f) => !f.includes('import')), ['AGENTS.md']);
  assert.ok(r.skipped.includes('CLAUDE.md') && r.skipped.includes('GEMINI.md'));
});

test('a CLAUDE.md without the import still gets the block', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n', 'CLAUDE.md': '# Claude notes\n' });
  wire(dir, { agents: ['claude'] });
  assert.equal(count(read(dir, 'AGENTS.md'), HEADING), 1);
  assert.equal(count(read(dir, 'CLAUDE.md'), HEADING), 1);
});
