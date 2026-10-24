/* bench/run.mjs end to end on a fixture repository, with scripted agents
   in place of a model. No network and no model call. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildBenchRepo, runHarness } from './fixtures/bench-repo.mjs';

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

test('an unknown agent name is refused instead of running a model', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'nosuch', '--arms', 'none']);
    assert.equal(status, 2);
    assert.match(stderr, /unknown --agent nosuch/);
    assert.deepEqual(rows, []);
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
