// The compliance scorer: did an agent that edited a file run the tests the
// map names for that file. Runs only inside the repository checkout; the
// published CLI package has no bench/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCH = join(ROOT, 'bench');
const MODULE = join(BENCH, 'comply.mjs');
const RESULTS = join(ROOT, 'bench/results');
const load = () => import(pathToFileURL(MODULE).href);
const dataset = (name) => JSON.parse(readFileSync(join(ROOT, 'bench/data', name), 'utf8'));

const MAP = `---
complex_md: "0.3"
---

## Where the risk lives

Risk sits in lib/core.

## Why these files are hot

\`lib/core/util.js\` holds the shared helpers. Before editing this file, run \`test/util.js\` and test/node-test/util.js, then the fetch suite.

lib/core/request.js builds requests. Before editing this file, run test/request.js.

lib/no-advice.js has no instruction.

## Change coupling

Before editing anything, run test/ignored.js.
`;

test('adviceFromMap reads the tests named in each "Before editing" sentence', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { adviceFromMap } = await load();
  assert.deepEqual(adviceFromMap(MAP), {
    'lib/core/util.js': ['test/util.js', 'test/node-test/util.js'],
    'lib/core/request.js': ['test/request.js'],
  });
  assert.deepEqual(adviceFromMap('no sections here'), {});
});

test('bashCommands lists the Bash commands of a stream-json transcript and skips broken lines', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { bashCommands } = await load();
  const ev = (content) => JSON.stringify({ type: 'assistant', message: { content } });
  const transcript = [
    ev([{ type: 'tool_use', name: 'Bash', input: { command: 'node --test test/util.js' } }]),
    ev([{ type: 'tool_use', name: 'Read', input: { file_path: 'lib/core/util.js' } }]),
    '{not json',
    JSON.stringify({ type: 'user', message: { content: [] } }),
    ev([{ type: 'text', text: 'done' }, { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }]),
  ].join('\n');
  assert.deepEqual(bashCommands(transcript), ['node --test test/util.js', 'npm test']);
});

test('scoreRuns pairs edits by task and file and compares each arm with none', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { scoreRuns, compareArms } = await load();
  const rows = [
    { task: 'a', arm: 'none', edited: ['lib/core/util.js'] },
    { task: 'a', arm: 'file', edited: ['lib/core/util.js'] },
    { task: 'b', arm: 'none', edited: ['lib/core/request.js'] },
    { task: 'b', arm: 'file', edited: ['lib/core/request.js', 'lib/no-advice.js'] },
    { task: 'c', arm: 'file', edited: ['lib/core/request.js'] },
  ];
  const ran = { 'a/none': 'node --test test/util.js', 'a/file': 'node --test test/util.js test/node-test/util.js', 'b/none': '', 'b/file': 'node test/request.js', 'c/file': '' };
  const ev = (cmd) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: cmd } }] } });
  const s = scoreRuns(rows, { mapFor: () => MAP, transcriptFor: (task, arm) => ev(ran[`${task}/${arm}`]) });
  assert.deepEqual(s.tally.none, { edits: 2, all: 0, any: 1, named: 3, ran: 1 });
  assert.deepEqual(s.tally.file, { edits: 3, all: 2, any: 2, named: 4, ran: 3 });
  const cmp = compareArms(s.units, 'file');
  /* Task c has no none run, so only a and b pair; both went the file arm's way. */
  assert.equal(cmp.n, 2);
  assert.equal(cmp.b, 0);
  assert.equal(cmp.c, 2);
  assert.equal(cmp.p, 0.5);
});

test('the committed runs reproduce claim 1: 14 of 15 edits with the map, 3 of 17 without', async (t) => {
  if (!existsSync(BENCH) || !existsSync(join(RESULTS, 'undici-damage/runs.jsonl'))) return t.skip('bench results are not in this checkout');
  const { scoreDir, compareArms, poolUnits } = await load();
  const undici = scoreDir(join(RESULTS, 'undici-damage'), dataset('undici-danger.json'));
  const fastify = scoreDir(join(RESULTS, 'fastify-damage'), dataset('fastify-danger.json'));

  assert.deepEqual([undici.tally.file.all, undici.tally.file.edits], [3, 3]);
  assert.deepEqual([undici.tally.none.all, undici.tally.none.edits], [1, 5]);
  assert.deepEqual([fastify.tally.file.all, fastify.tally.file.edits], [11, 12]);
  assert.deepEqual([fastify.tally.none.all, fastify.tally.none.edits], [2, 12]);
  assert.deepEqual([fastify.tally.hooks.all, fastify.tally.hooks.edits], [12, 12]);

  const u = compareArms(undici.units, 'file');
  assert.deepEqual([u.n, u.b, u.c], [3, 0, 2]);
  const f = compareArms(fastify.units, 'file');
  assert.deepEqual([f.n, f.b, f.c], [12, 0, 9]);
  const h = compareArms(fastify.units, 'hooks');
  assert.deepEqual([h.n, h.b, h.c], [12, 0, 10]);

  /* The two damage runs share no task, so their pairs pool. */
  const pooled = compareArms(poolUnits([undici.units, fastify.units]), 'file');
  assert.deepEqual([pooled.n, pooled.b, pooled.c], [15, 0, 11]);
  assert.ok(Math.abs(pooled.p - 2 * 0.5 ** 11) < 1e-12, `p ${pooled.p}`);
  assert.equal(undici.tally.file.all + fastify.tally.file.all, 14);
  assert.equal(undici.tally.file.edits + fastify.tally.file.edits, 15);
  assert.equal(undici.tally.none.all + fastify.tally.none.all, 3);
  assert.equal(undici.tally.none.edits + fastify.tally.none.edits, 17);
});
