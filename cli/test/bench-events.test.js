/* The accounting of one run from its stream-json events. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMeter } from '../../bench/agent-events.mjs';

const WT = '/w/task-none';
export const use = (name, input, usage = { input_tokens: 10, output_tokens: 5 }) => ({ type: 'assistant', message: { usage, content: [{ type: 'tool_use', id: 'x', name, input }] } });

test('steps, reads, the first gold read and tokens are counted from the events', () => {
  const { m, onEvent } = createMeter({ wt: WT, gold: ['lib/a.js'], stopAt: 'none' });
  onEvent(use('Read', { file_path: `${WT}/README.md` }, { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 50, output_tokens: 5 }));
  onEvent(use('Read', { file_path: `${WT}/lib/a.js` }));
  onEvent(use('Bash', { command: 'node --test test/a.test.js' }));
  onEvent(use('Edit', { file_path: `${WT}/lib/a.js` }));
  onEvent({ type: 'result', total_cost_usd: 0.5, num_turns: 4, duration_ms: 1000 });
  assert.equal(m.steps, 4);
  assert.deepEqual(m.reads, ['README.md', 'lib/a.js']);
  assert.equal(m.first_gold_read, 2);
  assert.equal(m.first_gold_edit, 4);
  assert.equal(m.wasted_reads, 1);
  assert.equal(m.agent_test_runs, 1);
  assert.equal(m.tokens_cache_read, 100);
  assert.equal(m.tokens_cache_write, 50);
  assert.equal(m.tokens_in, 10 + 100 + 50 + 30);
  assert.equal(m.cost_usd, 0.5);
  assert.equal(m.error, null);
});

test('with --stop-at edit the first edit asks the caller to stop, once', () => {
  const { onEvent } = createMeter({ wt: WT, gold: ['lib/a.js'], stopAt: 'edit' });
  assert.equal(onEvent(use('Read', { file_path: `${WT}/lib/a.js` })), null);
  assert.equal(onEvent(use('Edit', { file_path: `${WT}/lib/a.js` })), 'first-edit');
  assert.equal(onEvent(use('Edit', { file_path: `${WT}/lib/a.js` })), null);
});

test('an error result is the run\'s error unless the harness stopped the run', () => {
  const a = createMeter({ wt: WT, gold: [], stopAt: 'none' });
  a.onEvent({ type: 'result', is_error: true, subtype: 'error_during_execution' });
  assert.equal(a.m.error, 'error_during_execution');
  const b = createMeter({ wt: WT, gold: [], stopAt: 'none' });
  b.onEvent({ type: 'result', is_error: true, subtype: 'error_during_execution' }, { killed: true });
  assert.equal(b.m.error, null);
});

test('the model and the agent version come from the init event', () => {
  const { m, onEvent } = createMeter({ wt: WT, gold: [], stopAt: 'none' });
  onEvent({ type: 'system', subtype: 'init', model: 'claude-opus-5[1m]', claude_code_version: '2.1.260', tools: ['Read', 'Bash'] });
  assert.equal(m.agent_model, 'claude-opus-5[1m]');
  assert.equal(m.agent_version, '2.1.260');
});
