#!/usr/bin/env node
// Co-change partner misses: when an agent edits one file of a co-change
// pair, does it look at the other file before it finishes. A map lists the
// pairs and tells the agent to open the partner, so fewer misses with the
// map is the effect it claims.
//
//   node bench/partners.mjs            writes bench/results/partners.json
//
// The pairs are the source co-change pairs the harness computed at each
// task's base commit (bench/results/<run>/baseline), the same for every
// arm. Two definitions of "looked at":
//   recorded   the agent read or edited the partner with Read or an edit
//              tool. This is the harness's own partners_missed field.
//   corrected  a tool call targets the partner: Read or an edit on it, a
//              Grep or Glob whose path is the partner, or a Bash command
//              such as cat or sed that names it. A Grep pattern does not
//              count, and neither does a command that reads COMPLEX.md,
//              because naming a path there is not opening the file. The
//              recorded definition counts a partner viewed through Bash as
//              missed. This definition was set after the recorded result
//              was known, so its p values are exploratory. A Bash command
//              that names the partner without reading it, such as a test
//              run, also counts as seen.
// Two pairing units, each compared with McNemar's exact test:
//   edit       one edited file in one task, paired when both arms edited
//              that file (the pairing rule of bench/comply.mjs). Primary.
//   run        one task, paired when both arms have a row; a run misses
//              when any partner of any edited file went unseen.
// A run that ended in an error (a budget stop) is still scored: the agent
// had the same chance to open the partner before it stopped. The run level
// is also given without those runs, which is how the harness counted it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mcnemar } from './stats.mjs';

/** Pairs of source files: a docs page that co-changes with a module is real, but not opening it is no risk. */
export function sourcePairs(coChange) {
  const source = (f) => !/\.(md|mdx|txt|rst)$/i.test(f);
  return coChange.filter((pair) => pair.every(source));
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does `text` name the repository path `path`. `root` is the worktree, stripped from absolute paths first. */
export function mentions(text, path, root = null) {
  const t = root ? text.split(root.replace(/\/$/, '') + '/').join(' ') : text;
  return new RegExp(`(?:^|[\\s'"\`=(:,\\[])(?:\\./)?${escape(path)}(?![\\w-]|\\.\\w)`).test(t);
}

/** { editedFile: [partners not seen] } for every edited file that is one side of a pair. */
export function partnerOutcomes(edited, pairs, seen) {
  const out = {};
  for (const f of edited) {
    const partners = new Set();
    for (const [a, b] of pairs) {
      if (a === f) partners.add(b);
      if (b === f) partners.add(a);
    }
    if (!partners.size) continue;
    out[f] = [...partners].filter((p) => !seen(p));
  }
  return out;
}

/** Every tool call as { name, input }, and the worktree the run used. */
function toolCalls(transcript) {
  const calls = [];
  let cwd = null;
  for (const line of transcript.split('\n')) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev?.type === 'system' && ev.subtype === 'init') cwd ??= ev.cwd || null;
    if (ev?.type !== 'assistant') continue;
    for (const c of ev.message?.content || []) if (c.type === 'tool_use') calls.push({ name: c.name, input: c.input || {} });
  }
  return { calls, cwd };
}

/** Does one tool call target `path`: open it, edit it, search inside it or name it in a shell command. */
export function callTargets(call, path, cwd = null) {
  const { name, input } = call;
  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(name)) return mentions(` ${input.file_path || input.notebook_path || ''}`, path, cwd);
  if (name === 'Grep' || name === 'Glob') return mentions(` ${input.path || ''}`, path, cwd);
  if (name === 'Bash') return !/COMPLEX\.md/.test(input.command || '') && mentions(input.command || '', path, cwd);
  return false;
}

