#!/usr/bin/env node
// The test selection backtest. For each bug fix commit, at the fix's
// parent: which test files would each selector tell an agent to run for
// the files the fix changed, and does that set contain the test files the
// fix itself changed. No model, no agent: the graph and the history.
//
//   node bench/e1.mjs --repo <clone> --name <name> [--max 150] [--out bench/results/e1]
//
// Selectors, from narrow to wide. T(x) is the set of test files whose
// import, path literal or exact name points at x (the map's covering
// tests).
//   a  direct    T(f): the covering tests the map names today.
//   b  depth 2   T(f) plus T(m) for every file m that imports f.
//   c  roots     T(x) for f and for every package root or barrel file that
//                reaches f through package roots and barrels only. A test
//                that imports '..' reaches the package root.
//   d  history   test files changed in an earlier commit that modified f.
//   e  closure   T(x) for f and every file that reaches f by any import
//                chain, package roots included.
// Ranked cuts, a supplement to the five: the decision bar is a recall at
// a suite share, and only a ranked list can be cut at a share.
//   e15, e20     e ranked by import distance, then by co-change count, cut
//                at 15% and 20% of the suite.
//   m15, m20     e and d together, ranked by co-change count, then by
//                import distance, cut at 15% and 20% of the suite.
// The ground truth is the set of suite test files the fix modified. A test
// file the fix added did not exist at the parent, so no selector can name
// it; such fixes are dropped and counted. The suite is the test files the
// repository's own scripts run (bench/suite.mjs).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIX_RE } from '../cli/src/signals.js';
import { buildGraph, classify, RANKED_KINDS, IMPORTER_KINDS } from '../cli/src/graph.js';
import { listTestFiles } from './suite.mjs';

export const SELECTORS = ['a', 'b', 'c', 'd', 'e', 'e15', 'e20', 'm15', 'm20'];
const BULK = 30;
const SHARE_CUT = 0.15;
const SHARE_KILL = 0.2;

export function bandOf(fanIn) {
  if (fanIn <= 0) return '0';
  if (fanIn <= 5) return '1-5';
  if (fanIn <= 20) return '6-20';
  return '>20';
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });

/** Non-merge commits, newest first: { sha, date, subject, files: [{ status, path }] }. */
function history(repo) {
  const out = [];
  let cur = null;
  for (const line of git(repo, ['log', '--no-merges', '--no-renames', '--name-status', '--format=@%H%x09%aI%x09%s', 'HEAD']).split('\n')) {
    if (line.startsWith('@')) {
      const [sha, date, ...s] = line.slice(1).split('\t');
      out.push((cur = { sha, date, subject: s.join('\t'), files: [] }));
    } else if (line && cur) {
      const [status, path] = line.split('\t');
      if (path) cur.files.push({ status: status[0], path });
    }
  }
  return out;
}

const isTestPath = (p) => classify(p) === 'test';
const isSourcePath = (p) => classify(p) in RANKED_KINDS;

/* A file that only gathers other modules: at least 80% of its code lines
   are imports, re-exports, requires, object keys or closing brackets. */
const REEXPORT_LINE = [/\brequire\s*\(/, /^\s*import\s/, /^\s*export\s*(\*|\{)/, /^\s*export\s+.*\sfrom\s/, /^\s*module\.exports\s*=\s*(\{|require\()/, /^\s*[\w$]+\s*(:\s*[\w$.]+)?\s*,?\s*$/, /^\s*[\]}),;]+\s*$/];
export function isBarrel(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !/^(\/\/|\/\*|\*|'use strict'|"use strict")/.test(l));
  if (!lines.length || lines.length > 200) return false;
  return lines.filter((l) => REEXPORT_LINE.some((re) => re.test(l))).length / lines.length >= 0.8;
}

const SPEC_RE = /(?:import|export)\s*(?:[\w*\s{},$]*?\s*from\s*)?['"]([^'"\n]+)['"]|\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)|\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const JS_FILE = /\.(m?js|cjs|jsx|ts|mts|cts|tsx)$/;
const EXTS = ['', '.js', '.mjs', '.cjs', '.ts', '.json', '/index.js', '/index.mjs', '/index.cjs', '/index.ts'];

