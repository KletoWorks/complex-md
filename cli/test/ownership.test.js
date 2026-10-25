// wire removes or overwrites only files it wrote. Before the manifest it
// cleared every file whose name carried its prefix, so a user's
// .agents/skills/complex-md-notes.md was deleted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { readManifest } from '../src/manifest.js';

const MAP = readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8');
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-own-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), MAP);
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

/* The same map without its co-change pair: two of the four briefed paths drop out.
   \r?\n: a Windows checkout has the fixture with CRLF line ends. */
const SMALLER = MAP.replace(/co_change:\r?\n(?: {2}- [\s\S]*?)(?=\r?\n[a-z_]+:|\r?\n---)/, 'co_change: []');

test('a file of the user\'s with the complex-md- prefix survives a rewire', () => {
  const notes = '# My notes on complex-md\n\nKeep the map short.\n';
  const dir = repo({ '.openhands': null, '.agents/skills/complex-md-notes.md': notes, '.claude/rules/complex-md/mine.md': notes });
  wire(dir, { agents: ['openhands', 'claude'], profile: 'full' });
  wire(dir, { agents: ['openhands', 'claude'], profile: 'full' });
  assert.equal(read(dir, '.agents/skills/complex-md-notes.md'), notes);
  assert.equal(read(dir, '.claude/rules/complex-md/mine.md'), notes);
});

test('a brief wire wrote for a path the map no longer lists is removed on the next wire', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const before = readdirSync(join(dir, '.claude/rules/complex-md'));
  assert.equal(before.length, 4);
  assert.notEqual(SMALLER, MAP, 'the fixture lost its co-change pair');
  writeFileSync(join(dir, 'COMPLEX.md'), SMALLER);
  wire(dir, { agents: ['claude'], profile: 'full' });
  const after = readdirSync(join(dir, '.claude/rules/complex-md'));
  assert.ok(after.length < before.length, `${after.length} of ${before.length} briefs left`);
  assert.deepEqual(readManifest(dir).files.filter((f) => f.path.startsWith('.claude/')).map((f) => f.path.split('/').at(-1)).sort(), after.sort());
});

test('a dropped brief the user edited is left in place and named in the log', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const names = readdirSync(join(dir, '.claude/rules/complex-md'));
  for (const n of names) writeFileSync(join(dir, '.claude/rules/complex-md', n), `${read(dir, `.claude/rules/complex-md/${n}`)}\nA line the user added.\n`);
  writeFileSync(join(dir, 'COMPLEX.md'), SMALLER);
  const lines = [];
  wire(dir, { agents: ['claude'], profile: 'full', log: (s) => lines.push(s) });
  const kept = names.filter((n) => existsSync(join(dir, '.claude/rules/complex-md', n)) && read(dir, `.claude/rules/complex-md/${n}`).includes('A line the user added.'));
  assert.ok(kept.length >= 1, 'the edited brief for a dropped path stays');
  for (const n of kept) assert.ok(lines.some((l) => l.includes(n) && /edited/.test(l)), lines.join('\n'));
});

test('a file of the user\'s at the path of a brief is not overwritten', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const [first] = readdirSync(join(dir, '.claude/rules/complex-md'));
  const fresh = repo({ '.claude': null, [`.claude/rules/complex-md/${first}`]: 'mine\n' });
  const r = wire(fresh, { agents: ['claude'], profile: 'full' });
  assert.equal(read(fresh, `.claude/rules/complex-md/${first}`), 'mine\n');
  assert.ok(r.skipped.some((s) => s.startsWith(`.claude/rules/complex-md/${first}`)), r.skipped.join(', '));
});
