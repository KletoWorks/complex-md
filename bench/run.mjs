#!/usr/bin/env node
// Run the localization benchmark: the same real issue, the same starting
// commit, with and without COMPLEX.md, and count how many tool calls the agent
// needs before it first opens a file the actual fix touched.
//
//   node bench/run.mjs --dataset bench/data/fastify.json --arms none,file,hooks \
//        --agent claude --tasks 0-7 --budget 0.60 --timeout 420 --stop-at edit --out bench/results/pilot
//
// Arms:  none   the repository as it is
//        file   COMPLEX.md at the task's base commit, wired (CLAUDE.md, path-scoped rule)
//        hooks  file + the PreToolUse/Stop hooks
//        mcp    hooks + the MCP server
// --stop-at edit kills the run at the agent's first edit: localization only, cheapest.
// Runs are appended to <out>/runs.jsonl and skipped when already present, so it resumes.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSignals } from '../cli/src/signals.js';
import { buildBundle, normalizeOutput } from '../cli/src/generate.js';
import { wire } from '../cli/src/wire.js';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(here, '../cli/bin/complex-md.js');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);

const dataset = JSON.parse(readFileSync(opt('--dataset', 'bench/data/fastify.json'), 'utf8'));
const arms = opt('--arms', 'none,file').split(',');
const agent = opt('--agent', 'claude');
const budget = Number(opt('--budget', 0.6));
const timeoutS = Number(opt('--timeout', 420));
const stopAt = opt('--stop-at', 'edit');
const outDir = opt('--out', 'bench/results/run');
const model = opt('--model', null);
const range = opt('--tasks', `0-${dataset.tasks.length - 1}`).split('-').map(Number);
const tasks = dataset.tasks.slice(range[0], (range[1] ?? range[0]) + 1);
const workRoot = opt('--work', '/tmp/cxbench');
mkdirSync(join(outDir, 'maps'), { recursive: true });
mkdirSync(join(outDir, 'transcripts'), { recursive: true });
const runsPath = join(outDir, 'runs.jsonl');
const done = new Set(existsSync(runsPath) ? readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.task}/${r.arm}`; }) : []);

const sh = (cmd, a, cwd) => {
  const r = spawnSync(cmd, a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const log = (s) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

/** COMPLEX.md as of the task's base commit. One map per calendar month of base dates: maps are regenerated periodically, not per commit. */
async function mapFor(task, wt) {
  const key = `${(dataset.repo || 'repo').replace('/', '-')}-${task.date.slice(0, 7)}.md`;
  const cached = join(outDir, 'maps', key);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  log(`generating map for ${task.date.slice(0, 7)} at ${task.base.slice(0, 10)}`);
  const sig = computeSignals(wt);
  const { bundle, frontMatter } = buildBundle(wt, sig, 'complex-md/bench');
  let text;
  if (agent === 'mock') {
    text = `${frontMatter}\n## Where the risk lives\n\n${sig.hotspots.slice(0, 3).map((h) => `${h.path} (${h.fixes} fixes)`).join(', ')} carry the fix history. Fixing a bug you have not located: start there.\n`;
  } else {
    // The prose model call goes through the same Claude Code login the agent runs use; no tools, one turn.
    const r = spawnSync('claude', ['-p', '--output-format', 'json', '--tools', '', '--setting-sources', '', ...(model ? ['--model', model] : [])], { cwd: wt, input: bundle, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let j; try { j = JSON.parse(r.stdout); } catch { throw new Error(`map generation failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`); }
    if (j.is_error) throw new Error(`map generation failed: ${j.result}`); // the harness reports the agent's own error text
    text = normalizeOutput(j.result, frontMatter);
    log(`map: ${text.split('\n').length} lines, $${(j.total_cost_usd || 0).toFixed(3)}`);
  }
  writeFileSync(cached, text);
  return text;
}

function prepareWorktree(task, arm) {
  const wt = join(workRoot, `${task.id}-${arm}`);
  if (existsSync(wt)) { spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: dataset.path }); rmSync(wt, { recursive: true, force: true }); }
  sh('git', ['worktree', 'add', '--detach', '--quiet', wt, task.base], dataset.path);
  // No arm gets a pre-existing map or wiring from the repository itself.
  for (const f of ['COMPLEX.md', '.complex-md']) rmSync(join(wt, f), { recursive: true, force: true });
  return wt;
}

