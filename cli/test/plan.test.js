// The file plan: every file a run will create, change or remove, printed
// before the first write. The wiring part comes from a dry run of wire()
// in a scratch copy, so the plan and the real run cannot disagree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { planWire, formatPlan, confirmPlan } from '../src/plan.js';
import { wire } from '../src/wire.js';
import { TARGETS } from '../src/targets.js';
import { generate } from '../src/generate.js';
import { buildRegressionRepo } from './fixtures/regression-repo.mjs';

const MAP = readFileSync(new URL('./fixtures/brief-map.md', import.meta.url), 'utf8');

function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === '.git') continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(relative(dir, p).split('\\').join('/'), readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

function diff(before, after) {
  const out = [];
  for (const [p, c] of after) if (!before.has(p)) out.push({ path: p, action: 'create' }); else if (before.get(p) !== c) out.push({ path: p, action: 'change' });
  for (const p of before.keys()) if (!after.has(p)) out.push({ path: p, action: 'remove' });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-plan-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (p.endsWith('/')) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), body);
  }
  return dir;
}

test('the plan for a repository with no agent config is a new AGENTS.md, the manifest and .gitattributes, and the dry run writes nothing', () => {
  const dir = repoWith({ 'COMPLEX.md': MAP });
  const before = snapshot(dir);
  assert.deepEqual(planWire(dir, MAP, {}), [{ path: '.complex-md/manifest.json', action: 'create' }, { path: '.gitattributes', action: 'create' }, { path: 'AGENTS.md', action: 'create' }]);
  assert.deepEqual(snapshot(dir), before);
});

test('the wiring plan matches what wire then writes, for every repo local target', () => {
  const dir = repoWith({
    'COMPLEX.md': MAP,
    'CLAUDE.md': '# house rules\n',
    '.claude/settings.json': '{\n  "permissions": {}\n}\n',
    '.claude/rules/complex-md/stale-brief.md': '---\npaths: src/gone.js\n---\n# src/gone.js\n\nListed in COMPLEX.md as a file where edits are risky.\n',
    '.cursor/': '', '.openhands/': '', '.codex/': '', '.windsurf/': '', '.clinerules/': '', '.roo/': '',
    '.agents/skills/mine.md': 'kept\n',
    '.agents/skills/complex-md-stale.md': '---\nname: complex-md-stale\n---\n# src/gone.js\n\nListed in COMPLEX.md as a file where edits are risky.\n',
  });
  const opts = { hooks: true, mcp: true };
  const plan = planWire(dir, MAP, opts);
  const before = snapshot(dir);
  wire(dir, opts);
  assert.deepEqual(plan, diff(before, snapshot(dir)));
  assert.ok(plan.some((e) => e.path === '.claude/rules/complex-md/stale-brief.md' && e.action === 'remove'));
  assert.ok(!plan.some((e) => e.path === '.agents/skills/mine.md'));
  assert.deepEqual(planWire(dir, MAP, opts), [], 'a second wire changes nothing, and the plan says so');
});

test('the default plan writes no hooks; --hooks adds the settings file', () => {
  const files = { 'COMPLEX.md': MAP, 'CLAUDE.md': '# house rules\n', '.claude/settings.json': '{\n  "permissions": {}\n}\n' };
  const plain = planWire(repoWith(files), MAP, {});
  assert.ok(!plain.some((e) => e.path === '.claude/settings.json'), JSON.stringify(plain));
  const hooked = planWire(repoWith(files), MAP, { hooks: true });
  assert.ok(hooked.some((e) => e.path === '.claude/settings.json' && e.action === 'change'), JSON.stringify(hooked));
});

test('the dry run sees the repository as wire does, so a file where wire expects a folder fails in the plan too', () => {
  const files = { 'COMPLEX.md': MAP, '.clinerules': 'my own rules\n' };
  const plan = planWire(repoWith(files), MAP, {});
  const dir = repoWith(files);
  const before = snapshot(dir);
  let failed = false;
  try { wire(dir, {}); } catch { failed = true; }
  if (failed) assert.equal(plan.at(-1)?.action, 'error', JSON.stringify(plan));
  else assert.deepEqual(plan, diff(before, snapshot(dir)));
});

