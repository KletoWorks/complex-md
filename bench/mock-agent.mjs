// A fake agent that speaks Claude Code's stream-json, for testing the harness
// without spending anything. Reads the map when present, so the arms differ.
import { existsSync, appendFileSync } from 'node:fs';
const gold = process.env.CX_GOLD.split(',');
const hasMap = existsSync('COMPLEX.md');
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const use = (name, input) => emit({ type: 'assistant', message: { usage: { input_tokens: 1000, output_tokens: 50 }, content: [{ type: 'tool_use', id: 'x', name, input }] } });
emit({ type: 'system', subtype: 'init' });
if (hasMap) use('Read', { file_path: `${process.cwd()}/COMPLEX.md` });
else for (const f of ['README.md', 'lib/hooks.js', 'lib/route.js']) use('Read', { file_path: `${process.cwd()}/${f}` });
use('Read', { file_path: `${process.cwd()}/${gold[0]}` });
appendFileSync(gold[0], '\n// mock fix\n');
use('Edit', { file_path: `${process.cwd()}/${gold[0]}`, old_string: 'a', new_string: 'b' });
emit({ type: 'result', subtype: 'success', num_turns: hasMap ? 3 : 5, total_cost_usd: 0.01, duration_ms: 10, result: 'done' });
