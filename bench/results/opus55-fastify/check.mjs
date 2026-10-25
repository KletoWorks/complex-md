#!/usr/bin/env node
// The morning check for a results directory of the Opus 5.5 replication.
//
//   node bench/results/opus55-fastify/check.mjs [resultsDir] [dataset]
//
// One line per row: error, steps, map size against the cap, and the web
// tool calls in its transcript (there must be none). Then the rows per arm,
// and the map paragraphs that tell the agent to run tests, which are the
// edits the conduct score can judge.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adviceFromMap } from '../../comply.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] || here;
const runsPath = join(dir, 'runs.jsonl');
const rows = existsSync(runsPath) ? readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const WEB = /"name":"(WebFetch|WebSearch)"/;
let bad = 0;
for (const r of rows) {
  const t = join(dir, 'transcripts', `${r.task}-${r.arm}.jsonl`);
  const text = existsSync(t) ? readFileSync(t, 'utf8') : '';
  const web = text.split('\n').filter((l) => WEB.test(l) && /"tool_use"/.test(l)).length;
  const over = r.map_bytes != null && r.map_cap != null && r.map_bytes > r.map_cap;
  const flag = r.error || !(r.steps > 0) || web || over;
  if (flag) bad++;
  console.log(`${flag ? 'CHECK' : 'ok   '} ${r.task} ${r.arm.padEnd(5)} steps ${String(r.steps).padStart(3)} map ${r.map_bytes ?? '-'} web ${web} success ${r.success ?? '-'} regressions ${r.regressed_tests ?? '-'} risky untested ${r.risky_edit_untested ?? '-'} $${r.cost_usd?.toFixed(2) ?? '?'} ${r.stopped ? `stopped ${r.stopped} ` : ''}${r.error ? `error: ${r.error}` : ''}`);
}
const by = {};
for (const r of rows) by[r.arm] = (by[r.arm] || 0) + 1;
console.log(`\n${rows.length} rows, ${bad} to check; per arm ${JSON.stringify(by)}`);
const maps = existsSync(join(dir, 'maps')) ? readdirSync(join(dir, 'maps')).filter((f) => f.endsWith('.md')) : [];
for (const m of maps) {
  const text = readFileSync(join(dir, 'maps', m), 'utf8');
  console.log(`map ${m}: ${Buffer.byteLength(text)} bytes, run directives for ${Object.keys(adviceFromMap(text)).join(', ') || 'no file'}`);
}
