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

test('the plan for a repository with no agent config is one new AGENTS.md, and the dry run writes nothing', () => {
  const dir = repoWith({ 'COMPLEX.md': MAP });
  const before = snapshot(dir);
  assert.deepEqual(planWire(dir, MAP, {}), [{ path: 'AGENTS.md', action: 'create' }]);
  assert.deepEqual(snapshot(dir), before);
});

test('the wiring plan matches what wire then writes, for every repo local target', () => {
  const dir = repoWith({
    'COMPLEX.md': MAP,
    'CLAUDE.md': '# house rules\n',
    '.claude/settings.json': '{\n  "permissions": {}\n}\n',
    '.claude/rules/complex-md/stale-brief.md': 'old\n',
    '.cursor/': '', '.openhands/': '', '.codex/': '', '.windsurf/': '', '.clinerules/': '', '.roo/': '',
    '.agents/skills/mine.md': 'kept\n',
    '.agents/skills/complex-md-stale.md': 'old\n',
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

test('a global registry target is planned as a registration, never run', () => {
  const dir = repoWith({ 'COMPLEX.md': MAP });
  assert.deepEqual(planWire(dir, MAP, { agents: ['openclaw'], mcp: true }).at(-1), { path: 'openclaw MCP registry', action: 'register' });
  assert.deepEqual(planWire(dir, MAP, { agents: ['openclaw'] }), [{ path: 'AGENTS.md', action: 'create' }], 'without --mcp a global target does nothing');
});

test('formatPlan lists one file per line with its action', () => {
  const text = formatPlan([{ path: 'COMPLEX.md', action: 'create' }, { path: '.gitignore', action: 'change' }], [{ path: '.complex-md/prompt.md', action: 'create' }]);
  assert.equal(text, 'File plan:\n  create  COMPLEX.md\n  change  .gitignore\nOnly if the model call fails:\n  create  .complex-md/prompt.md');
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