async function armSetup(task, arm, wt) {
  if (arm === 'none') return;
  writeFileSync(join(wt, 'COMPLEX.md'), await mapFor(task, wt));
  wire(wt, { agents: ['claude'], hooks: arm === 'hooks' || arm === 'mcp', mcp: arm === 'mcp' });
  // The package is not on npm yet: hooks and MCP call this checkout's binary.
  for (const f of ['.claude/settings.json', '.mcp.json']) {
    const p = join(wt, f);
    if (existsSync(p)) writeFileSync(p, readFileSync(p, 'utf8').replace(/"npx -y complex-md/g, `"node ${BIN}`).replace(/"command": "npx",\s*"args": \[\s*"-y",\s*"complex-md",/g, `"command": "node", "args": ["${BIN}",`));
  }
  // The map is context, not a change the agent made.
  sh('git', ['add', '-A'], wt);
  sh('git', ['-c', 'user.email=bench@complex.md', '-c', 'user.name=bench', 'commit', '-q', '-m', 'bench: COMPLEX.md and wiring'], wt);
}

const PROMPT = (t) => `Fix this issue in the repository. Find the code responsible and change it. Do not commit. Do not run the whole test suite; one test file at most.\n\n# ${t.title}\n\n${t.text}`;

function agentCommand(task, arm, wt) {
  if (agent === 'mock') return ['node', [join(here, 'mock-agent.mjs')], { CX_GOLD: task.gold.join(',') }];
  const a = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--setting-sources', 'project', '--max-budget-usd', String(budget),
    '--tools', 'Read,Edit,Write,MultiEdit,Grep,Glob,Bash', '--allowedTools', 'Bash(git diff:*) Bash(git log:*) Bash(git grep:*) Bash(git show:*) Bash(node:*) Bash(npm test:*) Bash(ls:*) Bash(cat:*) Bash(rg:*) Bash(grep:*) Bash(find:*)'];
  if (arm === 'mcp') a.push('--mcp-config', join(wt, '.mcp.json'), '--strict-mcp-config');
  if (model) a.push('--model', model);
  return ['claude', a, {}];
}

const pathOf = (input = {}) => input.file_path || input.path || input.notebook_path || null;
const rel = (p, wt) => (p && p.startsWith(wt) ? p.slice(wt.length + 1) : p);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function runAgent(task, arm, wt) {
  return new Promise((resolvePromise) => {
    const [cmd, a, env] = agentCommand(task, arm, wt);
    const child = spawn(cmd, a, { cwd: wt, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end(agent === 'mock' ? '' : PROMPT(task));
    const transcript = [];
    const m = { steps: 0, turns: 0, reads: [], first_gold_read: null, first_gold_edit: null, wasted_reads: 0, gate_fired: 0, mcp_calls: 0, cost_usd: null, tokens_in: 0, tokens_out: 0, stopped: null, error: null };
    const goldSet = new Set(task.gold);
    const isGold = (p) => p && (goldSet.has(p) || task.gold.some((g) => p.endsWith('/' + g)));
    let buf = '';
    let killed = false;
    const timer = setTimeout(() => { m.stopped = 'timeout'; killed = true; child.kill('SIGTERM'); }, timeoutS * 1000);
    const stderr = [];
    child.stderr.on('data', (d) => stderr.push(String(d)));
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        transcript.push(line);
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'assistant') {
          m.turns++;
          const u = ev.message?.usage; if (u) { m.tokens_in += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); m.tokens_out += u.output_tokens || 0; }
          for (const c of ev.message?.content || []) {
            if (c.type !== 'tool_use') continue;
            m.steps++;
            if (c.name?.startsWith('mcp__complex-md')) m.mcp_calls++;
            const p = rel(pathOf(c.input), wt);
            if (c.name === 'Read' || EDIT_TOOLS.has(c.name)) {
              if (isGold(p)) { m.first_gold_read ??= m.steps; if (EDIT_TOOLS.has(c.name)) m.first_gold_edit ??= m.steps; }
              else if (c.name === 'Read' && m.first_gold_read === null && p && !/COMPLEX\.md$/.test(p)) m.wasted_reads++;
              if (c.name === 'Read') m.reads.push(p);
            }
            if (EDIT_TOOLS.has(c.name) && stopAt === 'edit' && !killed) {
              m.stopped = 'first-edit'; killed = true;
              setTimeout(() => child.kill('SIGTERM'), 1500); // let the tool result land so a gate denial is recorded
            }
          }
        } else if (ev.type === 'user') {
          for (const c of ev.message?.content || []) if (c.type === 'tool_result' && /COMPLEX\.md/.test(JSON.stringify(c.content || '')) && c.is_error) m.gate_fired++;
        } else if (ev.type === 'result') {
          m.cost_usd = ev.total_cost_usd ?? null;
          m.result_turns = ev.num_turns;
          m.duration_ms = ev.duration_ms;
          // A run we stopped ourselves reports error_during_execution; that is the stop, not a failure.
          if (ev.is_error && !killed) m.error = String(ev.result || ev.subtype).slice(0, 200);
        }
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !killed && !m.error) m.error = (stderr.join('').trim() || `exit ${code}`).slice(0, 300);
      writeFileSync(join(outDir, 'transcripts', `${task.id}-${arm}.jsonl`), transcript.join('\n') + '\n');
      resolvePromise(m);
    });
  });
}

for (const task of tasks) {
  for (const arm of arms) {
    if (done.has(`${task.id}/${arm}`)) continue;
    log(`${task.id} ${arm}: ${task.title.slice(0, 60)}`);
    const wt = prepareWorktree(task, arm);
    try {
      await armSetup(task, arm, wt);
      const m = await runAgent(task, arm, wt);
      const edited = sh('git', ['diff', '--name-only', 'HEAD'], wt).split('\n').filter(Boolean);
      const rec = { task: task.id, arm, agent, model, names_gold: task.names_gold, gold: task.gold, edited, gold_edited: edited.some((f) => task.gold.includes(f)), ...m, at: new Date().toISOString() };
      appendFileSync(runsPath, JSON.stringify(rec) + '\n');
      log(`  steps ${m.steps}, first gold read at ${m.first_gold_read ?? '-'}, wasted reads ${m.wasted_reads}, gold edited ${rec.gold_edited}, $${m.cost_usd?.toFixed(3) ?? '?'}${m.gate_fired ? `, gate x${m.gate_fired}` : ''}${m.error ? `, error: ${m.error}` : ''}`);
    } finally {
      if (!flag('--keep')) { spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: dataset.path }); rmSync(wt, { recursive: true, force: true }); }
    }
  }
}
log(`done: ${runsPath}`);
