// Two wiring profiles. minimal, the default, adds one marked line near the
// top of AGENTS.md and records it. full adds the integration block and at
// most ten briefs per agent. --for implies full, since it names agents
// whose files the user wants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { INTEGRATION_LINE } from '../src/prompts.js';
import { findRegion, outsideRegion } from '../src/markers.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const HEADING = '## COMPLEX.md: the structural risk map';
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

function changed(before, after) {
  const out = [];
  for (const [p, v] of after) if (v !== null && before.get(p) !== v) out.push(p);
  for (const [p, v] of before) if (v !== null && !after.has(p)) out.push(p);
  return out.sort();
}

const BUSY = {
  'AGENTS.md': '# AGENTS.md\n\nNever rebase a shared branch.\n',
  'REVIEW.md': '# Review\n',
  '.github/copilot-instructions.md': '# Copilot\n',
  '.claude': null,
  '.cursor': null,
  '.kiro': null,
};

test('the one line is short and names COMPLEX.md', () => {
  assert.ok(!INTEGRATION_LINE.includes('\n'));
  assert.match(INTEGRATION_LINE, /COMPLEX\.md/);
  assert.ok(INTEGRATION_LINE.split(/\s+/).length <= 40, INTEGRATION_LINE);
});

test('a default wire writes one marked line near the top of AGENTS.md, and no brief', () => {
  const dir = repo(BUSY);
  const before = snapshot(dir);
  const r = wire(dir, {});
  const agents = read(dir, 'AGENTS.md');
  assert.ok(agents.startsWith(`# AGENTS.md\n\n<!-- BEGIN complex-md (spec 0.3) -->\n${INTEGRATION_LINE}\n<!-- END complex-md (spec 0.3) -->\n\nNever rebase`), agents);
  assert.ok(!agents.includes(HEADING), 'no block');
  const files = changed(before, snapshot(dir)).filter((p) => p !== '.gitattributes');
  assert.deepEqual(files, ['.complex-md/manifest.json', 'AGENTS.md']);
  assert.deepEqual(r.rules, []);
});

test('a default wire puts the line in a CLAUDE.md or GEMINI.md that does not import AGENTS.md', () => {
  const dir = repo({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': '# Claude\n', 'GEMINI.md': '@AGENTS.md\n' });
  wire(dir, {});
  assert.equal(findRegion(read(dir, 'CLAUDE.md')).text.split('\n')[1], INTEGRATION_LINE);
  assert.equal(read(dir, 'GEMINI.md'), '@AGENTS.md\n', 'GEMINI.md reads AGENTS.md through its import');
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /^@COMPLEX\.md/m, 'no import of the whole map');
});

test('with no agent file, a default wire creates AGENTS.md holding the line', () => {
  const dir = repo();
  const r = wire(dir, {});
  assert.deepEqual(r.created, ['AGENTS.md']);
  assert.ok(read(dir, 'AGENTS.md').includes(INTEGRATION_LINE));
  assert.ok(!read(dir, 'AGENTS.md').includes(HEADING));
});

test('--profile full writes the block and the briefs', () => {
  const dir = repo(BUSY);
  const r = wire(dir, { profile: 'full' });
  assert.ok(findRegion(read(dir, 'AGENTS.md')).text.includes(HEADING));
  assert.ok(existsSync(join(dir, '.claude/rules/complex-md')));
  assert.ok(r.rules.length >= 3, r.rules.join(', '));
});

test('--for implies the full profile', () => {
  const dir = repo(BUSY);
  wire(dir, { agents: ['claude'] });
  assert.ok(existsSync(join(dir, '.claude/rules/complex-md')));
});

test('a minimal rewire after a full wire removes the briefs and puts the line in place of the block', () => {
  const dir = repo(BUSY);
  const before = snapshot(dir);
  wire(dir, { profile: 'full' });
  const full = read(dir, 'AGENTS.md');
  wire(dir, {});
  const agents = read(dir, 'AGENTS.md');
  assert.equal(outsideRegion(agents), outsideRegion(full), 'the text outside the markers is unchanged');
  assert.ok(findRegion(agents).text.includes(INTEGRATION_LINE));
  assert.ok(!existsSync(join(dir, '.claude/rules/complex-md')), 'the briefs and their folder are gone');
  assert.ok(!existsSync(join(dir, '.kiro/steering')));
  assert.equal(read(dir, 'REVIEW.md'), '# Review\n', 'the REVIEW.md include is gone');
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('an unknown profile is refused before any write', () => {
  const dir = repo(BUSY);
  const before = snapshot(dir);
  assert.throws(() => wire(dir, { profile: 'max' }), /profile.*minimal.*full/);
  assert.deepEqual(snapshot(dir), before);
});

/* Codex reads AGENTS.override.md in place of AGENTS.md in the same
   folder, and other agents read only AGENTS.md. So the line goes into
   both when both exist. */
test('the line goes into AGENTS.override.md as well when it exists', () => {
  const dir = repo({ 'AGENTS.md': '# Rules\n', 'AGENTS.override.md': '# Local override\n\nUse the staging database.\n' });
  const before = snapshot(dir);
  wire(dir, {});
  assert.ok(read(dir, 'AGENTS.override.md').startsWith(`# Local override\n\n<!-- BEGIN complex-md (spec 0.3) -->\n${INTEGRATION_LINE}\n`));
  assert.ok(read(dir, 'AGENTS.md').includes(INTEGRATION_LINE));
  wire(dir, { profile: 'full' });
  assert.ok(findRegion(read(dir, 'AGENTS.override.md')).text.includes(HEADING));
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('with only AGENTS.override.md, wire also creates AGENTS.md for the agents that read only that', () => {
  const dir = repo({ 'AGENTS.override.md': '# Override\n' });
  const r = wire(dir, {});
  assert.ok(read(dir, 'AGENTS.override.md').includes(INTEGRATION_LINE));
  assert.deepEqual(r.created, ['AGENTS.md']);
});
