// What a run did, read from the agent's stream-json events: tool calls,
// tokens, cost, test runs and how the run ended. Kept apart from the process
// handling in run.mjs so the accounting can be tested on recorded events.

import { TEST_FILE_RE } from '../cli/src/signals.js';

/* A Bash command that runs tests through a runner or a package script.
   `npx -y borp`, `npm exec borp` and `npm t` used to slip past it. */
export const TEST_CMD = /\b(node\s+--test|npm\s+(run\s+)?(test|unit|t)\b|(npx|npm\s+exec)(\s+-{1,2}[\w-]+)*\s+(tap|borp|jest|vitest|mocha)\b|\b(tap|borp|jest|vitest|mocha)\s+\S)/;

/* `node test/x.js`: a node:test file run directly, which the runner pattern
   missed. Counts when the script node runs is a test file. */
const NODE_SCRIPT = /\bnode((?:\s+--?[\w-]+(?:=\S+)?)*)\s+["']?([^\s"'|&;<>]+\.(?:m?js|cjs))\b/g;

export function isTestCommand(cmd = '') {
  if (TEST_CMD.test(cmd)) return true;
  for (const [, , script] of cmd.matchAll(NODE_SCRIPT)) if (TEST_FILE_RE.test(script)) return true;
  return false;
}

/* Result subtypes that mean the agent hit a cap the harness set. */
export const CAPS = { error_max_budget_usd: 'budget', error_max_turns: 'max-turns' };

export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
export const pathOf = (input = {}) => input.file_path || input.path || input.notebook_path || null;
export const rel = (p, wt) => (p && p.startsWith(wt) ? p.slice(wt.length + 1) : p);

/* Tokens are split by kind because they are not priced alike. tokens_in
   used to sum fresh input, cache reads and cache creation together, which
   counts a cached read at full weight and overstates what the map costs by
   a wide margin: a map is byte identical across runs and is exactly the
   kind of prefix a cache is for. cost_usd, which the agent prices itself,
   stays the only figure to quote as money. */
export function newMetrics() {
  return { steps: 0, turns: 0, reads: [], first_gold_read: null, first_gold_edit: null, wasted_reads: 0, gate_fired: 0, mcp_calls: 0, agent_test_runs: 0, cost_usd: null, tokens_in: 0, tokens_fresh: 0, tokens_cache_read: 0, tokens_cache_write: 0, tokens_out: 0, stopped: null, error: null, agent_model: null, agent_version: null };
}

/* One meter per run. onEvent returns 'first-edit' at the first edit when
   the run stops there, so the caller can end the process. `killed` says
   whether the harness already ended the run itself. */
export function createMeter({ wt, gold, stopAt }) {
  const m = newMetrics();
  /* Every tool call in order, for the conduct checks. Not enumerable, so it
     stays out of the row: the transcript keeps the full record. */
  Object.defineProperty(m, 'log', { value: [], enumerable: false });
  const goldSet = new Set(gold);
  const isGold = (p) => p && (goldSet.has(p) || gold.some((g) => p.endsWith('/' + g)));
  let firstEdit = false;
  function onEvent(ev, { killed = false } = {}) {
    let action = null;
    /* The model the agent actually ran, and the agent's version: --model is
       usually not passed, so the row recorded model: null. */
    if (ev.type === 'system' && ev.subtype === 'init') {
      m.agent_model = ev.model ?? null;
      m.agent_version = ev.claude_code_version ?? null;
    } else if (ev.type === 'assistant') {
      m.turns++;
      const u = ev.message?.usage;
      if (u) {
        m.tokens_fresh += u.input_tokens || 0;
        m.tokens_cache_read += u.cache_read_input_tokens || 0;
        m.tokens_cache_write += u.cache_creation_input_tokens || 0;
        /* Kept for continuity with runs recorded before the split. */
        m.tokens_in += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        m.tokens_out += u.output_tokens || 0;
      }
      for (const c of ev.message?.content || []) {
        if (c.type !== 'tool_use') continue;
        m.steps++;
        if (c.name?.startsWith('mcp__complex-md')) m.mcp_calls++;
        if (c.name === 'Bash' && isTestCommand(c.input?.command)) m.agent_test_runs++;
        const p = rel(pathOf(c.input), wt);
        m.log.push({ step: m.steps, name: c.name, path: p, command: c.name === 'Bash' ? String(c.input?.command || '') : null });
        if (c.name === 'Read' || EDIT_TOOLS.has(c.name)) {
          if (isGold(p)) { m.first_gold_read ??= m.steps; if (EDIT_TOOLS.has(c.name)) m.first_gold_edit ??= m.steps; }
          else if (c.name === 'Read' && m.first_gold_read === null && p && !/COMPLEX\.md$/.test(p)) m.wasted_reads++;
          if (c.name === 'Read') m.reads.push(p);
        }
        if (EDIT_TOOLS.has(c.name) && stopAt === 'edit' && !killed && !firstEdit) { firstEdit = true; action = 'first-edit'; }
      }
    } else if (ev.type === 'user') {
      for (const c of ev.message?.content || []) if (c.type === 'tool_result' && /COMPLEX\.md/.test(JSON.stringify(c.content || '')) && c.is_error) m.gate_fired++;
    } else if (ev.type === 'result') {
      m.cost_usd = ev.total_cost_usd ?? null;
      m.result_turns = ev.num_turns;
      m.duration_ms = ev.duration_ms;
      /* A cap is an outcome, not a failure: the patch the agent left is
         judged like any other. Recorded as an error, it skipped the damage
         suite and dropped the task from every paired comparison. */
      if (CAPS[ev.subtype]) m.stopped = CAPS[ev.subtype];
      // A run we stopped ourselves reports error_during_execution; that is the stop, not a failure.
      else if (ev.is_error && !killed) m.error = String(ev.result || ev.subtype).slice(0, 200);
    }
    return action;
  }
  return { m, onEvent };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Paths the agent looked at: opened with Read, searched with Grep, or named
   in a Bash command (cat, sed, head, grep, rg). With Read alone, a partner
   the agent viewed with cat or grep counted as missed. */
function viewed(m, edited) {
  const log = m.log || [];
  const paths = new Set([...edited, ...m.reads, ...log.filter((e) => e.name === 'Grep' && e.path).map((e) => e.path)]);
  const commands = log.filter((e) => e.name === 'Bash').map((e) => e.command);
  return (f) => paths.has(f) || commands.some((c) => new RegExp(`(^|[\\s"'=/])${escapeRe(f)}($|[\\s"':;|&)<>])`).test(c));
}

/* Did the agent behave the way the map asks: when it edits a file the map
   calls risky, did it run any test, and when it edits one side of a
   co-change pair, did it look at the other. Judged against the computed
   risky set from the baseline, the same for every arm. */
export function behaviour(edited, m, risky) {
  const riskySet = new Set([...risky.hotspots, ...risky.load_bearing]);
  const editedRisky = edited.filter((f) => riskySet.has(f));
  const seen = viewed(m, edited);
  const missed = [];
  /* Source partners only: a docs page that co-changes with a module is a
     real pairing, but not opening it while fixing a bug is not a risk. */
  const source = (f) => !/\.(md|mdx|txt|rst)$/i.test(f);
  for (const [a, b] of risky.co_change.filter((pair) => pair.every(source))) {
    if (edited.includes(a) && !seen(b)) missed.push(b);
    if (edited.includes(b) && !seen(a)) missed.push(a);
  }
  return {
    edited_risky: editedRisky,
    risky_edit_untested: editedRisky.length > 0 && m.agent_test_runs === 0,
    partners_missed: [...new Set(missed)],
  };
}
