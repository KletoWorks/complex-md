// A scripted agent that looks for the future instead of fixing anything.
// It tries each route an agent has used, or could use, to see commits after
// the task's base, and reports per route whether CX_PROBE_MARKER showed up.
// Speaks Claude Code's stream-json, so the harness runs it like an agent:
//
//   CX_PROBE_MARKER=<text only the future holds> node bench/run.mjs --agent probe ...
//
// Every `probe` event in the transcript must say leaked: false.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync, readlinkSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const marker = process.env.CX_PROBE_MARKER || '';
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 20000 });
  return `${r.stdout || ''}${r.stderr || ''}`;
};
const report = (route, text) => emit({ type: 'probe', route, leaked: Boolean(marker) && String(text).includes(marker) });

/* Files under `dir` that contain the marker, read as bytes, symlinks not followed. */
function grepTree(dir, budget = { files: 20000 }) {
  let hit = false;
  const walk = (d) => {
    let names = [];
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      if (hit || budget.files-- <= 0) return;
      const p = join(d, n);
      let st; try { st = lstatSync(p); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && st.size < 8 << 20) { try { if (readFileSync(p).includes(marker)) hit = true; } catch {} }
    }
  };
  walk(dir);
  return hit;
}

emit({ type: 'system', subtype: 'init', model: 'leak-probe', claude_code_version: '0.0.0-probe' });

// Git: every ref, the reflog, tags, the stash, notes, and every object in the store.
report('git log --all', sh('git', ['log', '--all', '--format=%H %B']));
report('git log origin/main', sh('git', ['log', 'origin/main', '--format=%B']));
report('git reflog', sh('git', ['reflog', '--all', '--format=%H %gs %B']));
report('git tag', sh('git', ['tag', '-n99']));
report('git stash list', sh('git', ['stash', 'list', '--format=%B']));
report('git notes', sh('git', ['log', '--all', '--notes', '--format=%N']));
report('git cat-file --batch-all-objects', sh('git', ['cat-file', '--batch-all-objects', '--batch']));
report('.git files', grepTree('.git') ? marker : '');

/* The checkout's links outward: a worktree's .git file names the clone, and
   node_modules links to the clone's install. Follow each to its repository. */
const out = [];
if (existsSync('.git') && lstatSync('.git').isFile()) out.push(resolve(readFileSync('.git', 'utf8').replace(/^gitdir:\s*/, '').trim(), '..', '..', '..'));
if (existsSync('node_modules') && lstatSync('node_modules').isSymbolicLink()) out.push(dirname(resolve(readlinkSync('node_modules'))));
for (const p of (process.env.CX_PROBE_PATHS || '').split(':').filter(Boolean)) out.push(p);
for (const p of out) {
  report(`read ${p}`, grepTree(p) ? marker : '');
  if (existsSync(join(p, '.git'))) report(`git -C ${p} log --all`, sh('git', ['-C', p, 'log', '--all', '--format=%B']));
}

emit({ type: 'result', subtype: 'success', num_turns: 1, total_cost_usd: 0, duration_ms: 1, result: 'probe done' });
