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

/* The map names the tests to run before a risky file changes. Conduct is
   whether every one of them ran after the agent's last edit to the file. */
const riskyTests = { ...risky, tests: { 'lib/a.js': ['test/a.test.js', 'test/b.test.js'] } };
const editA = use('Edit', { file_path: `${WT}/lib/a.js` });
const bash = (command) => use('Bash', { command });
const verdict = (events) => behaviour(['lib/a.js'], run(events), riskyTests, WT);

test('named tests that ran only before the last edit leave the edit unverified', () => {
  const v = verdict([bash('node --test test/a.test.js test/b.test.js'), editA]);
  assert.equal(v.risky_edit_unverified, true);
  assert.deepEqual(v.risky_unverified, ['lib/a.js']);
  // The old metric only asked whether any test ran at all.
  assert.equal(v.risky_edit_untested, false);
});

test('every named test run after the last edit verifies it', () => {
  assert.equal(verdict([editA, bash('node --test test/a.test.js test/b.test.js')]).risky_edit_unverified, false);
  assert.equal(verdict([editA, bash('node --test test/a.test.js'), bash(`node ${WT}/test/b.test.js`)]).risky_edit_unverified, false);
  assert.equal(verdict([editA, bash('node --test "test/*.test.js"')]).risky_edit_unverified, false, 'a glob');
  assert.equal(verdict([editA, bash('node --test test/')]).risky_edit_unverified, false, 'a directory');
  assert.equal(verdict([editA, bash('npm test')]).risky_edit_unverified, false, 'the whole suite');
});

test('some named tests, a file filter on npm test, or an edit after the run leave it unverified', () => {
  assert.equal(verdict([editA, bash('node --test test/a.test.js')]).risky_edit_unverified, true);
  assert.equal(verdict([editA, bash('npm test -- test/a.test.js')]).risky_edit_unverified, true);
  assert.equal(verdict([editA, bash('npm test'), editA]).risky_edit_unverified, true);
});

test('a risky file with no named tests needs the whole suite after its last edit', () => {
  const none = { ...risky, tests: { 'lib/a.js': [] } };
  const v = (events) => behaviour(['lib/a.js'], run(events), none, WT).risky_edit_unverified;
  assert.equal(v([editA, bash('node --test test/x.test.js')]), true);
  assert.equal(v([editA, bash('npm run test')]), false);
});

test('a path that only starts with the partner path does not count as seeing it', () => {
  const m = run([use('Bash', { command: 'cat lib/b.json' }), use('Edit', { file_path: `${WT}/lib/a.js` })]);
  assert.deepEqual(behaviour(['lib/a.js'], m, risky).partners_missed, ['lib/b.js']);
});
