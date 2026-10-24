// Which commit a task's map is built at, and whether that map may serve it.
//
// One map serves a calendar month of task dates, which is how often a map
// gets regenerated in practice. The map used to be built at the base of the
// month's first task to run. The danger order is not date order, so later
// maps served earlier tasks, and a task's own fix sat in its map's history:
// 8 of 30 undici tasks. Now the month's map is built at the oldest base in
// that month, and a map is used only for a task whose base has it in its
// history.
import { spawnSync } from 'node:child_process';

const monthOf = (task) => task.date.slice(0, 7);

/** Committer time of `sha` in `repo`, in seconds. */
export function commitTime(repo, sha) {
  const r = spawnSync('git', ['log', '-1', '--format=%ct', sha], { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git log ${sha}: ${r.stderr}`);
  return Number(r.stdout.trim());
}

/** The commit the map for `task`'s month is built at: the oldest base among all the dataset's tasks in that month. */
export function mapAnchor(tasks, task, timeOf) {
  const month = monthOf(task);
  let best = null;
  for (const t of tasks) {
    if (monthOf(t) !== month) continue;
    if (!best || timeOf(t.base) < timeOf(best.base)) best = t;
  }
  return best.base;
}

/** Throws unless `anchor` is `task.base` or one of its ancestors. */
export function assertMapUsable(repo, anchor, task) {
  if (anchor === task.base) return;
  const r = spawnSync('git', ['merge-base', '--is-ancestor', anchor, task.base], { cwd: repo });
  if (r.status === 0) return;
  throw new Error(`map for ${monthOf(task)} built at ${anchor.slice(0, 10)}, which is not in the history of the task's base ${task.base.slice(0, 10)}`);
}
