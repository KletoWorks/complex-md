#!/usr/bin/env node
// Backtest the map against a repository's own fix history.
//
// For each of the last N fix commits: check out the parent, compute signals
// there, and ask whether the files the fix touched were in the hotspot list.
// Reports file-level recall for the 0.3 score, for the 0.2 score
// (churn_w * loc), for the fixes count, and for recency-weighted churn alone,
// against chance (K / rankable files). This is the evidence behind the
// ordering in complex_where_to_look and the hotspot cut.
//
//   node bench/backtest.mjs /path/to/repo [N=40]
//
// No model, no agent: pure history. It measures whether the list points at
// where the next fix lands, not whether an agent does better with it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeSignals, FIX_RE } from '../cli/src/signals.js';
import { buildGraph, RANKED_KINDS } from '../cli/src/graph.js';

const repo = process.argv[2];
const N = Number(process.argv[3] || 40);
if (!repo) {
  console.error('usage: node bench/backtest.mjs <repo> [fix-commits=40]');
  process.exit(2);
}
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });

const log = git(['log', '--no-merges', '-n', '1500', '--name-only', '--pretty=format:@%H\t%s']).split('\n');
const fixes = [];
let cur = null;
for (const l of log) {
  if (l.startsWith('@')) {
    const [h, s] = l.slice(1).split('\t');
    cur = FIX_RE.test(s) ? { h, s, files: [] } : null;
    if (cur) fixes.push(cur);
  } else if (l && cur) cur.files.push(l);
}

const wt = mkdtempSync(join(tmpdir(), 'complex-md-backtest-'));
const res = [];
let Ksum = 0;
for (const fx of fixes) {
  if (res.length >= N) break;
  if (fx.files.length === 0 || fx.files.length > 30) continue;
  let parent;
  try { parent = git(['rev-parse', `${fx.h}^`]).trim(); } catch { continue; }
  const dir = join(wt, fx.h.slice(0, 8));
  try { git(['worktree', 'add', '-q', '--detach', dir, parent]); } catch { continue; }
  try {
    const g = buildGraph(dir, git(['ls-files'], dir).split('\n').filter(Boolean));
    const touched = fx.files.filter((f) => g.kinds.get(f) in RANKED_KINDS);
    if (!touched.length) continue;
    const s = computeSignals(dir, { tableRows: 1e9 });
    const rows = s.table;
    const K = s.hotspots.length;
    Ksum += K;
    const topBy = (fn) => new Set([...rows].sort((a, b) => fn(b) - fn(a)).slice(0, K).map((r) => r.path));
    const lists = {
      score: new Set(s.hotspots.map((r) => r.path)),
      score02: topBy((r) => r.churn_w * r.loc),
      fixes: topBy((r) => r.fixes * 1e6 + r.score),
      churn: topBy((r) => r.churn_w),
    };
    const partners = new Set(s.co_change.flatMap((c) => c.files));
    const row = { sha: fx.h.slice(0, 7), subject: fx.s.slice(0, 60), n: touched.length, scope: rows.length, partner: touched.filter((f) => partners.has(f)).length };
    for (const [k, set] of Object.entries(lists)) row[k] = touched.filter((f) => set.has(f)).length;
    res.push(row);
  } finally {
    git(['worktree', 'remove', '--force', dir]);
  }
}
rmSync(wt, { recursive: true, force: true });

if (!res.length) {
  console.log(`${repo}: no fix commits touching rankable files found`);
  process.exit(0);
}
const sum = (k) => res.reduce((a, r) => a + r[k], 0);
const files = sum('n');
const scope = res.reduce((a, r) => a + r.scope, 0) / res.length;
const pct = (k) => `${(100 * sum(k) / files).toFixed(0)}%`;
const any = (k) => res.filter((r) => r[k] > 0).length;
console.log(`${repo}`);
console.log(`  ${res.length} fix commits, ${files} rankable files touched, mean scope ${Math.round(scope)} rankable files, mean hotspot list ${(Ksum / res.length).toFixed(1)} (chance per file ${(100 * Ksum / res.length / scope).toFixed(1)}%)`);
console.log(`  file-level recall    score ${pct('score')}   0.2 score ${pct('score02')}   by fixes ${pct('fixes')}   by churn_w ${pct('churn')}   in a co-change pair ${pct('partner')}`);
console.log(`  commit-level hit     score ${any('score')}/${res.length}   0.2 score ${any('score02')}/${res.length}   by fixes ${any('fixes')}/${res.length}   by churn_w ${any('churn')}/${res.length}`);
if (process.argv.includes('--verbose')) for (const r of res) console.log(`  ${r.sha} n=${r.n} score=${r.score} churn=${r.churn}  ${r.subject}`);
