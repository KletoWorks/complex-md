#!/usr/bin/env node
// Summarize runs.jsonl: per arm, then paired per task against the `none` arm.
//   node bench/report.mjs bench/results/pilot/runs.jsonl
import { readFileSync } from 'node:fs';
import { summarise, pairsNeeded } from './stats.mjs';

const path = process.argv[2] || 'bench/results/run/runs.jsonl';
const runs = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  // Runs the harness stopped at the first edit end with Claude reporting error_during_execution; that is the stop, not a failure.
  .map((r) => (r.stopped && r.error === 'error_during_execution' ? { ...r, error: null } : r));
const arms = [...new Set(runs.map((r) => r.arm))];
const byTask = new Map();
for (const r of runs) (byTask.get(r.task) || byTask.set(r.task, {}).get(r.task))[r.arm] = r;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const f1 = (x) => (Number.isNaN(x) ? '-' : x.toFixed(1));
const pct = (x) => (Number.isNaN(x) ? '-' : `${Math.round(x * 100)}%`);

console.log(`## Per arm (n = runs)\n`);
console.log('| arm | n | found gold | steps to first gold read (median / mean) | wasted reads before it (mean) | gold edited | success | gate fired | MCP calls | cost/run |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const arm of arms) {
  const rs = runs.filter((r) => r.arm === arm && !r.error);
  const found = rs.filter((r) => r.first_gold_read !== null);
  const steps = found.map((r) => r.first_gold_read);
  const cost = rs.map((r) => r.cost_usd).filter((c) => c != null);
  const judged = rs.filter((r) => r.success === true || r.success === false);
  const succ = judged.length ? pct(judged.filter((r) => r.success).length / judged.length) + ` (n=${judged.length})` : '-';
  console.log(`| ${arm} | ${rs.length} | ${pct(found.length / rs.length)} | ${f1(median(steps))} / ${f1(mean(steps))} | ${f1(mean(rs.map((r) => r.wasted_reads)))} | ${pct(rs.filter((r) => r.gold_edited).length / rs.length)} | ${succ} | ${rs.filter((r) => r.gate_fired).length} | ${rs.reduce((a, r) => a + (r.mcp_calls || 0), 0)} | ${cost.length ? '$' + f1(mean(cost) * 100) + 'c' : '-'} |`);
}

// Paired: the same task under each arm versus `none`. Sign test on steps to first gold read.
if (arms.includes('none')) {
  console.log(`\n## Paired against none (same task, same base commit)\n`);
  console.log('| arm | pairs | fewer steps | same | more | mean Δ steps | mean Δ wasted reads | Δ found gold |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const arm of arms.filter((a) => a !== 'none')) {
    let win = 0, tie = 0, loss = 0; const ds = [], dw = []; let dfound = 0, pairs = 0;
    for (const [, t] of byTask) {
      const a = t.none, b = t[arm];
      if (!a || !b || a.error || b.error) continue;
      pairs++;
      const sa = a.first_gold_read ?? a.steps + 1, sb = b.first_gold_read ?? b.steps + 1; // not found: worse than every step taken
      if (sb < sa) win++; else if (sb === sa) tie++; else loss++;
      ds.push(sb - sa); dw.push(b.wasted_reads - a.wasted_reads);
      dfound += (b.first_gold_read !== null) - (a.first_gold_read !== null);
    }
    console.log(`| ${arm} | ${pairs} | ${win} | ${tie} | ${loss} | ${f1(mean(ds))} | ${f1(mean(dw))} | ${dfound >= 0 ? '+' : ''}${dfound} |`);
  }
  const split = (label, pred) => {
    const rs = runs.filter((r) => !r.error && pred(r));
    if (!rs.length) return;
    console.log(`\n${label}: ` + arms.map((arm) => { const x = rs.filter((r) => r.arm === arm); const st = x.filter((r) => r.first_gold_read !== null).map((r) => r.first_gold_read); return `${arm} n=${x.length} median ${f1(median(st))}`; }).join('; '));
  };
  split('Issue text names a gold file', (r) => r.names_gold);
  split('Issue text does not name a gold file', (r) => !r.names_gold);
}
  /* The tests that survive this distribution. Steps to first gold read is
     discrete, skewed and floored at 1, and a few long runs carry most of the
     variance, so a mean and a t-test overstate what the data supports. The
     Wilcoxon signed rank is the primary test, matching arXiv 2601.20404 on
     the same shape of data; the trimmed mean and the sign test sit beside it.
     Output tokens and wall clock are reported because they are what that
     paper measured and what a user actually feels. */
  const METRICS = [
    ['steps to first gold read', (r) => r.first_gold_read ?? (r.steps + 1)],
    ['output tokens', (r) => r.tokens_out],
    ['wall clock ms', (r) => r.duration_ms],
    ['cost usd', (r) => r.cost_usd],
    ['diff lines', (r) => r.diff_lines],
    ['cache read tokens', (r) => r.tokens_cache_read],
  ];
  console.log('\n## Paired tests against none\n');
  console.log('| arm | metric | pairs | median none | median arm | median % | trimmed Δ | Wilcoxon p | sign p | min detectable |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const arm of arms.filter((a) => a !== 'none')) {
    for (const [label, get] of METRICS) {
      const pairs = [];
      for (const [, t] of byTask) {
        const a = t.none, b = t[arm];
        if (!a || !b || a.error || b.error) continue;
        const va = get(a), vb = get(b);
        if (va == null || vb == null || Number.isNaN(va) || Number.isNaN(vb)) continue;
        pairs.push([va, vb]);
      }
      if (pairs.length < 4) continue;
      const q = summarise(pairs);
      const pv = (x) => (Number.isNaN(x) ? '-' : x.toFixed(3));
      console.log(`| ${arm} | ${label} | ${q.pairs} | ${f1(q.median_a)} | ${f1(q.median_b)} | ${Number.isNaN(q.median_pct) ? '-' : q.median_pct.toFixed(1) + '%'} | ${f1(q.trimmed_delta)} | ${pv(q.wilcoxon.p)} | ${pv(q.sign.p)} | ${f1(q.min_detectable)} |`);
    }
  }
  console.log('\nNegative favours the arm. Wilcoxon is the primary test; the mean is not, because a few long runs carry the variance.');

const errs = runs.filter((r) => r.error);
if (errs.length) console.log(`\n${errs.length} runs with errors: ${errs.map((r) => `${r.task}/${r.arm}`).join(', ')}`);