/**
 * The import graph plus the edges it leaves out: a specifier that names a
 * package directory ('..', '../..', '.') or the package's own name resolves
 * to that package's entry file. Returns { rev: Map to -> Set(from), roots, barrels }.
 */
export function rootGraph(root, tracked, graph) {
  const files = new Set(tracked);
  const probe = (base) => { for (const e of EXTS) if (files.has(base + e)) return base + e; return null; };
  const pkgs = [];
  for (const f of tracked) {
    if (posix.basename(f) !== 'package.json' || /(^|\/)(node_modules|fixtures?|test|tests)\//.test(f)) continue;
    let pj;
    try { pj = JSON.parse(readFileSync(join(root, f), 'utf8')); } catch { continue; }
    const dir = posix.dirname(f);
    const at = (p) => probe(posix.normalize(posix.join(dir, p)).replace(/^\.\//, ''));
    const entries = new Set();
    for (const m of [pj.main || 'index.js', pj.module].filter((x) => typeof x === 'string')) { const r = at(m); if (r) entries.add(r); }
    const walk = (v) => { if (typeof v === 'string') { if (v.startsWith('./') && !v.includes('*')) { const r = at(v); if (r) entries.add(r); } } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(pj.exports);
    const main = at(pj.main || 'index.js');
    pkgs.push({ dir, name: pj.name || null, main, entries });
  }
  const roots = new Set(pkgs.flatMap((p) => [...p.entries]));
  const byDir = new Map(pkgs.map((p) => [p.dir, p]));
  const rev = new Map();
  const addRev = (from, to) => {
    if (!to || to === from) return;
    let s = rev.get(to);
    if (!s) rev.set(to, (s = new Set()));
    s.add(from);
  };
  for (const [from, set] of graph.edges) for (const to of set) addRev(from, to);
  for (const f of tracked) {
    if (!JS_FILE.test(f)) continue;
    const kind = graph.kinds.get(f);
    if (kind !== 'test' && !IMPORTER_KINDS.has(kind)) continue;
    let text;
    try { text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    SPEC_RE.lastIndex = 0;
    let m;
    while ((m = SPEC_RE.exec(text))) {
      const spec = m[1] || m[2] || m[3];
      if (spec.startsWith('.')) {
        /* A directory: its package entry, or its index file. The base
           graph resolves neither '..' nor a specifier with a trailing
           slash such as '../../lib/'. */
        const d = posix.normalize(posix.join(posix.dirname(f), spec)).replace(/\/$/, '');
        const pkg = byDir.get(d);
        if (pkg?.main) addRev(f, pkg.main);
        else if (d !== '.' && !d.startsWith('..')) addRev(f, probe(d));
      } else {
        for (const p of pkgs) {
          if (!p.name || (spec !== p.name && !spec.startsWith(p.name + '/'))) continue;
          addRev(f, spec === p.name ? p.main : probe(posix.join(p.dir === '.' ? '' : p.dir, spec.slice(p.name.length + 1)).replace(/^\//, '')));
        }
      }
    }
  }
  const barrels = new Set();
  for (const f of tracked) {
    if (graph.kinds.get(f) !== 'source' || !JS_FILE.test(f)) continue;
    try { if (isBarrel(readFileSync(join(root, f), 'utf8'))) barrels.add(f); } catch {}
  }
  return { rev, roots, barrels };
}

/* Test files that point at x: the map's covering tests, plus test files
   whose only edge to x is one the base graph does not resolve. */
function testsOf(x, graph, rg, suite) {
  const out = new Set();
  for (const t of graph.tests.get(x) || []) if (suite.has(t)) out.add(t);
  for (const t of rg.rev.get(x) || []) if (suite.has(t) && graph.kinds.get(t) === 'test') out.add(t);
  return out;
}

/** The selections for one changed file at the parent commit. `cochange` maps test file -> count. */
export function select(f, { graph, rg, suite, cochange }) {
  const base = (x) => new Set([...(graph.tests.get(x) || [])].filter((t) => suite.has(t)));
  const a = base(f);
  const b = new Set(a);
  for (const m of graph.fanIn.get(f) || []) for (const t of base(m)) b.add(t);
  const nonTestImporters = (x) => [...(rg.rev.get(x) || [])].filter((y) => graph.kinds.get(y) !== 'test' && IMPORTER_KINDS.has(graph.kinds.get(y)));
  const c = new Set(testsOf(f, graph, rg, suite));
  {
    const seen = new Set([f]);
    const stack = [f];
    while (stack.length) {
      const x = stack.pop();
      for (const y of nonTestImporters(x)) {
        if (seen.has(y) || !(rg.roots.has(y) || rg.barrels.has(y))) continue;
        seen.add(y);
        stack.push(y);
        for (const t of testsOf(y, graph, rg, suite)) c.add(t);
      }
    }
  }
  const d = new Set([...cochange.keys()].filter((t) => suite.has(t)));
  const dist = new Map();
  {
    const depth = new Map([[f, 0]]);
    let frontier = [f];
    for (let k = 0; frontier.length; k += 1) {
      const next = [];
      for (const x of frontier) {
        for (const t of testsOf(x, graph, rg, suite)) if (!dist.has(t)) dist.set(t, k + 1);
        for (const y of nonTestImporters(x)) if (!depth.has(y)) { depth.set(y, k + 1); next.push(y); }
      }
      frontier = next;
    }
  }
  const e = new Set(dist.keys());
  return { a, b, c, d, e, dist };
}

/* A ranked cut: the first n tests by `key`, ties broken by path. */
function cut(tests, key, n) {
  return [...tests].sort((x, y) => key(x, y) || (x < y ? -1 : 1)).slice(0, n);
}
const byDistance = (dist, co) => (x, y) => (dist.get(x) ?? Infinity) - (dist.get(y) ?? Infinity) || (co.get(y) || 0) - (co.get(x) || 0);
const byHistory = (dist, co) => (x, y) => (co.get(y) || 0) - (co.get(x) || 0) || (dist.get(x) ?? Infinity) - (dist.get(y) ?? Infinity);

function aggregate(rows) {
  const out = {};
  for (const k of SELECTORS) {
    const truth = rows.reduce((s, r) => s + r.truth.length, 0);
    const hits = rows.reduce((s, r) => s + r.selectors[k].hits, 0);
    const shares = rows.map((r) => r.selectors[k].size / r.suite).sort((x, y) => x - y);
    out[k] = {
      fixes: rows.length,
      truth,
      hits,
      recall: truth ? round(hits / truth) : null,
      any_hit: rows.length ? round(rows.filter((r) => r.selectors[k].hits > 0).length / rows.length) : null,
      share_mean: rows.length ? round(shares.reduce((s, v) => s + v, 0) / rows.length) : null,
      share_median: rows.length ? round(shares[shares.length >> 1]) : null,
    };
  }
  return out;
}
const round = (v) => Math.round(v * 1e4) / 1e4;

/** Summary per fan-in band. `rows` are scored fixes. */
export function summarise(rows) {
  const byBand = (list) => {
    const out = {};
    for (const band of ['0', '1-5', '6-20', '>20']) {
      const inBand = list.filter((r) => r.band === band);
      if (inBand.length) out[band] = aggregate(inBand);
    }
    out.all = aggregate(list);
    return out;
  };
  return { by_fix: byBand(rows), single_source_file: byBand(rows.filter((r) => r.changed.length === 1)) };
}

/* The decision bar: 80% recall at 15% suite share in bands 1-5 and 6-20.
   Under 60% recall at 20% share in those bands means "run the full suite". */
export function verdict(byBand) {
  const bands = ['1-5', '6-20'].filter((b) => byBand[b]);
  const sels = [...new Set(bands.flatMap((b) => Object.keys(byBand[b])))];
  const all = (fn) => sels.filter((k) => bands.length && bands.every((b) => byBand[b][k] && fn(byBand[b][k])));
  const meets = all((s) => s.recall >= 0.8 && s.share_mean <= SHARE_CUT);
  const usable = all((s) => s.recall >= 0.6 && s.share_mean <= SHARE_KILL);
  return { bands, meets_bar: meets, full_suite_advice: usable.length === 0 };
}

/* The selections at one commit for a set of changed files, each selector
   the union over the files. `parent` is the checked out commit; history
   for selector d is the commits before it that modified each file. */
function selectionsAt({ repo, parent, tracked, worktree, graph, suite, changed, commits, modifiedBy }) {
  const rg = rootGraph(worktree, tracked, graph);
  const ancestors = new Set(git(repo, ['rev-list', parent]).split('\n').filter(Boolean));
  const union = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, new Set()]));
  const dist = new Map();
  const cochange = new Map();
  const changedRows = [];
  for (const f of changed) {
    const co = new Map();
    for (const i of modifiedBy.get(f) || []) {
      if (!ancestors.has(commits[i].sha)) continue;
      for (const fl of commits[i].files) if (isTestPath(fl.path)) co.set(fl.path, (co.get(fl.path) || 0) + 1);
    }
    for (const [t, n] of co) cochange.set(t, (cochange.get(t) || 0) + n);
    const s = select(f, { graph, rg, suite, cochange: co });
    for (const k of Object.keys(union)) for (const t of s[k]) union[k].add(t);
    for (const [t, dd] of s.dist) if (!dist.has(t) || dist.get(t) > dd) dist.set(t, dd);
    const fanIn = graph.fanIn.get(f)?.size || 0;
    changedRows.push({ path: f, fan_in: fanIn, band: bandOf(fanIn) });
  }
  const n = (share) => Math.max(1, Math.floor(share * suite.size));
  const co = new Map([...cochange].filter(([t]) => suite.has(t)));
  const mixed = new Set([...union.e, ...union.d]);
  const ranked = {
    e15: cut(union.e, byDistance(dist, co), n(SHARE_CUT)),
    e20: cut(union.e, byDistance(dist, co), n(SHARE_KILL)),
    m15: cut(mixed, byHistory(dist, co), n(SHARE_CUT)),
    m20: cut(mixed, byHistory(dist, co), n(SHARE_KILL)),
  };
  return { changedRows, sets: { ...union, ...Object.fromEntries(Object.entries(ranked).map(([k, v]) => [k, new Set(v)])) } };
}

/* Commits that modified each path (indexes into `commits`), for selector d. */
function modifiedIndex(commits) {
  const modifiedBy = new Map();
  commits.forEach((c, i) => {
    if (c.files.length > BULK) return;
    for (const fl of c.files) if (fl.status === 'M') { let l = modifiedBy.get(fl.path); if (!l) modifiedBy.set(fl.path, (l = [])); l.push(i); }
  });
  return modifiedBy;
}

function openWorktree(repo, worktree) {
  if (existsSync(worktree)) { try { git(repo, ['worktree', 'remove', '--force', worktree]); } catch {} rmSync(worktree, { recursive: true, force: true }); }
  git(repo, ['worktree', 'add', '-q', '--detach', worktree, 'HEAD']);
}
function closeWorktree(repo, worktree) {
  try { git(repo, ['worktree', 'remove', '--force', worktree]); } catch {}
  rmSync(worktree, { recursive: true, force: true });
}

/**
 * The tests agent patches broke in a damage run, against what each selector
 * names for the source files the patch edited, at the task's base commit.
 * `rows` are runs.jsonl rows; arms that broke the same task are merged.
 */
export function knownBreaks({ repo, worktree, rows, dataset }) {
  const byTask = new Map();
  for (const r of rows) {
    if (!r.regressions?.length) continue;
    const k = byTask.get(r.task) || { edited: new Set(), broken: new Set(), arms: [] };
    for (const f of r.edited || []) k.edited.add(f);
    for (const key of r.regressions) k.broken.add(key.split(' :: ')[0]);
    k.arms.push(r.arm);
    byTask.set(r.task, k);
  }
  if (!byTask.size) return [];
  const commits = history(repo);
  const modifiedBy = modifiedIndex(commits);
  const out = [];
  openWorktree(repo, worktree);
  try {
    for (const [id, k] of byTask) {
      const task = dataset.tasks.find((x) => x.id === id);
      if (!task) continue;
      git(worktree, ['checkout', '-q', '--detach', '-f', task.base]);
      const tracked = git(worktree, ['ls-files']).split('\n').filter(Boolean);
      const suite = new Set(listTestFiles(worktree));
      const graph = buildGraph(worktree, tracked);
      const changed = [...k.edited].filter((f) => graph.kinds.get(f) in RANKED_KINDS).sort();
      const broken = [...k.broken].sort();
      const { changedRows, sets } = selectionsAt({ repo, worktree, parent: task.base, tracked, graph, suite, changed, commits, modifiedBy });
      const selectors = {};
      const caught = {};
      for (const [s, set] of Object.entries(sets)) {
        selectors[s] = { size: set.size, share: round(set.size / suite.size), caught: broken.filter((t) => set.has(t)) };
        caught[s] = selectors[s].caught.length;
      }
      out.push({ task: id, base: task.base.slice(0, 10), arms: k.arms, edited: changed, changed: changedRows, broken, suite: suite.size, caught, selectors });
    }
  } finally {
    closeWorktree(repo, worktree);
  }
  return out;
}

/** The whole backtest for one repository. */
export function runRepo({ repo, name, max = 150, worktree, log = () => {} }) {
  const commits = history(repo);
  const head = commits[0]?.sha || null;
  const modifiedBy = modifiedIndex(commits);
  const dropped = { bulk: 0, no_source_changed: 0, test_added_only: 0, no_test_changed: 0, no_parent: 0, truth_not_in_suite: 0, no_source_at_parent: 0, over_cap: 0 };
  const droppedList = [];
  const drop = (c, reason) => { dropped[reason] += 1; droppedList.push({ sha: c.sha.slice(0, 10), reason }); };
  const candidates = [];
  for (const c of commits) {
    if (!FIX_RE.test(c.subject)) continue;
    if (c.files.length > BULK) { drop(c, 'bulk'); continue; }
    const src = c.files.filter((x) => x.status !== 'A' && !isTestPath(x.path) && isSourcePath(x.path));
    if (!src.length) { drop(c, 'no_source_changed'); continue; }
    const tests = c.files.filter((x) => isTestPath(x.path));
    if (!tests.some((x) => x.status === 'M')) { drop(c, tests.some((x) => x.status === 'A') ? 'test_added_only' : 'no_test_changed'); continue; }
    candidates.push(c);
  }
  openWorktree(repo, worktree);
  const rows = [];
  try {
    for (const c of candidates) {
      if (rows.length >= max) { drop(c, 'over_cap'); continue; }
      let parent;
      try { parent = git(repo, ['rev-parse', `${c.sha}^`]).trim(); } catch { drop(c, 'no_parent'); continue; }
      git(worktree, ['checkout', '-q', '--detach', '-f', parent]);
      const tracked = git(worktree, ['ls-files']).split('\n').filter(Boolean);
      const suite = new Set(listTestFiles(worktree));
      const truth = c.files.filter((x) => x.status === 'M' && suite.has(x.path)).map((x) => x.path).sort();
      if (!truth.length) { drop(c, 'truth_not_in_suite'); continue; }
      const graph = buildGraph(worktree, tracked);
      const changed = c.files.filter((x) => x.status !== 'A' && (graph.kinds.get(x.path) in RANKED_KINDS)).map((x) => x.path);
      if (!changed.length) { drop(c, 'no_source_at_parent'); continue; }
      const { changedRows, sets } = selectionsAt({ repo, worktree, parent, tracked, graph, suite, changed, commits, modifiedBy });
      const maxFan = Math.max(...changedRows.map((r) => r.fan_in));
      const selectors = {};
      for (const [k, set] of Object.entries(sets)) {
        const tests = [...set].sort();
        selectors[k] = { size: tests.length, hits: truth.filter((t) => set.has(t)).length, tests: tests.length <= 40 ? tests : undefined };
      }
      rows.push({ sha: c.sha.slice(0, 10), parent: parent.slice(0, 10), date: c.date.slice(0, 10), subject: c.subject.slice(0, 120), changed: changedRows, band: bandOf(maxFan), truth, suite: suite.size, selectors });
      log(`${rows.length} ${c.sha.slice(0, 8)} band ${bandOf(maxFan)} truth ${truth.length} a ${selectors.a.hits}/${selectors.a.size} c ${selectors.c.hits}/${selectors.c.size} e ${selectors.e.hits}/${selectors.e.size}`);
    }
  } finally {
    closeWorktree(repo, worktree);
  }
  const summary = summarise(rows);
  return {
    name,
    head,
    max,
    counts: { commits: commits.length, fix_subjects: commits.filter((c) => FIX_RE.test(c.subject)).length, candidates: candidates.length, scored: rows.length, dropped },
    summary,
    verdict: { by_fix: verdict(summary.by_fix), single_source_file: verdict(summary.single_source_file) },
    fixes: rows,
    dropped: droppedList,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const repo = opt('--repo');
  const name = opt('--name');
  /* --summary <dir>: pool the per repository results in <dir> into summary.json. */
  if (opt('--summary')) {
    const dir = opt('--summary');
    const repos = readdirSync(dir).filter((f) => /^[\w.-]+\.json$/.test(f) && !/-known\.json$|^summary\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
    const rows = repos.flatMap((r) => r.fixes.map((x) => ({ ...x, repo: r.name })));
    const summary = summarise(rows);
    const out = {
      repositories: Object.fromEntries(repos.map((r) => [r.name, { head: r.head, counts: r.counts, verdict: r.verdict, by_fix: r.summary.by_fix }])),
      pooled: { fixes: rows.length, verdict: { by_fix: verdict(summary.by_fix), single_source_file: verdict(summary.single_source_file) }, ...summary },
    };
    writeFileSync(join(dir, 'summary.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify(out.pooled.verdict));
    process.exit(0);
  }
  if (!repo || !name) { console.error('usage: node bench/e1.mjs --repo <clone> --name <name> [--max 150] [--out bench/results/e1]'); process.exit(2); }
  const out = opt('--out', 'bench/results/e1');
  mkdirSync(out, { recursive: true });
  /* --known <resultsDir> --dataset <path>: score the selectors on the tests
     the agent patches in a damage run broke, instead of the fix history. */
  if (opt('--known')) {
    const rows = readFileSync(join(opt('--known'), 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const known = knownBreaks({ repo: resolve(repo), worktree: resolve(repo) + '-e1-wt', rows, dataset: JSON.parse(readFileSync(opt('--dataset'), 'utf8')) });
    writeFileSync(join(out, `${name}-known.json`), JSON.stringify({ name, results: opt('--known'), breaks: known }, null, 1) + '\n');
    console.log(JSON.stringify(known.map((k) => ({ task: k.task, broken: k.broken, caught: k.caught })), null, 1));
    process.exit(0);
  }
  const t0 = Date.now();
  const r = runRepo({ repo: resolve(repo), name, max: Number(opt('--max', 150)), worktree: resolve(repo) + '-e1-wt', log: (s) => process.stderr.write(s + '\n') });
  r.seconds = Math.round((Date.now() - t0) / 1000);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(r, null, 1) + '\n');
  console.log(JSON.stringify({ name, counts: r.counts, verdict: r.verdict, seconds: r.seconds }, null, 2));
}
