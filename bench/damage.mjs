#!/usr/bin/env node
// Collateral damage per task: the scoring, the screen set, the selection of
// damaged and clean tasks, and the per task comparison of arms that
// bench/PREREG.md fixes before any run. No model is called.
//
//   node bench/damage.mjs screen-set --set fastify,mocha,uptime-kuma
//   node bench/damage.mjs select     --set fastify,mocha,uptime-kuma
//   node bench/damage.mjs analyze    --set fastify,mocha,uptime-kuma
//   node bench/damage.mjs replay     --set fastify,mocha,uptime-kuma
//
// Paths follow one convention, each overridable: datasets in --data-dir
// (bench/data/damage-<name>.json), the screen in --screen-dir
// (bench/results/damage-screen/<name>), the arms in --arms-dir
// (bench/results/damage-arms/<name>).
//
// A run is damaged when its patch broke a test that passed at the base, on
// two runs, in a file the real fix did not change (bench/run.mjs records
// those as `regressions`), and the gold patch, the real fix applied with no
// agent, did not break the same test. A gold break is a test the fix itself
// breaks or a flaky one, and it counts for no arm.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signTest } from './stats.mjs';

export const SALT = 'complex-md damage selection v1';
export const PRIMARY = ['none', 'file'];
export const SECONDARY = [['none', 'stop'], ['none', 'hooks'], ['file', 'stop']];
export const SEEDS = [1, 2];
export const KILL_RATE = 0.15;

/** task -> Set of regression keys the gold row recorded. */
export function goldBroken(rows) {
  const m = new Map();
  for (const r of rows) if (r.arm === 'gold' && Array.isArray(r.regressions)) m.set(r.task, new Set(r.regressions));
  return m;
}

/** true, false, or null when the run has no verdict (an error, or no suite). */
export function runDamage(r, gold) {
  if (!r || r.error || !Array.isArray(r.regressions)) return null;
  const g = gold.get(r.task) || new Set();
  return r.regressions.some((k) => !g.has(k));
}

/** A screen row's class: damaged, clean or unusable. */
export function classify(r, gold) {
  const d = runDamage(r, gold);
  return d === null ? 'unusable' : d ? 'damaged' : 'clean';
}

/* The screen set: `quota` usable tasks a repository in dataset order
   (newest first), a repository with fewer giving all it has, and the
   shortfall filled one task at a time, repositories in name order, until
   `total`. `sets` maps a name to [{ id, usable }]. */
export function allocate(sets, { total = 60, quota = 20 } = {}) {
  const names = Object.keys(sets).sort();
  const ok = Object.fromEntries(names.map((n) => [n, sets[n].filter((t) => t.usable).map((t) => t.id)]));
  const take = Object.fromEntries(names.map((n) => [n, Math.min(quota, ok[n].length)]));
  let left = total - Object.values(take).reduce((a, b) => a + b, 0);
  while (left > 0) {
    const open = names.filter((n) => take[n] < ok[n].length);
    if (!open.length) break;
    for (const n of open) { if (left <= 0) break; take[n]++; left--; }
  }
  return Object.fromEntries(names.map((n) => [n, ok[n].slice(0, take[n])]));
}

export const hashOrder = (ids) => [...ids].sort((a, b) => {
  const h = (x) => createHash('sha256').update(`${SALT}:${x}`).digest('hex');
  return h(a) < h(b) ? -1 : h(a) > h(b) ? 1 : 0;
});

/* `n` ids from `tasks`, repositories in turn (name order), each in hash order. */
function roundRobin(tasks, n) {
  const byRepo = new Map();
  for (const t of tasks) (byRepo.get(t.repo) || byRepo.set(t.repo, []).get(t.repo)).push(t.id);
  const queues = [...byRepo.keys()].sort().map((r) => hashOrder(byRepo.get(r)));
  const out = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  return out;
}

/* The selection from the screen. `tasks`: [{ id, repo, cls }]. Under 15%
   damaged among usable tasks kills the arms phase. 15 damaged or more:
   15 of them; fewer: all of them, and clean tasks fill to 30. */
export function select(tasks, { per = 15, killRate = KILL_RATE } = {}) {
  const usable = tasks.filter((t) => t.cls !== 'unusable');
  const dam = tasks.filter((t) => t.cls === 'damaged');
  const rate = usable.length ? dam.length / usable.length : 0;
  if (rate < killRate) return { kill: true, rate, usable: usable.length, damaged_found: dam.length, damaged: [], clean: [] };
  const damaged = roundRobin(dam, per);
  const clean = roundRobin(tasks.filter((t) => t.cls === 'clean'), 2 * per - damaged.length);
  return { kill: false, rate, usable: usable.length, damaged_found: dam.length, damaged, clean };
}

