// What wire writes into a file the user owns sits between markers, and a
// rewire replaces only that text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { integrationBlock } from '../src/prompts.js';
import { findRegion, outsideRegion } from '../src/markers.js';

const HEADING = '## COMPLEX.md: the structural risk map';
const BEGIN = /<!-- BEGIN complex-md \(spec [\d.]+\) -->/;
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const count = (text, s) => text.split(s).length - 1;

function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mark-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

test('the block sits between markers, and the user text around it is unchanged', () => {
  const user = '# House rules\n\nNever rebase a shared branch.\n';
  const dir = repo({ 'AGENTS.md': user });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const text = read(dir, 'AGENTS.md');
  assert.match(text, BEGIN);
  assert.ok(findRegion(text).text.includes(HEADING), 'the block is inside the markers');
  assert.equal(outsideRegion(text).replace(/\n+$/, '\n'), user, 'nothing outside the markers changed');
  assert.ok(text.startsWith(user), 'the user text keeps its place');
});

test('a rewire with new block text replaces the marked block only', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n\nNever rebase a shared branch.\n' });
  wire(dir, { agents: ['claude'], profile: 'full' });
  writeFileSync(join(dir, 'AGENTS.md'), `${read(dir, 'AGENTS.md')}\nA rule the user added after the block.\n`);
  const before = read(dir, 'AGENTS.md');
  wire(dir, { agents: ['claude'], profile: 'full', block: 'Read COMPLEX.md before any edit to a listed file.' });
  const after = read(dir, 'AGENTS.md');
  assert.equal(count(after, HEADING), 1);
  assert.match(after, /Read COMPLEX\.md before any edit to a listed file\./);
  assert.doesNotMatch(after, /past fixes predict/, 'the old block text is gone');
  assert.equal(outsideRegion(after), outsideRegion(before), 'text outside the markers is byte identical');
  assert.ok(after.endsWith('\nA rule the user added after the block.\n'));
});

test('an unmarked block from an earlier version is put between markers in place', () => {
  const user = '# House rules\n\nNever rebase a shared branch.\n';
  const dir = repo({ 'AGENTS.md': `${user}\n${integrationBlock()}` });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const text = read(dir, 'AGENTS.md');
  assert.equal(count(text, HEADING), 1, 'no second copy');
  assert.match(text, BEGIN);
  assert.ok(text.startsWith(user));
});

test('an unmarked block in older wording is left alone, with no second copy and one log line', () => {
  const old = `# House rules\n\n${HEADING}\n\nAn older wording of the block.\n`;
  const dir = repo({ 'AGENTS.md': old });
  const lines = [];
  wire(dir, { agents: ['claude'], profile: 'full', log: (s) => lines.push(s) });
  assert.equal(read(dir, 'AGENTS.md'), old);
  assert.ok(lines.some((l) => /AGENTS\.md/.test(l) && /without markers/.test(l)), lines.join('\n'));
});

test('the CLAUDE.md import of the map sits inside the markers', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n', 'CLAUDE.md': '@AGENTS.md\n' });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const claude = read(dir, 'CLAUDE.md');
  assert.ok(claude.startsWith('@AGENTS.md\n'));
  assert.match(findRegion(claude).text, /^@COMPLEX\.md\r?$/m);
  assert.equal(count(claude, HEADING), 0, 'the import of AGENTS.md carries the block');
});

test('REVIEW.md gets its include line between markers, once', () => {
  const dir = repo({ 'REVIEW.md': '# Review\n\nReport at most five Nits.\n' });
  wire(dir, { profile: 'full' });
  wire(dir, { profile: 'full' });
  const text = read(dir, 'REVIEW.md');
  assert.equal(count(text, '@COMPLEX.md'), 1);
  assert.match(findRegion(text).text, /^@COMPLEX\.md$/m);
  assert.ok(text.startsWith('# Review\n\nReport at most five Nits.\n'));
});

test('the Codex MCP table sits between hash markers in config.toml', () => {
  const user = 'model = "o4"\n';
  const dir = repo({ '.codex/config.toml': user });
  wire(dir, { agents: ['codex'], mcp: true, profile: 'full' });
  wire(dir, { agents: ['codex'], mcp: true, profile: 'full' });
  const toml = read(dir, '.codex/config.toml');
  assert.ok(toml.startsWith(user));
  assert.match(toml, /^# BEGIN complex-md \(spec [\d.]+\)$/m);
  assert.equal(count(toml, '[mcp_servers.complex-md]'), 1);
});
