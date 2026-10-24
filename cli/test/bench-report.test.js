/* The benchmark report: what it prints for a known set of runs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { usd } from '../../bench/format.mjs';

const REPORT = join(import.meta.dirname, '..', '..', 'bench', 'report.mjs');

function report(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-report-'));
  try {
    const p = join(dir, 'runs.jsonl');
    writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const r = spawnSync(process.execPath, [REPORT, p], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const row = (task, arm, extra = {}) => ({ task, arm, first_gold_read: 2, steps: 5, wasted_reads: 0, gold_edited: true, error: null, ...extra });

test('usd prints dollars with cents, and three places under ten cents', () => {
  assert.equal(usd(1.894), '$1.89');
  assert.equal(usd(5.0310175), '$5.03');
  assert.equal(usd(0.0123), '$0.012');
  assert.equal(usd(null), '-');
  assert.equal(usd(Number.NaN), '-');
});

test('the per arm table prints cost per run in dollars, not a dollar sign with a cents suffix', () => {
  const out = report([row('a', 'none', { cost_usd: 1.894 }), row('a', 'file', { cost_usd: 2.5 })]);
  assert.match(out, /\| none \|.*\| \$1\.89 \|/);
  assert.match(out, /\| file \|.*\| \$2\.50 \|/);
  assert.doesNotMatch(out, /\$\d+(\.\d+)?c\b/);
});

test('capped runs stay in the pairs and get their own column', () => {
  const rows = [
    row('a', 'none', { success: true, regressed_tests: 0, stopped: 'budget' }),
    row('a', 'file', { success: true, regressed_tests: 0 }),
    // A row recorded before caps were stops: the cap sat in `error`.
    row('b', 'none', { success: false, error: 'error_max_budget_usd' }),
    row('b', 'file', { success: true, stopped: 'timeout' }),
  ];
  const out = report(rows);
  assert.match(out, /\| arm \| n \| capped \|/);
  assert.match(out, /\| none \| 2 \| 2 \|/);
  assert.match(out, /\| file \| 2 \| 1 \|/);
  // Both tasks are judged pairs for success; the legacy capped row is not an error.
  assert.match(out, /\| file \| 2 \| 1 \| 2 \|/);
  assert.doesNotMatch(out, /runs with errors/);
});
