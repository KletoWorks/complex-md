/* bench/run.mjs end to end on a fixture repository, with scripted agents
   in place of a model. No network and no model call. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildBenchRepo } from './fixtures/bench-repo.mjs';

const RUN = join(import.meta.dirname, '..', '..', 'bench', 'run.mjs');

export function runHarness(fx, extra = [], { env = {} } = {}) {
  const out = join(fx.dir, `out-${Math.random().toString(36).slice(2, 8)}`);
  const work = join(fx.dir, 'work');
  mkdirSync(work, { recursive: true });
  const r = spawnSync(process.execPath, [RUN, ...extra, '--dataset', fx.datasetPath, '--out', out, '--work', work, '--timeout', '60'], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 180000 });
  const runsPath = join(out, 'runs.jsonl');
  const rows = existsSync(runsPath) ? readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { status: r.status, stderr: r.stderr, rows, out };
}

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
