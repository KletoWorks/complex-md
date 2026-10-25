/* bench/run.mjs end to end on a fixture repository, with scripted agents
   in place of a model. No network and no model call. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildBenchRepo, runHarness, spawnHarnessInto } from './fixtures/bench-repo.mjs';

test('a mock run records one row per arm with the edit the agent made', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none']);
    assert.equal(status, 0, stderr);
    assert.deepEqual(rows.map((r) => r.arm), ['none', 'file']);
    for (const r of rows) {
      assert.equal(r.error, null, `${r.arm}: ${r.error}`);
      assert.deepEqual(r.edited, ['lib/a.js']);
      assert.ok(r.steps >= 2);
      assert.equal(r.cost_usd, 0.01);
      assert.equal(r.model, 'mock-model');
      assert.equal(r.agent_version, '0.0.0-mock');
    }
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a run that hits the budget cap is recorded as capped and still judged', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none', '--suite'], { env: { CX_MOCK_END: 'budget' } });
    assert.equal(status, 0, stderr);
    const [r] = rows;
    assert.equal(r.stopped, 'budget');
    assert.equal(r.error, null);
    assert.equal(r.regressed_tests, 0, 'the damage suite ran on the capped patch');
    assert.equal(typeof r.success, 'boolean');
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a timed out run asks the agent to stop, keeps the cost it reports and the harness clock', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none', '--timeout', '2', '--grace', '10'], { env: { CX_MOCK_END: 'hang' } });
    assert.equal(status, 0, stderr);
    const [r] = rows;
    assert.equal(r.stopped, 'timeout');
    assert.equal(r.error, null);
    assert.equal(r.cost_usd, 0.42, 'the result event sent on SIGINT is read');
    assert.ok(r.wall_ms >= 2000 && r.wall_ms < 10000, `wall_ms ${r.wall_ms}`);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('an agent that ignores the stop request is killed after the grace period and still recorded', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none', '--timeout', '1', '--grace', '1'], { env: { CX_MOCK_END: 'hang-hard' } });
    assert.equal(status, 0, stderr);
    const [r] = rows;
    assert.equal(r.stopped, 'timeout');
    assert.equal(r.cost_usd, null);
    assert.ok(r.wall_ms >= 2000, `wall_ms ${r.wall_ms}`);
    assert.deepEqual(r.edited, ['lib/a.js']);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a file the agent creates is part of its patch, and prepared inputs are not', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows, out } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none'], { env: { CX_MOCK_NEWFILE: 'lib/strings.js' } });
    assert.equal(status, 0, stderr);
    const [r] = rows;
    assert.deepEqual(r.edited.sort(), ['lib/a.js', 'lib/strings.js']);
    assert.equal(r.diff_files, 2);
    assert.equal(r.diff_lines, 2 + 3, 'two appended lines plus the three lines of the new file');
    const patch = readFileSync(join(out, 'patches', `${fx.task.id}-none.diff`), 'utf8');
    assert.match(patch, /\+\+\+ b\/lib\/strings\.js/);
    assert.doesNotMatch(patch, /key\.pem/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('the gold arm applies the real fix without an agent and is judged the same way', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'claude', '--arms', 'gold', '--stop-at', 'none', '--no-sandbox']);
    assert.equal(status, 0, stderr);
    const [r] = rows;
    assert.equal(r.arm, 'gold');
    assert.equal(r.error, null, r.error);
    assert.deepEqual(r.edited, ['lib/a.js'], 'the source change only; the fix test is the gold test');
    assert.equal(r.success, true, 'the real fix passes its own test');
    assert.equal(r.regressed_tests, 0, 'the suite ran: no model, so CX_BENCH_NO_MODEL did not stop it');
    assert.equal(r.steps, 0);
    assert.equal(r.cost_usd, 0);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('an unknown agent name is refused instead of running a model', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'nosuch', '--arms', 'none']);
    assert.equal(status, 2);
    assert.match(stderr, /unknown --agent nosuch/);
    assert.deepEqual(rows, []);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('the retired mcp arm and unknown arm names are refused before any run', () => {
  const fx = buildBenchRepo();
  try {
    const mcp = runHarness(fx, ['--agent', 'mock', '--arms', 'none,mcp']);
    assert.equal(mcp.status, 2);
    assert.match(mcp.stderr, /the mcp arm is retired/);
    assert.deepEqual(mcp.rows, []);
    const typo = runHarness(fx, ['--agent', 'mock', '--arms', 'fiel']);
    assert.equal(typo.status, 2);
    assert.match(typo.stderr, /unknown arm fiel: none, front, file, hooks, stop, gold/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('CX_BENCH_NO_MODEL=1 turns a real agent run into a recorded harness error', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'claude', '--arms', 'none', '--no-sandbox']);
    assert.equal(status, 0, stderr);
    assert.match(rows[0].error, /model call was refused/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('--max-runs stops the pass after that many rows, and a rerun resumes', () => {
  const fx = buildBenchRepo();
  try {
    const first = runHarness(fx, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none', '--max-runs', '1']);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(first.rows.map((r) => r.arm), ['none']);
    assert.match(first.stderr, /--max-runs 1 reached/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('--maps-only builds the maps the file arms need and runs no agent', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows, out } = runHarness(fx, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none', '--maps-only']);
    assert.equal(status, 0, stderr);
    assert.equal(rows.length, 0);
    assert.equal(readdirSync(join(out, 'maps')).length, 1);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a row records the map size, and a map over --map-cap is that row\'s error', () => {
  const fx = buildBenchRepo();
  try {
    const ok = runHarness(fx, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none']);
    assert.equal(ok.status, 0, ok.stderr);
    const file = ok.rows.find((r) => r.arm === 'file');
    assert.ok(file.map_bytes > 0 && file.map_bytes <= 8192, `map_bytes ${file.map_bytes}`);
    assert.equal(ok.rows.find((r) => r.arm === 'none').map_bytes, null);
    const over = runHarness(fx, ['--agent', 'mock', '--arms', 'file', '--stop-at', 'none', '--map-cap', '100']);
    assert.equal(over.status, 0, over.stderr);
    assert.match(over.rows[0].error, /over the 100 byte cap/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('--maps-only logs a month whose map fails, goes on and exits 4', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'file', '--stop-at', 'none', '--maps-only', '--map-cap', '100']);
    assert.equal(status, 4, stderr);
    assert.match(stderr, /over the 100 byte cap/);
    assert.equal(rows.length, 0);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a dataset suite decides the runner and the files of the damage suite', () => {
  const fx = buildBenchRepo();
  try {
    const ds = JSON.parse(readFileSync(fx.datasetPath, 'utf8'));
    ds.suite = { runner: { name: 'dataset-node', cmd: process.execPath, args: ['--test', '--test-reporter=tap'], env: { CX_SUITE_ENV: 'on' } }, files: ['test/*.test.js'], include: '\\.test\\.js$' };
    writeFileSync(fx.datasetPath, JSON.stringify(ds));
    const { status, stderr, rows, out } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none', '--suite']);
    assert.equal(status, 0, stderr);
    assert.equal(rows[0].suite_files, 1);
    assert.equal(rows[0].regressed_tests, 0);
    assert.equal(rows[0].tests_run, 1, 'the gold test runs with the dataset runner');
    const [b] = readdirSync(join(out, 'baseline'));
    assert.equal(JSON.parse(readFileSync(join(out, 'baseline', b), 'utf8')).runner, 'dataset-node');
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('--seeds runs each arm once a seed, keeps each seed\'s patch, and a rerun resumes', () => {
  const fx = buildBenchRepo();
  try {
    const first = runHarness(fx, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none', '--seeds', '1,2', '--max-runs', '3']);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(first.rows.map((r) => `${r.arm}/${r.seed}`), ['none/1', 'file/1', 'none/2']);
    const id = fx.task.id;
    for (const f of [`${id}-none.diff`, `${id}-file.diff`, `${id}-none-s2.diff`]) assert.ok(existsSync(join(first.out, 'patches', f)), f);
    assert.ok(existsSync(join(first.out, 'transcripts', `${id}-none-s2.jsonl`)));
    // A row written before seeds existed has no seed field and counts as seed 1.
    const runs = join(first.out, 'runs.jsonl');
    const rows = readFileSync(runs, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    delete rows[0].seed;
    writeFileSync(runs, rows.map((r) => JSON.stringify(r) + '\n').join(''));
    const again = spawnHarnessInto(fx, first.out, ['--agent', 'mock', '--arms', 'none,file', '--stop-at', 'none', '--seeds', '1,2']);
    assert.equal(again.status, 0, again.stderr);
    assert.deepEqual(again.rows.slice(3).map((r) => `${r.arm}/${r.seed}`), ['file/2']);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('the stop arm wires the map and the Stop check, without the edit gate', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'stop,hooks', '--stop-at', 'none', '--keep']);
    assert.equal(status, 0, stderr);
    assert.deepEqual(rows.map((r) => r.arm), ['stop', 'hooks']);
    for (const r of rows) assert.equal(r.error, null, `${r.arm}: ${r.error}`);
    const settings = (arm) => JSON.parse(readFileSync(join(fx.dir, 'work', `${fx.task.id}-${arm}`, '.claude/settings.json'), 'utf8')).hooks;
    const stop = settings('stop');
    assert.equal(stop.PreToolUse, undefined);
    assert.match(stop.Stop[0].hooks[0].command, /complex-md\.js hook stop$/);
    assert.ok(settings('hooks').PreToolUse.length, 'the hooks arm keeps its gate');
    assert.ok(existsSync(join(fx.dir, 'work', `${fx.task.id}-stop`, 'COMPLEX.md')));
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a task with its own deps directory gets that install, not the clone\'s', () => {
  const fx = buildBenchRepo();
  try {
    const own = join(fx.dir, 'deps-at-base');
    mkdirSync(join(own, 'node_modules', 'older'), { recursive: true });
    writeFileSync(join(own, 'node_modules', 'older', 'index.js'), 'module.exports = 0;\n');
    const ds = JSON.parse(readFileSync(fx.datasetPath, 'utf8'));
    ds.tasks[0].deps = own;
    writeFileSync(fx.datasetPath, JSON.stringify(ds));
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'none', '--stop-at', 'none', '--keep']);
    assert.equal(status, 0, stderr);
    assert.equal(rows[0].error, null);
    const nm = join(fx.dir, 'work', `${fx.task.id}-none`, 'node_modules');
    assert.ok(existsSync(join(nm, 'older', 'index.js')), 'the task install is linked');
    assert.ok(!existsSync(join(nm, 'dep')), 'the clone install is not');
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});