/** Every run of one results directory, with its partner outcomes under both definitions. */
export function scoreDir(resultsDir, dataset) {
  const rows = readFileSync(join(resultsDir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byId = new Map(dataset.tasks.map((t) => [t.id, t]));
  const pairsFor = new Map();
  const runs = [];
  for (const row of rows) {
    const task = byId.get(row.task);
    if (!task) continue;
    const bp = join(resultsDir, 'baseline', `${task.base.slice(0, 12)}.json`);
    if (!existsSync(bp)) continue;
    if (!pairsFor.has(bp)) pairsFor.set(bp, sourcePairs(JSON.parse(readFileSync(bp, 'utf8')).risky.co_change));
    const pairs = pairsFor.get(bp);
    const edited = row.edited || [];
    const touched = new Set([...edited, ...(row.reads || [])]);
    const tp = join(resultsDir, 'transcripts', `${row.task}-${row.arm}.jsonl`);
    const { calls, cwd } = toolCalls(existsSync(tp) ? readFileSync(tp, 'utf8') : '');
    const recorded = partnerOutcomes(edited, pairs, (p) => touched.has(p));
    const corrected = partnerOutcomes(edited, pairs, (p) => touched.has(p) || calls.some((c) => callTargets(c, p, cwd)));
    const union = (o) => [...new Set(Object.values(o).flat())];
    runs.push({ row, recorded, corrected, recordedMissed: union(recorded), correctedMissed: union(corrected) });
  }
  return { runs };
}

/* Units for McNemar: { key: { arm: ok } }, ok meaning no partner missed. */
function units(runs, level, metric, { skipErrors = false } = {}) {
  const out = {};
  for (const r of runs) {
    if (skipErrors && r.row.error) continue;
    if (level === 'run') (out[r.row.task] ??= {})[r.row.arm] = r[`${metric}Missed`].length === 0;
    else for (const [f, missed] of Object.entries(r[metric])) (out[`${r.row.task}|${f}`] ??= {})[r.row.arm] = missed.length === 0;
  }
  return out;
}

/* One comparison, arm against none, in the words of this question: a unit
   "favours the map" when only the none run missed a partner. */
function compare(u, arm) {
  const pairs = [];
  for (const v of Object.values(u)) if ('none' in v && arm in v) pairs.push([v.none, v[arm]]);
  const m = mcnemar(pairs);
  const miss = (i) => pairs.filter((p) => !p[i]).length;
  return { pairs: m.n, missed_none: miss(0), missed_arm: miss(1), favours_map: m.c, against_map: m.b, p: Number.isFinite(m.p) ? Number(m.p.toPrecision(3)) : null };
}

/* Each arm's misses over all of its units, paired or not. */
function totals(u) {
  const t = {};
  for (const v of Object.values(u)) for (const [arm, ok] of Object.entries(v)) { const x = (t[arm] ??= { missed: 0, units: 0 }); x.units += 1; if (!ok) x.missed += 1; }
  return t;
}

const pool = (list) => Object.assign({}, ...list.map((u, i) => Object.fromEntries(Object.entries(u).map(([k, v]) => [`${i}:${k}`, v]))));

const VARIANTS = [
  ['edit', 'recorded', {}], ['edit', 'corrected', {}],
  ['run', 'recorded', {}], ['run', 'corrected', {}],
  ['run', 'recorded', { skipErrors: true }], ['run', 'corrected', { skipErrors: true }],
];
const variantName = ([level, metric, o]) => `${level}_${metric}${o.skipErrors ? '_no_error_runs' : ''}`;

/** The partner miss result object, computed from the committed runs under `root`. */
export function partnersReport(root) {
  const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const repos = [
    { name: 'undici', results: 'bench/results/undici-damage', dataset: 'bench/data/undici-danger.json', arms: ['file'] },
    { name: 'fastify', results: 'bench/results/fastify-damage', dataset: 'bench/data/fastify-danger.json', arms: ['file', 'hooks'] },
  ];
  const scored = repos.map((r) => ({ ...r, runs: scoreDir(join(root, r.results), read(r.dataset)).runs }));
  const repositories = {};
  for (const r of scored) {
    const out = { results: r.results, dataset: r.dataset, runs: r.runs.length, comparisons: {}, totals: {} };
    for (const v of VARIANTS) {
      const u = units(r.runs, ...v);
      out.totals[variantName(v)] = totals(u);
      for (const arm of r.arms) (out.comparisons[arm] ??= {})[variantName(v)] = compare(u, arm);
    }
    repositories[r.name] = out;
  }
  /* The two runs share no task, so their pairs pool; only the file arm ran on both. */
  const pooled = { arms: 'file against none, undici and fastify', comparisons: {} };
  for (const v of VARIANTS) pooled.comparisons[variantName(v)] = compare(pool(scored.map((r) => units(r.runs, ...v))), 'file');
  return {
    question: 'When the agent edits one file of a source co-change pair, does it miss the partner less often with the map than without it?',
    primary: 'edit_recorded',
    exploratory: 'every *_corrected comparison: the corrected definition was set after the edit_recorded result was known',
    definitions: {
      recorded: 'partner read with Read or edited with an edit tool (the harness partners_missed field)',
      corrected: 'a tool call targets the partner: Read or edit on it, Grep or Glob path, or a Bash command naming it (Grep patterns and commands on COMPLEX.md do not count)',
      edit: 'unit is one edited file in one task; arms pair when both edited that file',
      run: 'unit is one task; a run misses when any partner of any edited file went unseen',
      no_error_runs: 'runs that ended in an error (budget stop) left out, as the harness counted them',
      favours_map: 'pairs where only the none run missed a partner',
      against_map: 'pairs where only the map arm missed a partner',
      p: 'McNemar exact two sided, bench/stats.mjs',
    },
    repositories,
    pooled,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const out = join(root, 'bench/results/partners.json');
  writeFileSync(out, JSON.stringify(partnersReport(root), null, 2) + '\n');
  console.log(`wrote ${out}`);
}
