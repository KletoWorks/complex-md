/* Conduct: did the agent do what the map asks, judged from its tool calls. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMeter, behaviour } from '../../bench/agent-events.mjs';

const WT = '/w/task-file';
const use = (name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'x', name, input }] } });
const risky = { hotspots: ['lib/a.js'], load_bearing: [], co_change: [['lib/a.js', 'lib/b.js'], ['lib/a.js', 'docs/a.md']] };

function run(events) {
  const meter = createMeter({ wt: WT, gold: ['lib/a.js'], stopAt: 'none' });
  for (const e of events) meter.onEvent(e);
  return meter.m;
}

test('a partner never looked at is missed', () => {
  const m = run([use('Read', { file_path: `${WT}/lib/a.js` }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
  assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, ['lib/b.js']);
});

test('a partner seen through the Read tool is not missed', () => {
  const m = run([use('Read', { file_path: `${WT}/lib/b.js` }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
  assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, []);
});

test('a partner seen through cat, sed or a grep in Bash is not missed', () => {
  for (const command of ['cat lib/b.js', `sed -n 1,80p ${WT}/lib/b.js`, 'grep -n export lib/b.js lib/c.js', 'rg -n "a\\(" lib/b.js']) {
    const m = run([use('Bash', { command }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
    assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, [], command);
  }
});

test('a partner searched with the Grep tool is not missed', () => {
  const m = run([use('Grep', { pattern: 'export', path: `${WT}/lib/b.js` }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
  assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, []);
});

test('a path that only starts with the partner path does not count as seeing it', () => {
  const m = run([use('Bash', { command: 'cat lib/b.json' }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
  assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, ['lib/b.js']);
});
