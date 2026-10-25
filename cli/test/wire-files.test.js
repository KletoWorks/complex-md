// Which files wire creates, and which it never creates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

export function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-files-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

/* Claude Code reads AGENTS.md when the repository has no CLAUDE.md. A new
   root CLAUDE.md turns that off and stops nested AGENTS.md files from
   loading, so wire never creates one. */
test('no CLAUDE.md is created beside a lone AGENTS.md', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n', '.claude': null });
  const r = wire(dir, { agents: ['claude'], profile: 'full' });
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
  assert.ok(!r.created.includes('CLAUDE.md'));
});

test('with no agent file at all, wire creates AGENTS.md and no CLAUDE.md', () => {
  const dir = repo({ '.claude': null });
  const r = wire(dir, { agents: ['claude'], profile: 'full' });
  assert.deepEqual(r.created, ['AGENTS.md']);
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
});

test('Claude Code with only a GEMINI.md gets an AGENTS.md, not a CLAUDE.md', () => {
  const dir = repo({ 'GEMINI.md': '# Gemini\n', '.claude': null });
  const r = wire(dir, { agents: ['claude'], profile: 'full' });
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
  assert.ok(r.created.includes('AGENTS.md'));
  assert.match(read(dir, 'AGENTS.md'), /## COMPLEX\.md: the structural risk map/);
});