/** task -> damaged seeds of `arm` (0 to seeds.length), or null when any seed has no verdict. */
export function perTask(rows, gold, arm, tasks, seeds = SEEDS) {
  const out = {};
  for (const t of tasks) {
    let n = 0;
    for (const s of seeds) {
      const r = rows.find((x) => x.task === t && x.arm === arm && (x.seed ?? 1) === s);
      const d = runDamage(r, gold);
      if (d === null) { n = null; break; }
      n += d ? 1 : 0;
    }
    out[t] = n;
  }
  return out;
}

/* Per task, the reference arm's damaged seeds minus the other arm's. A
   task favours the arm when the arm damaged fewer seeds. Exact two sided
   sign test on the tasks that differ. Success: 6 tasks or more for the
   arm, 1 at most against it, and p under 0.05. */
export function compare(ref, arm) {
  const tasks = Object.keys(ref).filter((t) => ref[t] !== null && arm[t] !== null && arm[t] !== undefined);
  const diffs = tasks.map((t) => ref[t] - arm[t]);
  const s = signTest(diffs);
  const pos = diffs.filter((d) => d > 0).length, neg = diffs.filter((d) => d < 0).length;
  return { n: tasks.length, for: pos, against: neg, ties: tasks.length - pos - neg, p: s.n ? s.p : 1, success: pos >= 6 && neg <= 1 && s.n > 0 && s.p < 0.05 };
}

/** Holm step down adjusted p values, in the input order. */
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}

/* The advice replay. For every damaging run, each break that the gold
   patch does not share is caught when its test file is among the tests the
   map names, at the base, for a file the run edited. `named` maps a task to
   { file: [test files] }, the baseline's risky.tests. No test runs: each
   break was already confirmed on two runs. */
export function replay(rows, gold, named) {
  const breaks = [];
  for (const r of rows) {
    if (!runDamage(r, gold)) continue;
    const g = gold.get(r.task) || new Set();
    const advice = new Set((r.edited || []).flatMap((f) => named[r.task]?.[f] || []));
    for (const k of r.regressions) if (!g.has(k)) breaks.push({ task: r.task, arm: r.arm, seed: r.seed ?? 1, test: k, caught: advice.has(k.split(' :: ')[0]) });
  }
  return { breaks, caught: breaks.filter((b) => b.caught).length, total: breaks.length };
}

/* ---------- command line ---------- */
const readRows = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

