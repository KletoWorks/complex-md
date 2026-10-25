// wire --dry-run and unwire --dry-run print the file plan and write
// nothing. The plan comes from a run in a scratch copy, so it matches what
// the real run then does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { repo, snapshot } from './fixtures/wire-repo.mjs';
import { planUnwire } from '../src/plan.js';
import { wire } from '../src/wire.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

function committed(files) {
  const dir = repo(files);
  execFileSync('git', ['add', '-A'], { cwd: dir, env: ENV });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env: ENV });
  return dir;
}

const cli = (dir, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8', env: { ...ENV, GIT_CEILING_DIRECTORIES: dirname(dir) } });

/* The paths a plan names, from the printed lines. */
const planned = (stderr) => stderr.split('\n').filter((l) => /^ {2}(create|change|remove) /.test(l)).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' ')).sort();

function changes(before, after) {
  const out = [];
  for (const [p, v] of after) if (v !== null && !before.has(p)) out.push(`create ${p}`); else if (v !== null && before.get(p) !== v) out.push(`change ${p}`);
  for (const [p, v] of before) if (v !== null && !after.has(p)) out.push(`remove ${p}`);
  return out.sort();
}

test('wire --dry-run prints the plan, writes nothing, and the real wire does what it printed', () => {
  const dir = committed({ 'AGENTS.md': '# House rules\n', '.claude': null, '.claude/keep': '' });
  const before = snapshot(dir);
  const dry = cli(dir, 'wire', '--dry-run', '--profile', 'full');
  assert.equal(dry.status, 0, dry.stderr);
  assert.deepEqual(snapshot(dir), before, 'the dry run wrote nothing');
  assert.match(dry.stderr, /nothing was written/i);
  const plan = planned(dry.stderr);
  assert.ok(plan.includes('change AGENTS.md'), plan.join('\n'));
  assert.equal(cli(dir, 'wire', '--profile', 'full').status, 0);
  assert.deepEqual(changes(before, snapshot(dir)), plan);
});

test('unwire --dry-run prints what unwire removes, writes nothing, and the real unwire does that', () => {
  const dir = committed({ 'AGENTS.md': '# House rules\n', '.claude': null, '.claude/keep': '' });
  assert.equal(cli(dir, 'wire', '--profile', 'full').status, 0);
  const wired = snapshot(dir);
  const dry = cli(dir, 'unwire', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.deepEqual(snapshot(dir), wired);
  const plan = planned(dry.stderr);
  assert.ok(plan.includes('change AGENTS.md') && plan.includes('remove .complex-md/manifest.json'), plan.join('\n'));
  assert.equal(cli(dir, 'unwire').status, 0);
  assert.deepEqual(changes(wired, snapshot(dir)), plan);
});

test('the unwire plan names a file it would leave because the user edited it', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], profile: 'full' });
  const [first] = readdirSync(join(dir, '.claude/rules/complex-md'));
  const rel = `.claude/rules/complex-md/${first}`;
  writeFileSync(join(dir, rel), `${readFileSync(join(dir, rel), 'utf8')}\nmine\n`);
  const { plan, lines } = planUnwire(dir);
  assert.ok(!plan.some((e) => e.path === rel), 'the edited file is not in the plan');
  assert.ok(lines.some((l) => l.includes(rel) && /edited/.test(l)), lines.join('\n'));
  assert.ok(!lines.some((l) => /complex-md-plan-/.test(l)), 'no scratch path in the lines');
});
