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

/* Roo Code reads AGENTS.md and has no path scoped rules, so a rule file
   there could only repeat the block. Wire removes the one it used to write. */
test('roo gets no rule file, and the one an earlier version wrote is removed', () => {
  const dir = repo({ '.roo/rules/complex-md.md': `${HEADING}\n\nold copy\n`, '.roo/rules/mine.md': 'mine\n' });
  const r = wire(dir, {});
  assert.ok(!existsSync(join(dir, '.roo/rules/complex-md.md')));
  assert.ok(r.removed.includes('.roo/rules/complex-md.md'));
  assert.ok(!r.rules.some((x) => x.startsWith('.roo')));
  assert.equal(read(dir, '.roo/rules/mine.md'), 'mine\n');
  const again = wire(dir, { agents: ['roo'] });
  assert.ok(!existsSync(join(dir, '.roo/rules/complex-md.md')), '--for roo writes nothing either');
  assert.deepEqual(again.removed, []);
});

/* OpenClaw and Hermes Agent both load project skills from
   .agents/skills/<name>/SKILL.md. Without --mcp these targets used to do
   nothing at all. */
test('--for openclaw,hermes writes the portable skill without --mcp', () => {
  const dir = repo();
  const logs = [];
  const r = wire(dir, { agents: ['openclaw', 'hermes'], log: (s) => logs.push(s) });
  const p = '.agents/skills/complex-md/SKILL.md';
  assert.ok(existsSync(join(dir, p)), 'the skill is written');
  assert.deepEqual(r.rules.filter((x) => x === p), [p], 'reported once for both targets');
  assert.deepEqual(r.mcp, [], 'no registry is touched without --mcp');
  const skill = read(dir, p);
  const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)[1];
  assert.match(front, /^name: complex-md$/m, 'the name matches the directory');
  const description = /^description: (.*)$/m.exec(front)[1];
  assert.ok(description.length > 0 && description.length <= 1024, 'Agent Skills caps the description at 1024 characters');
  assert.ok(skill.includes(HEADING), 'the skill carries the block');
  assert.match(skill, /npx -y complex-md check/);
  assert.ok(logs.some((l) => /hermes skills trust/.test(l)), 'Hermes needs the repository trusted first');
  assert.deepEqual(wire(dir, { agents: ['openclaw'] }).rules, [p], 'a rewire rewrites the same file');
});

/* Briefs as files in a directory, each with its front matter parsed:
   { file: { front: {key: raw value}, body } }. */
function briefsIn(dir, rel, suffix = '.md') {
  const out = {};
  for (const f of readdirSync(join(dir, rel)).filter((x) => x.endsWith(suffix))) {
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(read(dir, join(rel, f)));
    assert.ok(m, `${f} starts with front matter`);
    const front = {};
    let key = null;
    for (const line of m[1].split('\n')) {
      const kv = /^([A-Za-z_]+):\s?(.*)$/.exec(line);
      if (kv) [, key, front[kv[1]]] = kv;
      else front[key] += '\n' + line;
    }
    out[f] = { front, body: m[2] };
  }
  return out;
}

const BRIEFED = ['src/core.js', 'src/legacy.js', 'src/render.css', 'src/render.js'];

/* Copilot code review and the Copilot cloud agent read
   .github/instructions/**\/*.instructions.md whose applyTo glob matches a
   file in the change. One file per brief puts that file's brief in front
   of the review bot on every pull request that touches it. */
