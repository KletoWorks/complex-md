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

/* Block only rule files repeated what AGENTS.md or CLAUDE.md already loads.
   The per path briefs carry the value, so the copies go, including the
   ones an earlier version wrote. A file of the user's at one of those
   paths has no heading of ours and stays. */
test('no block only rule files when AGENTS.md carries the block, and old copies are removed', () => {
  const block = `---\nalwaysApply: false\n---\n${HEADING}\n\nold copy\n`;
  const dir = repo({
    '.claude/rules/complex-md.md': block,
    '.cursor/rules/complex-md.mdc': block,
    '.windsurf/rules/complex-md.md': block,
    '.agents/skills/complex-md.md': block,
    '.clinerules/complex-md.md': '# my own notes on complex-md\n',
  });
  const r = wire(dir, { agents: ['claude', 'cursor', 'windsurf', 'openhands', 'cline'] });
  for (const p of ['.claude/rules/complex-md.md', '.cursor/rules/complex-md.mdc', '.windsurf/rules/complex-md.md', '.agents/skills/complex-md.md']) {
    assert.ok(!existsSync(join(dir, p)), `${p} is gone`);
    assert.ok(!r.rules.includes(p), `${p} is not reported as written`);
  }
  assert.ok(r.removed.includes('.claude/rules/complex-md.md'));
  assert.equal(read(dir, '.clinerules/complex-md.md'), '# my own notes on complex-md\n', 'a file without our heading is not ours');
  assert.ok(readdirSync(join(dir, '.claude/rules/complex-md')).length > 0, 'the briefs stay');
  assert.ok(readdirSync(join(dir, '.cursor/rules/complex-md')).length > 0, 'the briefs stay');
});

test('a block only rule file is still written when no AGENTS.md carries the block', () => {
  const dir = repo({ 'GEMINI.md': '# Gemini\n', '.cursor': null });
  const r = wire(dir, { agents: ['cursor'] });
  assert.ok(!existsSync(join(dir, 'AGENTS.md')));
  assert.ok(r.rules.includes('.cursor/rules/complex-md.mdc'), 'Cursor does not read GEMINI.md');
  assert.match(read(dir, '.cursor/rules/complex-md.mdc'), new RegExp(HEADING));
});
