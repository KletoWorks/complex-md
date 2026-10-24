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
import { connect } from 'node:net';

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
  // Another process's root: in a shared PID namespace, /proc/<pid>/root is the host's view of the disk.
  let viaProc = false;
  try { for (const pid of readdirSync('/proc').filter((x) => /^\d+$/.test(x))) if (!viaProc && grepTree(`/proc/${pid}/root${p}`, { files: 2000 })) viaProc = true; } catch {}
  report(`read /proc/<pid>/root${p}`, viaProc ? marker : '');
  if (existsSync(join(p, '.git'))) report(`git -C ${p} log --all`, sh('git', ['-C', p, 'log', '--all', '--format=%B']));
}

/* The network: a direct request, curl (which reads the proxy variables),
   and a raw CONNECT through the proxy the sandbox offers. CX_PROBE_URL is a
   server the test runs with the marker in its body. */
const url = process.env.CX_PROBE_URL;
if (url) {
  let direct = '';
  try { direct = await (await fetch(url, { signal: AbortSignal.timeout(3000) })).text(); } catch {}
  report('fetch direct', direct);
  report('curl', sh('curl', ['-s', '-m', '5', url]));
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (px) report('CONNECT through the proxy', await viaProxy(px, new URL(url)));
}

function viaProxy(px, target) {
  return new Promise((res) => {
    const p = new URL(px);
    let got = '', sent = false;
    const c = connect(Number(p.port), p.hostname);
    const done = () => res(got);
    c.setTimeout(5000, () => c.destroy());
    c.on('data', (d) => {
      got += d;
      if (!sent && /^HTTP\/1\.[01] 200/.test(got)) { sent = true; c.write(`GET ${target.pathname} HTTP/1.1\r\nHost: ${target.host}\r\nConnection: close\r\n\r\n`); }
    });
    c.on('close', done);
    c.on('error', done);
    c.write(`CONNECT ${target.host} HTTP/1.1\r\nHost: ${target.host}\r\n\r\n`);
  });
}

emit({ type: 'result', subtype: 'success', num_turns: 1, total_cost_usd: 0, duration_ms: 1, result: 'probe done' });
