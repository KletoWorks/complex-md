#!/usr/bin/env node
// Does a task's fixed code sit where the agent can read it? The sandbox
// leaves the dependency copy and the Node install readable, and either can
// hold a newer copy of the code under test: Node bundles undici, and a
// clone's node_modules can hold a published release of the repository.
// This takes the lines each fix adds to source files and looks for them in
// the given directories, so a leak shows before a campaign, per task.
//
//   node bench/leak-lines.mjs bench/data/damage-fastify.json <dir> [<dir> ...] [--json] [--min 30]
//
// A line counts when it is at least --min characters (30 by default) after
// trimming, so short generic lines like `return null` do not match by
// chance. Exit 1 when any line is found, 0 when none is.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixSourceDiff } from './isolate.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const min = Number(opt('--min', 30));
const json = args.includes('--json');
const [datasetPath, ...rest] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min');
const dirs = rest;
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));

/* The added lines of each fix's source change, keyed to the task. */
const byLine = new Map();
for (const t of dataset.tasks) {
  const diff = fixSourceDiff(dataset.path, t.base, t.fix);
  for (const l of diff.split('\n')) {
    if (!l.startsWith('+') || l.startsWith('+++')) continue;
    const s = l.slice(1).trim();
    if (s.length < min) continue;
    if (!byLine.has(s)) byLine.set(s, new Set());
    byLine.get(s).add(t.id);
  }
}

/* One grep per directory with every line as a fixed string, then one per
   file it named to say which lines are there. */
const tmp = mkdtempSync(join(tmpdir(), 'cx-leak-'));
const needles = join(tmp, 'lines');
writeFileSync(needles, [...byLine.keys()].join('\n') + '\n');
const hits = new Map();
try {
  for (const d of dirs) {
    const r = spawnSync('grep', ['-rIlF', '-f', needles, d], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const files = r.stdout.split('\n').filter(Boolean);
    for (const f of files) {
      const body = readFileSync(f, 'utf8');
      for (const line of byLine.keys()) if (body.includes(line)) { if (!hits.has(line)) hits.set(line, new Set()); hits.get(line).add(f); }
    }
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }

const out = [];
for (const [line, files] of hits) for (const task of byLine.get(line)) out.push({ task, line, files: [...files].sort() });
out.sort((a, b) => a.task.localeCompare(b.task) || a.line.localeCompare(b.line));
if (json) console.log(JSON.stringify({ tasks: dataset.tasks.length, lines: byLine.size, dirs, hits: out }, null, 2));
else {
  console.log(`${dataset.tasks.length} tasks, ${byLine.size} added lines of ${min} characters or more, ${dirs.length} directories`);
  for (const h of out) console.log(`${h.task}: ${h.line.slice(0, 100)}\n    in ${h.files.slice(0, 3).join(', ')}${h.files.length > 3 ? ` and ${h.files.length - 3} more` : ''}`);
  if (!out.length) console.log('no fix line found');
}
process.exit(out.length ? 1 : 0);