test('copilot: one .instructions.md per brief, applyTo scoped to its path', () => {
  const dir = repo({ '.github/copilot-instructions.md': '# Copilot\n' });
  const r = wire(dir, {});
  const got = briefsIn(dir, '.github/instructions/complex-md', '.instructions.md');
  assert.equal(Object.keys(got).length, BRIEFED.length);
  assert.deepEqual(Object.values(got).map((b) => b.front.applyTo).sort(), BRIEFED.map((p) => `"${p}"`));
  const core = Object.values(got).find((b) => b.front.applyTo === '"src/core.js"');
  assert.match(core.body, /^# src\/core\.js\n/);
  assert.match(core.body, /is the hub every module imports/);
  assert.ok(r.rules.includes('.github/instructions/complex-md/ (4 paths)'));
});

test('copilot is detected from its own files only, never from .github alone', () => {
  const dir = repo({ '.github/workflows/ci.yml': 'on: push\n' });
  wire(dir, {});
  assert.ok(!existsSync(join(dir, '.github/instructions')), 'a workflow is not a Copilot setup');
  const dir2 = repo({ '.github/instructions/house.instructions.md': '---\napplyTo: "**"\n---\nmine\n' });
  wire(dir2, {});
  assert.ok(existsSync(join(dir2, '.github/instructions/complex-md')), 'an instructions folder opts in');
  assert.equal(read(dir2, '.github/instructions/house.instructions.md'), '---\napplyTo: "**"\n---\nmine\n');
  const dir3 = repo();
  wire(dir3, { agents: ['copilot'] });
  assert.ok(existsSync(join(dir3, '.github/instructions/complex-md')), '--for copilot opts in');
});

/* Claude Code Review puts a root file in place of a line that holds only
   `@` and the file's name. REVIEW.md is the team's file: wire adds that
   one line to an existing one and never creates it. */
test('review: an existing REVIEW.md gets one @COMPLEX.md line; none is ever created', () => {
  const dir = repo({ 'REVIEW.md': '# Review instructions\n\nReport at most five Nits per review.' });
  const r = wire(dir, {});
  assert.equal(read(dir, 'REVIEW.md'), '# Review instructions\n\nReport at most five Nits per review.\n\n@COMPLEX.md\n');
  assert.ok(r.primary.includes('REVIEW.md (@COMPLEX.md include)'));
  wire(dir, {});
  assert.equal(count(read(dir, 'REVIEW.md'), '@COMPLEX.md'), 1, 'a rewire adds nothing');

  const none = repo();
  const r2 = wire(none, { agents: ['review'] });
  assert.ok(!existsSync(join(none, 'REVIEW.md')), '--for review never creates the file');
  assert.ok(r2.skipped.includes('REVIEW.md (absent, not created)'));
});

test('review: a line inside an open code fence or comment would not include, so none is added', () => {
  for (const tail of ['```md\nexample\n', '<!-- draft\n']) {
    const dir = repo({ 'REVIEW.md': `# Review\n\n${tail}` });
    const r = wire(dir, {});
    assert.equal(read(dir, 'REVIEW.md'), `# Review\n\n${tail}`);
    assert.ok(r.skipped.some((s) => s.startsWith('REVIEW.md (ends inside')));
  }
});

/* Antigravity reads .agents/rules/*.md, flat, each with a trigger. A glob
   trigger loads the rule when the agent reads or edits a matching file. */
test('antigravity: flat .agents/rules briefs with a glob trigger; the user\'s rules stay', () => {
  const dir = repo({
    '.agents/rules/house.md': '---\ntrigger: always_on\n---\nmine\n',
    '.agents/rules/complex-md-stale-x.md': '---\ntrigger: glob\n---\nours, stale\n',
  });
  const r = wire(dir, {});
  const got = briefsIn(dir, '.agents/rules');
  assert.equal(read(dir, '.agents/rules/house.md'), '---\ntrigger: always_on\n---\nmine\n');
  assert.ok(!got['complex-md-stale-x.md'], 'a brief for a dropped path is removed');
  const ours = Object.entries(got).filter(([f]) => f.startsWith('complex-md-'));
  assert.equal(ours.length, BRIEFED.length);
  for (const [, b] of ours) {
    assert.equal(b.front.trigger, 'glob');
    assert.match(b.front.description, /^COMPLEX\.md brief for /);
  }
  assert.deepEqual(ours.map(([, b]) => b.front.globs).sort(), BRIEFED.map((p) => `"${p}"`));
  assert.ok(r.rules.includes('.agents/rules/complex-md-* (4 paths)'));
  const plain = repo();
  wire(plain, {});
  assert.ok(!existsSync(join(plain, '.agents/rules')), 'not detected without the folder');
});

test('a block only rule file is still written when no AGENTS.md carries the block', () => {
  const dir = repo({ 'GEMINI.md': '# Gemini\n', '.cursor': null });
  const r = wire(dir, { agents: ['cursor'] });
  assert.ok(!existsSync(join(dir, 'AGENTS.md')));
  assert.ok(r.rules.includes('.cursor/rules/complex-md.mdc'), 'Cursor does not read GEMINI.md');
  assert.match(read(dir, '.cursor/rules/complex-md.mdc'), new RegExp(HEADING));
});
