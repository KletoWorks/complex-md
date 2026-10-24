// A fake agent that speaks Claude Code's stream-json, for testing the harness
// without spending anything. Reads the map when present, so the arms differ.
import { existsSync, appendFileSync, writeFileSync } from 'node:fs';
const gold = process.env.CX_GOLD.split(',');
const hasMap = existsSync('COMPLEX.md');
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const use = (name, input) => emit({ type: 'assistant', message: { usage: { input_tokens: 1000, output_tokens: 50 }, content: [{ type: 'tool_use', id: 'x', name, input }] } });
emit({ type: 'system', subtype: 'init', model: 'mock-model', claude_code_version: '0.0.0-mock' });
if (hasMap) use('Read', { file_path: `${process.cwd()}/COMPLEX.md` });
else for (const f of ['README.md', 'lib/hooks.js', 'lib/route.js']) use('Read', { file_path: `${process.cwd()}/${f}` });
use('Read', { file_path: `${process.cwd()}/${gold[0]}` });
appendFileSync(gold[0], '\n// mock fix\n');
if (process.env.CX_MOCK_NEWFILE) { writeFileSync(process.env.CX_MOCK_NEWFILE, 'export const s = 1;\nexport const t = 2;\nexport const u = 3;\n'); use('Write', { file_path: `${process.cwd()}/${process.env.CX_MOCK_NEWFILE}`, content: '' }); }
use('Edit', { file_path: `${process.cwd()}/${gold[0]}`, old_string: 'a', new_string: 'b' });
const end = process.env.CX_MOCK_END;
if (end === 'hang' || end === 'hang-hard') {
  // A run that outlives the timeout. 'hang' reports and exits on SIGINT, as Claude Code does; 'hang-hard' ignores it.
  setInterval(() => {}, 1000);
  process.on('SIGINT', () => {
    if (end === 'hang-hard') return;
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 4, total_cost_usd: 0.42, duration_ms: 2000 });
    process.exit(130);
  });
} else if (end === 'budget') {
  emit({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, num_turns: 9, total_cost_usd: 5.01, duration_ms: 10 });
  process.exitCode = 1;
} else emit({ type: 'result', subtype: 'success', num_turns: hasMap ? 3 : 5, total_cost_usd: 0.01, duration_ms: 10, result: 'done' });
