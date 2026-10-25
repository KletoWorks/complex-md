// unwire removes what wire wrote, as the manifest records it, and nothing
// else. A file or block the user edited after wire wrote it is left in
// place and reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { readManifest, MANIFEST_PATH } from '../src/manifest.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

const USER_FILES = {
  'AGENTS.md': '# House rules\n\nNever rebase a shared branch.\n',
  'CLAUDE.md': '# Claude notes\n\nUse pnpm.',
  'GEMINI.md': '# Gemini\n\n@./AGENTS.md\n',
  'REVIEW.md': '# Review\n\nReport at most five Nits.\n',
  '.github/copilot-instructions.md': '# Copilot\n',
  '.agents/skills/deploy.md': '---\nname: deploy\n---\nmine\n',
  '.agents/rules/house.md': '---\ntrigger: always_on\n---\nmine\n',
  '.kiro/steering/product.md': '# Product\n',
  '.clinerules/house.md': 'mine\n',
  '.codex/config.toml': 'model = "o4"\n',
  '.cursor': null,
  '.claude': null,
  '.openhands': null,
  '.devin': null,
  '.windsurf': null,
};

test('wire then unwire leaves every file and folder as it was', () => {
  const dir = repo(USER_FILES);
  const before = snapshot(dir);
  wire(dir, { profile: 'full', agents: ['claude', 'cursor', 'openhands', 'antigravity', 'copilot', 'devin', 'kiro', 'windsurf', 'cline', 'review', 'openclaw'] });
  assert.notDeepEqual(snapshot(dir), before, 'wire wrote something');
  const r = unwire(dir);
  assert.deepEqual(r.left, []);
  assert.deepEqual(snapshot(dir), before);
});

test('unwire deletes an AGENTS.md that wire created', () => {
  const dir = repo();
  const before = snapshot(dir);
  wire(dir, {});
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('an AGENTS.md that wire created and the user added to keeps the user text', () => {
  const dir = repo();
  wire(dir, {});
  writeFileSync(join(dir, 'AGENTS.md'), `${read(dir, 'AGENTS.md')}\n## Our rules\n\nNever rebase.\n`);
  unwire(dir);
  assert.equal(read(dir, 'AGENTS.md'), '\n## Our rules\n\nNever rebase.\n');
});

test('a generated file the user edited is left in place and reported; the rest goes', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const [edited, ...rest] = readdirSync(join(dir, '.claude/rules/complex-md'));
  const rel = `.claude/rules/complex-md/${edited}`;
  writeFileSync(join(dir, rel), `${read(dir, rel)}\nA line the user added.\n`);
  const lines = [];
  const r = unwire(dir, { log: (s) => lines.push(s) });
  assert.ok(existsSync(join(dir, rel)), 'the edited brief stays');
  for (const n of rest) assert.ok(!existsSync(join(dir, `.claude/rules/complex-md/${n}`)), `${n} is removed`);
  assert.deepEqual(r.left.map((e) => e.path), [rel]);
  assert.ok(lines.some((l) => l.includes(rel) && /edited/.test(l)), lines.join('\n'));
  assert.deepEqual(readManifest(dir).files.map((f) => f.path), [rel], 'the manifest keeps what is left');
});

test('a marked block the user edited is left in place and reported', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n' });
  wire(dir, { profile: 'full' });
  writeFileSync(join(dir, 'AGENTS.md'), read(dir, 'AGENTS.md').replace('IMPORTANT:', 'VERY IMPORTANT:'));
  const edited = read(dir, 'AGENTS.md');
  const r = unwire(dir);
  assert.equal(read(dir, 'AGENTS.md'), edited);
  assert.deepEqual(r.left.map((e) => e.path), ['AGENTS.md']);
});

test('unwire restores nothing it did not write', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n', '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  writeFileSync(join(dir, '.claude/rules/complex-md/mine.md'), 'a rule the user added later\n');
  writeFileSync(join(dir, 'AGENTS.md'), `${read(dir, 'AGENTS.md')}\n@COMPLEX.md\n`);
  unwire(dir);
  assert.equal(read(dir, '.claude/rules/complex-md/mine.md'), 'a rule the user added later\n');
  assert.equal(read(dir, 'AGENTS.md'), '# House rules\n\n@COMPLEX.md\n');
});

test('without a manifest unwire changes nothing and says why', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n' });
  const before = snapshot(dir);
  const lines = [];
  const r = unwire(dir, { log: (s) => lines.push(s) });
  assert.equal(r.manifest, false);
  assert.deepEqual(snapshot(dir), before);
  assert.ok(lines.some((l) => l.includes(MANIFEST_PATH)), lines.join('\n'));
});

test('complex-md unwire runs from the bin and keeps COMPLEX.md', () => {
  const dir = repo({ 'AGENTS.md': '# House rules\n' });
  wire(dir, {});
  const r = spawnSync(process.execPath, [BIN, 'unwire'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'AGENTS.md'), '# House rules\n');
  assert.ok(existsSync(join(dir, 'COMPLEX.md')), 'the map is not wiring');
  assert.match(r.stderr, /COMPLEX\.md/);
});
