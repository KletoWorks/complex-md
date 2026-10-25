/* bench/leak-lines.mjs: does a task's fixed code sit somewhere the agent can read? */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildBenchRepo } from './fixtures/bench-repo.mjs';

const LEAK = join(import.meta.dirname, '..', '..', 'bench', 'leak-lines.mjs');

test('a fix line found in a readable directory is reported with the task and the file', () => {
  const fx = buildBenchRepo();
  try {
    const clean = join(fx.dir, 'clean');
    const dirty = join(fx.dir, 'dirty');
    mkdirSync(clean); mkdirSync(join(dirty, 'pkg'), { recursive: true });
    writeFileSync(join(clean, 'a.js'), 'export const a = (x) => x + 1;\n');
    // The fixture fix adds one line to lib/a.js; a published copy of it sits in dirty/.
    writeFileSync(join(dirty, 'pkg', 'a.js'), 'export const a = (x) => Number(x) + 1; // CXFUTURE7d3e\n');
    const r = spawnSync(process.execPath, [LEAK, fx.datasetPath, clean, dirty, '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.tasks, 1);
    assert.equal(out.lines, 1);
    assert.deepEqual(out.hits, [{ task: fx.task.id, line: 'export const a = (x) => Number(x) + 1; // CXFUTURE7d3e', files: [join(dirty, 'pkg', 'a.js')] }]);
    const ok = spawnSync(process.execPath, [LEAK, fx.datasetPath, clean, '--json'], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout).hits, []);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});
