/* A task's map must be built at its base commit or before it. One map
   serves a calendar month of tasks, and the danger order is not date
   order, so the map used to be built at whichever task of the month ran
   first; 8 of 30 undici tasks got a map whose history held their own fix. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { buildBenchRepo, git, commit, runHarness } from './fixtures/bench-repo.mjs';
import { mapAnchor, assertMapUsable, commitTime } from '../../bench/maps.mjs';

function history(fx) {
  const [c1, c2, c3] = git(fx.repo, ['rev-list', '--reverse', 'main']).split('\n');
  return { c1, c2, c3 };
}

test('the month\'s map is built at the oldest base of that month, whatever order the tasks run in', () => {
  const fx = buildBenchRepo();
  try {
    const { c1, c2, c3 } = history(fx);
    const t = (id, base, date) => ({ id, base, date });
    // Danger order: the latest task first.
    const tasks = [t('late', fx.fix, '2026-07-20'), t('early', c2, '2026-07-03'), t('mid', c3, '2026-07-10'), t('june', c1, '2026-06-30')];
    const time = (sha) => commitTime(fx.repo, sha);
    for (const task of tasks.slice(0, 3)) assert.equal(mapAnchor(tasks, task, time), c2, task.id);
    assert.equal(mapAnchor(tasks, tasks[3], time), c1);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('a map built after a task\'s base is refused for that task', () => {
  const fx = buildBenchRepo();
  try {
    const { c2, c3 } = history(fx);
    assert.doesNotThrow(() => assertMapUsable(fx.repo, c2, { id: 'x', base: c3, date: '2026-07-10' }));
    assert.doesNotThrow(() => assertMapUsable(fx.repo, c3, { id: 'x', base: c3, date: '2026-07-10' }));
    assert.throws(() => assertMapUsable(fx.repo, fx.fix, { id: 'x', base: c3, date: '2026-07-10' }), /not in the history of the task's base/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('the harness refuses a task whose month map is not in its history, and records the refusal', () => {
  const fx = buildBenchRepo();
  try {
    const { c1 } = history(fx);
    // A side branch whose commit is the oldest base of July, but not an ancestor of the main line task.
    git(fx.repo, ['checkout', '-q', '-b', 'side', c1]);
    const side = commit(fx.repo, 'fix: side work', { 'lib/side.js': 'export const s = 1;\n' }, '2026-07-01T12:00:00Z');
    git(fx.repo, ['checkout', '-q', 'main']);
    const ds = JSON.parse(readFileSync(fx.datasetPath, 'utf8'));
    ds.tasks.push({ ...ds.tasks[0], id: 'side000000', base: side, fix: side, date: '2026-07-05' });
    writeFileSync(fx.datasetPath, JSON.stringify(ds));
    const { status, stderr, rows } = runHarness(fx, ['--agent', 'mock', '--arms', 'file', '--stop-at', 'none']);
    assert.equal(status, 0, stderr);
    const byTask = Object.fromEntries(rows.map((r) => [r.task, r]));
    assert.match(byTask[fx.task.id].error, /map for 2026-07 .* not in the history of the task's base/);
    assert.equal(byTask.side000000.error, null);
    assert.equal(byTask.side000000.map_commit, side);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});
