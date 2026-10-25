#!/usr/bin/env node
// Compliance: when an agent edits a file the map writes a test instruction
// for, does it run the tests that instruction names.
//
//   node bench/comply.mjs <resultsDir> <datasetPath>
//
// The map's "Why these files are hot" section gives each hot file a
// paragraph, and the paragraph ends with "Before editing this file, run
// <tests>". For every run that edited such a file, this reads the agent's
// Bash commands from the transcript and checks whether every named test
// file appears in one of them. The unit is one edited file in one task:
// two arms pair when both edited that file, and McNemar's exact test in
// stats.mjs compares an arm with `none` on those pairs.
//
// The parser is a heuristic. It reads test paths under test/ only, and it
// does not expand directory advice such as "re-run the test/fetch
// directory". The same map serves every arm of a task (one map per calendar
// month of base dates, as bench/run.mjs builds them), so the advice an arm
// is scored against does not depend on the arm.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mcnemar } from './stats.mjs';

/** { 'lib/core/util.js': ['test/util.js', ...] } from the map's "Before editing" sentences. */
export function adviceFromMap(map) {
  const out = {};
  // A CRLF map has no \n\n between paragraphs, so the section is read with LF.
  const why = map.replace(/\r\n/g, '\n').split('## Why these files are hot')[1]?.split('\n## ')[0] || '';
  for (const para of why.split('\n\n')) {
    const file = /^`?([\w./-]+\.[cm]?[jt]s)`?/.exec(para.trim());
    const before = /Before editing[^.]*?(?:run|re-run)([\s\S]*?)(?:\.\s|$)/.exec(para);
    if (!file || !before) continue;
    const tests = [...before[1].matchAll(/`?(test\/[\w./-]+)`?/g)].map((x) => x[1].replace(/[.,]$/, ''));
    if (tests.length) out[file[1]] = tests;
  }
  return out;
}

/** Every Bash command the agent issued, in order, from a stream-json transcript. */
export function bashCommands(transcript) {
  const cmds = [];
  for (const line of transcript.split('\n')) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev?.type !== 'assistant') continue;
    for (const c of ev.message?.content || []) if (c.type === 'tool_use' && c.name === 'Bash') cmds.push(c.input?.command || '');
  }
  return cmds;
}

/**
 * Score rows from runs.jsonl. `mapFor(task)` returns the map text the task
 * was run with, or null when there is none (the row is skipped);
 * `transcriptFor(task, arm)` returns the transcript text.
 * Returns { tally: { arm: { edits, all, any, named, ran } }, units: { 'task|file': { arm: ranAll } } }.
 */
export function scoreRuns(rows, { mapFor, transcriptFor }) {
  const tally = {};
  const units = {};
  const adviceCache = new Map();
  for (const r of rows) {
    const map = mapFor(r.task);
    if (map == null) continue;
    if (!adviceCache.has(map)) adviceCache.set(map, adviceFromMap(map));
    const advice = adviceCache.get(map);
    const cmds = bashCommands(transcriptFor(r.task, r.arm) || '');
    for (const f of r.edited || []) {
      const named = advice[f];
      if (!named) continue;
      const ran = named.filter((n) => cmds.some((c) => c.includes(n)));
      const t = (tally[r.arm] ??= { edits: 0, all: 0, any: 0, named: 0, ran: 0 });
      t.edits += 1;
      t.named += named.length;
      t.ran += ran.length;
      if (ran.length === named.length) t.all += 1;
      if (ran.length) t.any += 1;
      (units[`${r.task}|${f}`] ??= {})[r.arm] = ran.length === named.length;
    }
  }
  return { tally, units };
}

/** The runs of one results directory, scored against its dataset. */
export function scoreDir(resultsDir, dataset) {
  const rows = readFileSync(join(resultsDir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const repoKey = (dataset.repo || 'repo').replace('/', '-');
  const byId = new Map(dataset.tasks.map((t) => [t.id, t]));
  const mapFor = (id) => {
    const task = byId.get(id);
    if (!task) return null;
    const p = join(resultsDir, 'maps', `${repoKey}-${task.date.slice(0, 7)}.md`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
  const transcriptFor = (id, arm) => {
    const p = join(resultsDir, 'transcripts', `${id}-${arm}.jsonl`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
  return scoreRuns(rows, { mapFor, transcriptFor });
}

/** Units from several results directories. Pool only directories that share no task. */
export function poolUnits(list) {
  const out = {};
  list.forEach((units, i) => { for (const [k, v] of Object.entries(units)) out[`${i}:${k}`] = v; });
  return out;
}

/* McNemar on the units both arms have. b counts units only `base` passed,
   c units only `arm` passed. */
export function compareArms(units, arm, base = 'none') {
  const pairs = [];
  for (const v of Object.values(units)) if (base in v && arm in v) pairs.push([v[base], v[arm]]);
  return { arm, base, ...mcnemar(pairs) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [resultsDir, datasetPath] = process.argv.slice(2);
  if (!resultsDir || !datasetPath) {
    console.error('usage: node bench/comply.mjs <resultsDir> <datasetPath>');
    process.exit(2);
  }
  const { tally, units } = scoreDir(resultsDir, JSON.parse(readFileSync(datasetPath, 'utf8')));
  const comparisons = Object.keys(tally).filter((a) => a !== 'none').map((a) => compareArms(units, a));
  console.log(JSON.stringify({ results: resultsDir, tally, comparisons }, null, 2));
}
