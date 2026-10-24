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
  const r = spawnSync(process.execPath, [RUN, '--dataset', fx.datasetPath, '--out', out, '--work', work, '--timeout', '60', ...extra], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 180000 });
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