function cli() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const cmd = args[0];
  const names = opt('--set', 'fastify,mocha,uptime-kuma').split(',');
  const dataDir = opt('--data-dir', 'bench/data');
  const screenDir = opt('--screen-dir', 'bench/results/damage-screen');
  const armsDir = opt('--arms-dir', 'bench/results/damage-arms');
  const ds = (n, kind = '') => join(dataDir, `damage-${kind}${n}.json`);
  const write = (p, d, tasks) => { const { tasks: _t, ...head } = d; writeFileSync(p, JSON.stringify({ ...head, tasks }, null, 2) + '\n'); };

  if (cmd === 'screen-set') {
    /* A task is usable when its gold row ran the suite without an error and
       its base has at least one passing test file. */
    const sets = {}, data = {};
    for (const n of names) {
      data[n] = JSON.parse(readFileSync(ds(n), 'utf8'));
      const gold = new Map(readRows(join(screenDir, n, 'runs.jsonl')).filter((r) => r.arm === 'gold').map((r) => [r.task, r]));
      sets[n] = data[n].tasks.map((t) => {
        const g = gold.get(t.id);
        const bp = join(screenDir, n, 'baseline', `${t.base.slice(0, 12)}.json`);
        const base = existsSync(bp) ? JSON.parse(readFileSync(bp, 'utf8')) : null;
        const passing = base?.results ? Object.values(base.results).filter((r) => r.ok).length : 0;
        return { id: t.id, usable: Boolean(g && !g.error && Array.isArray(g.regressions) && passing > 0), passing, gold: g ? (g.error ? 'error' : g.regressions === null ? 'no suite' : 'ok') : 'missing' };
      });
    }
    const got = allocate(sets);
    for (const n of names) {
      const keep = new Set(got[n]);
      write(ds(n, 'screen-'), data[n], data[n].tasks.filter((t) => keep.has(t.id)));
      console.log(`${n}: ${got[n].length} of ${sets[n].filter((t) => t.usable).length} usable, ${sets[n].length} in the dataset`);
      for (const t of sets[n].filter((x) => !x.usable)) console.log(`  unusable ${t.id}: gold ${t.gold}, ${t.passing} passing test files at the base`);
    }
    return 0;
  }

  if (cmd === 'select') {
    const tasks = [], data = {};
    for (const n of names) {
      data[n] = JSON.parse(readFileSync(ds(n, 'screen-'), 'utf8'));
      const rows = readRows(join(screenDir, n, 'runs.jsonl'));
      const gold = goldBroken(rows);
      for (const t of data[n].tasks) tasks.push({ id: t.id, repo: data[n].repo, cls: classify(rows.find((r) => r.task === t.id && r.arm === 'none' && (r.seed ?? 1) === 1), gold) });
    }
    const missing = tasks.filter((t) => t.cls === 'unusable').length;
    const s = select(tasks);
    const record = { at: new Date().toISOString(), salt: SALT, screened: tasks.length, ...s, classes: Object.fromEntries(tasks.map((t) => [t.id, t.cls])) };
    writeFileSync(join(screenDir, 'selection.json'), JSON.stringify(record, null, 2) + '\n');
    console.log(`screen: ${tasks.length} tasks, ${s.usable} usable, ${s.damaged_found} damaged (${(100 * s.rate).toFixed(1)}%), ${missing} unusable`);
    if (s.kill) { console.log(`kill: damage under ${100 * KILL_RATE}% of usable tasks; no arms phase`); return 3; }
    const keep = new Set([...s.damaged, ...s.clean]);
    for (const n of names) {
      const sel = data[n].tasks.filter((t) => keep.has(t.id));
      write(ds(n, 'arms-'), data[n], sel);
      console.log(`${n}: ${sel.length} tasks for the arms phase`);
    }
    console.log(`selected ${s.damaged.length} damaged and ${s.clean.length} clean`);
    return 0;
  }

  if (cmd === 'analyze') {
    const sel = JSON.parse(readFileSync(join(screenDir, 'selection.json'), 'utf8'));
    const tasks = [...sel.damaged, ...sel.clean];
    let rows = [], goldRows = [];
    for (const n of names) { rows = rows.concat(readRows(join(armsDir, n, 'runs.jsonl'))); goldRows = goldRows.concat(readRows(join(screenDir, n, 'runs.jsonl'))); }
    const gold = goldBroken(goldRows);
    const score = (arm) => perTask(rows, gold, arm, tasks);
    const pairs = [PRIMARY, ...SECONDARY];
    const res = pairs.map(([ref, arm]) => ({ ref, arm, ...compare(score(ref), score(arm)) }));
    const adj = holm(res.slice(1).map((r) => r.p));
    res.slice(1).forEach((r, i) => { r.p_holm = adj[i]; });
    const out = { at: new Date().toISOString(), tasks: tasks.length, primary: res[0], secondary: res.slice(1), per_task: Object.fromEntries(['none', 'file', 'stop', 'hooks'].map((a) => [a, score(a)])) };
    writeFileSync(join(armsDir, 'analysis.json'), JSON.stringify(out, null, 2) + '\n');
    console.log('| comparison | tasks | for the arm | against | ties | p | Holm p | success |\n|---|---|---|---|---|---|---|---|');
    for (const r of res) console.log(`| ${r.arm} against ${r.ref} | ${r.n} | ${r.for} | ${r.against} | ${r.ties} | ${r.p.toFixed(4)} | ${r.p_holm === undefined ? 'primary' : r.p_holm.toFixed(4)} | ${r.success ? 'yes' : 'no'} |`);
    return 0;
  }

  if (cmd === 'replay') {
    let rows = [], goldRows = [];
    const named = {};
    for (const n of names) {
      const d = JSON.parse(readFileSync(ds(n), 'utf8'));
      const screen = readRows(join(screenDir, n, 'runs.jsonl'));
      goldRows = goldRows.concat(screen);
      rows = rows.concat(screen.filter((r) => r.arm === 'none'), readRows(join(armsDir, n, 'runs.jsonl')).map((r) => ({ ...r, arm: `arms:${r.arm}` })));
      for (const t of d.tasks) {
        const bp = join(screenDir, n, 'baseline', `${t.base.slice(0, 12)}.json`);
        if (existsSync(bp)) named[t.id] = JSON.parse(readFileSync(bp, 'utf8')).risky?.tests || {};
      }
    }
    const r = replay(rows, goldBroken(goldRows), named);
    mkdirSync(armsDir, { recursive: true });
    writeFileSync(join(armsDir, 'replay.json'), JSON.stringify({ at: new Date().toISOString(), ...r }, null, 2) + '\n');
    console.log(`the named tests hold ${r.caught} of ${r.total} breaks`);
    for (const arm of [...new Set(r.breaks.map((b) => b.arm))]) { const x = r.breaks.filter((b) => b.arm === arm); console.log(`  ${arm}: ${x.filter((b) => b.caught).length} of ${x.length}`); }
    return 0;
  }

  console.error('usage: node bench/damage.mjs screen-set|select|analyze|replay [--set a,b] [--data-dir d] [--screen-dir d] [--arms-dir d]');
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(cli());