test('a global registry target is planned as a registration, never run', () => {
  const dir = repoWith({ 'COMPLEX.md': MAP });
  assert.deepEqual(planWire(dir, MAP, { agents: ['openclaw'], mcp: true }).at(-1), { path: 'openclaw MCP registry', action: 'register' });
  assert.ok(!planWire(dir, MAP, { agents: ['openclaw'] }).some((e) => e.action === 'register'), 'without --mcp a global target registers nothing');
});

test('the plan lists the repository files a global registry target writes', () => {
  // A global target can write into the repository as well as call its
  // registry. The stub stands in for such a rule, so the test holds the plan
  // to wire for whatever the global targets write.
  const original = TARGETS.openclaw.rules;
  TARGETS.openclaw.rules = (ctx) => {
    original?.(ctx);
    mkdirSync(join(ctx.root, '.agents', 'skills', 'complex-md-probe'), { recursive: true });
    writeFileSync(join(ctx.root, '.agents', 'skills', 'complex-md-probe', 'SKILL.md'), 'probe\n');
  };
  try {
    const opts = { agents: ['openclaw', 'hermes'] };
    const dir = repoWith({ 'COMPLEX.md': MAP });
    const plan = planWire(dir, MAP, opts);
    const before = snapshot(dir);
    wire(dir, opts);
    assert.deepEqual(plan, diff(before, snapshot(dir)));
    assert.ok(plan.some((e) => e.path === '.agents/skills/complex-md-probe/SKILL.md'), JSON.stringify(plan));
  } finally {
    TARGETS.openclaw.rules = original;
  }
});

test('formatPlan lists one file per line with its action', () => {
  const text = formatPlan([{ path: 'COMPLEX.md', action: 'create' }, { path: '.gitignore', action: 'change' }], [{ path: '.complex-md/prompt.md', action: 'create' }]);
  assert.equal(text, 'File plan:\n  create  COMPLEX.md\n  change  .gitignore\nOnly if the model call fails:\n  create  .complex-md/prompt.md');
});

test('formatPlan puts the wiring of a keyed run under "After the model call"', () => {
  const text = formatPlan([{ path: 'COMPLEX.md', action: 'create' }], [{ path: '.complex-md/prompt.md', action: 'create' }], [{ path: 'AGENTS.md', action: 'change' }]);
  assert.equal(text, 'File plan:\n  create  COMPLEX.md\nAfter the model call:\n  change  AGENTS.md\nOnly if the model call fails:\n  create  .complex-md/prompt.md');
});

test('confirmPlan never reads input with --yes or when stdin is not a terminal', async () => {
  const input = new PassThrough();
  assert.equal(await confirmPlan({ yes: true, isTTY: true, input, output: new PassThrough() }), true);
  assert.equal(await confirmPlan({ yes: false, isTTY: false, input, output: new PassThrough() }), true);
});

test('confirmPlan in a terminal takes Enter or y as yes and n as no', async () => {
  const ask = async (answer) => {
    const input = new PassThrough();
    const p = confirmPlan({ yes: false, isTTY: true, input, output: new PassThrough() });
    input.end(answer);
    return p;
  };
  assert.equal(await ask('\n'), true);
  assert.equal(await ask('y\n'), true);
  assert.equal(await ask('n\n'), false);
  assert.equal(await ask('no\n'), false);
});

test('generate prints the plan before the first write, and writes nothing when the plan is declined', async () => {
  const dir = buildRegressionRepo();
  const before = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' });
  let seen = null;
  const r = await generate(dir, { template: true, approve: async (plan) => { seen = plan; assert.ok(!existsSync(join(dir, 'COMPLEX.md'))); return false; } });
  assert.equal(r.written, false);
  assert.equal(r.declined, true);
  assert.deepEqual(seen.files.map((e) => `${e.action} ${e.path}`), ['create COMPLEX.md', 'create .complex-md/prompt.md', 'create .complex-md/front-matter.yaml', 'create .gitignore']);
  assert.match(seen.mapText, /^prose: template$/m);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }), before);
});

test('a rerun on the same commit plans no file, because no content changes', async () => {
  const dir = buildRegressionRepo();
  await generate(dir, { template: true });
  let seen = null;
  await generate(dir, { template: true, approve: async (plan) => { seen = plan; return false; } });
  assert.deepEqual(seen.files, []);
  assert.equal(formatPlan([]), 'File plan: no file changes.');
});
