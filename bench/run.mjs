#!/usr/bin/env node
// Run the benchmark: the same real issue, the same starting commit, with and
// without COMPLEX.md. The outcome the map exists for is collateral damage:
// after the agent's patch, the whole test suite runs and every test that
// passed at the base commit and fails now is a regression the task did not
// ask for. Localization (tool calls before the agent first opens a file the
// real fix touched), success on the fix's own tests, tokens, time and cost
// are recorded alongside.
//
//   node bench/run.mjs --dataset bench/data/fastify.json --arms none,file,hooks \
//        --agent claude --tasks 0-7 --budget 0.60 --timeout 420 --stop-at edit --out bench/results/pilot
//
// Arms:  none   the repository as it is
//        front  COMPLEX.md front matter only: computed numbers, no generated prose
//        file   COMPLEX.md at the task's base commit, wired (CLAUDE.md, path-scoped rule)
//        hooks  file + the PreToolUse/Stop hooks
//        mcp    hooks + the MCP server
// --stop-at edit kills the run at the agent's first edit: localization only, cheapest.
// --stop-at none runs to completion, which is what regressions, wall clock,
// diff size and success rate need, and the only way the hooks arm can be
// evaluated at all. --no-suite skips the regression suite.
// Runs are appended to <out>/runs.jsonl and skipped when already present, so it resumes.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSignals, findCoveringTests } from '../cli/src/signals.js';
import { buildBundle, normalizeOutput } from '../cli/src/generate.js';
import { wire } from '../cli/src/wire.js';
import { detectRunner, listTestFiles, runSuite, confirm, goldTestFiles } from './suite.mjs';
import { createMeter, newMetrics, behaviour } from './agent-events.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(here, '../cli/bin/complex-md.js');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);

const dataset = JSON.parse(readFileSync(opt('--dataset', 'bench/data/fastify.json'), 'utf8'));
const arms = opt('--arms', 'none,file').split(',');
const agent = opt('--agent', 'claude');
/* Scripted agents stand in for a model when the harness itself is tested.
   Any other name is refused: an unknown name used to fall through to a real
   Claude Code run. CX_BENCH_NO_MODEL=1 refuses every model call outright. */
const SCRIPTED = { mock: 'mock-agent.mjs' };
if (agent !== 'claude' && !SCRIPTED[agent]) { console.error(`unknown --agent ${agent}: claude, ${Object.keys(SCRIPTED).join(', ')}`); process.exit(2); }
const noModel = () => { if (process.env.CX_BENCH_NO_MODEL === '1') throw new Error('a model call was refused: CX_BENCH_NO_MODEL=1'); };
const budget = Number(opt('--budget', 0.6));
const timeoutS = Number(opt('--timeout', 420));
/* Seconds a timed out agent gets, after SIGINT, to print its result event (cost, turns) before SIGKILL. */
const graceS = Number(opt('--grace', 30));
const stopAt = opt('--stop-at', 'edit');
const outDir = opt('--out', 'bench/results/run');
const model = opt('--model', null);
const range = opt('--tasks', `0-${dataset.tasks.length - 1}`).split('-').map(Number);
const tasks = dataset.tasks.slice(range[0], (range[1] ?? range[0]) + 1);
const workRoot = opt('--work', '/tmp/cxbench');
/* --skill <file>: the integration block the agent reads, in place of
   prompts/integration.md. The text a skill optimizer trains is this one.
   --cache <dir>: where maps and suite baselines live; defaults to the out
   dir, and is shared when many small out dirs judge the same tasks. */
const skillText = opt('--skill', null) ? readFileSync(opt('--skill'), 'utf8') : null;
const cacheDir = opt('--cache', outDir);
/* A scripted agent skips the suite unless --suite asks for it (the harness tests do). */
const suiteOn = stopAt === 'none' && !flag('--no-suite') && (agent === 'claude' || flag('--suite'));
for (const d of ['transcripts', 'patches']) mkdirSync(join(outDir, d), { recursive: true });
for (const d of ['maps', 'baseline']) mkdirSync(join(cacheDir, d), { recursive: true });
const runsPath = join(outDir, 'runs.jsonl');
const done = new Set(existsSync(runsPath) ? readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.task}/${r.arm}`; }) : []);

const sh = (cmd, a, cwd) => {
  const r = spawnSync(cmd, a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const untracked = (wt) => sh('git', ['ls-files', '--others', '--exclude-standard', '-z'], wt).split('\0').filter(Boolean);
const log = (s) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

/** COMPLEX.md as of the task's base commit. One map per calendar month of base dates: maps are regenerated periodically, not per commit. */
async function mapFor(task, wt) {
  const key = `${(dataset.repo || 'repo').replace('/', '-')}-${task.date.slice(0, 7)}.md`;
  const cached = join(cacheDir, 'maps', key);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  log(`generating map for ${task.date.slice(0, 7)} at ${task.base.slice(0, 10)}`);
  const sig = computeSignals(wt);
  const { bundle, frontMatter } = buildBundle(wt, sig, 'complex-md/bench');
  let text;
  if (SCRIPTED[agent]) {
    text = `${frontMatter}\n## Where the risk lives\n\n${sig.hotspots.slice(0, 3).map((h) => `${h.path} (${h.fixes} fixes)`).join(', ')} carry the fix history. Fixing a bug you have not located: start there.\n`;
  } else {
    // The prose model call goes through the same Claude Code login the agent runs use; no tools, one turn.
    noModel();
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
  /* A worktree has no node_modules of its own. Without this, every test the
     agent ran failed with a missing module in every arm, and the success
     metric could never be true. The link is the dataset checkout's install,
     made once; a repository without one records success as null. */
  const nm = join(dataset.path, 'node_modules');
  if (existsSync(nm) && !existsSync(join(wt, 'node_modules'))) symlinkSync(nm, join(wt, 'node_modules'), 'dir');
  /* Generated inputs the suite needs (test certificates, a bundled build):
     the dataset lists them as `prepare`, run once per worktree before any
     arm touches it. A failure here is the worktree's problem, not a row. */
  for (const cmd of dataset.prepare || []) spawnSync('sh', ['-c', cmd], { cwd: wt, stdio: 'ignore', timeout: 600000 });
  return wt;
}

/* What the suite looks like before any agent touches the base commit, and
   which files the map would call risky there. Cached per base commit: every
   arm of a task is judged against the same baseline. The risky set comes
   from the computed signals, not the generated prose, so it is identical
   for the `none` arm and costs no model call. */
async function baselineFor(task, wt) {
  const cached = join(cacheDir, 'baseline', `${task.base.slice(0, 12)}.json`);
  /* The tests the map names for each risky file: the covering tests the
     engine computes, which is the list the map's prose is written from. */
  const namedTests = (paths) => Object.fromEntries(paths.map((p) => [p, findCoveringTests(wt, p)]));
  if (existsSync(cached)) {
    const b = JSON.parse(readFileSync(cached, 'utf8'));
    if (!b.risky.tests) { b.risky.tests = namedTests([...b.risky.hotspots, ...b.risky.load_bearing]); writeFileSync(cached, JSON.stringify(b)); }
    return b;
  }
  const sig = computeSignals(wt);
  const risky = {
    hotspots: sig.hotspots.map((h) => h.path),
    load_bearing: sig.load_bearing.map((h) => h.path),
    co_change: sig.co_change.map((c) => c.files),
  };
  risky.tests = namedTests([...risky.hotspots, ...risky.load_bearing]);
  const runner = suiteOn ? detectRunner(wt) : null;
  const files = runner ? listTestFiles(wt) : [];
  let results = null;
  if (runner && files.length) {
    log(`baseline suite at ${task.base.slice(0, 10)}: ${files.length} files`);
    const t0 = Date.now();
    results = await runSuite(wt, runner, files);
    const failing = Object.values(results).filter((r) => !r.ok).length;
    log(`  ${Math.round((Date.now() - t0) / 1000)}s, ${failing} failing at base (excluded)`);
  }
  const b = { base: task.base, runner: runner?.name || null, files, results, risky };
  writeFileSync(cached, JSON.stringify(b));
  return b;
}

/* The front matter alone, with the generated prose cut off. arXiv 2602.11988
   finds LLM generated context files reduce success and raise cost, and only
   human written ones help; this arm asks whether the computed half of a map
   behaves like the former or the latter. `front` against `file` is the
   decisive comparison for this project. */
function frontMatterOnly(text) {
  const m = /^(---\n[\s\S]*?\n---\n)/.exec(text);
  return m ? m[1] : text;
}

async function armSetup(task, arm, wt) {
  if (arm === 'none') return;
  const full = await mapFor(task, wt);
  writeFileSync(join(wt, 'COMPLEX.md'), arm === 'front' ? frontMatterOnly(full) : full);
  wire(wt, { agents: ['claude'], hooks: arm === 'hooks' || arm === 'mcp', mcp: arm === 'mcp', block: skillText });
  // The package is not on npm yet: hooks and MCP call this checkout's binary.
  for (const f of ['.claude/settings.json', '.mcp.json']) {
    const p = join(wt, f);
    if (existsSync(p)) writeFileSync(p, readFileSync(p, 'utf8').replace(/"npx -y complex-md/g, `"node ${BIN}`).replace(/"command": "npx",\s*"args": \[\s*"-y",\s*"complex-md",/g, `"command": "node", "args": ["${BIN}",`));
  }
  // The map is context, not a change the agent made.
  sh('git', ['add', '-A'], wt);
  sh('git', ['-c', 'user.email=bench@complex.md', '-c', 'user.name=bench', 'commit', '-q', '-m', 'bench: COMPLEX.md and wiring'], wt);
}

/* No instruction about tests: whether the agent checks what its change
   reaches is part of what is measured. */
const PROMPT = (t) => `Fix this issue in the repository. Find the code responsible and change it. Do not commit.\n\n# ${t.title}\n\n${t.text}`;

function agentCommand(task, arm, wt) {
  if (SCRIPTED[agent]) return [process.execPath, [join(here, SCRIPTED[agent])], { CX_GOLD: task.gold.join(',') }];
  noModel();
  const a = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--setting-sources', 'project', '--max-budget-usd', String(budget),
    '--tools', 'Read,Edit,Write,MultiEdit,Grep,Glob,Bash', '--allowedTools', 'Bash(git diff:*) Bash(git log:*) Bash(git grep:*) Bash(git show:*) Bash(node:*) Bash(npm test:*) Bash(ls:*) Bash(cat:*) Bash(rg:*) Bash(grep:*) Bash(find:*)'];
  if (arm === 'mcp') a.push('--mcp-config', join(wt, '.mcp.json'), '--strict-mcp-config');
  if (model) a.push('--model', model);
  return ['claude', a, {}];
}

function runAgent(task, arm, wt) {
  return new Promise((resolvePromise) => {
    const [cmd, a, env] = agentCommand(task, arm, wt);
    const child = spawn(cmd, a, { cwd: wt, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end(SCRIPTED[agent] ? '' : PROMPT(task));
    const transcript = [];
    const { m, onEvent } = createMeter({ wt, gold: task.gold, stopAt });
    let buf = '';
    let killed = false;
    const t0 = Date.now();
    /* A timeout used to SIGTERM the agent, which then never printed its
       result event, so the run had no cost and no duration. SIGINT asks it
       to stop and report; SIGKILL follows if it does not. */
    let hardKill = null;
    const timer = setTimeout(() => {
      m.stopped = 'timeout'; killed = true;
      child.kill('SIGINT');
      hardKill = setTimeout(() => child.kill('SIGKILL'), graceS * 1000);
    }, timeoutS * 1000);
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
        if (onEvent(ev, { killed }) === 'first-edit' && !killed) {
          m.stopped = 'first-edit'; killed = true;
          setTimeout(() => child.kill('SIGTERM'), 1500); // let the tool result land so a gate denial is recorded
        }
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer); clearTimeout(hardKill);
      // The harness clock: the agent's own duration_ms comes only with its result event.
      m.wall_ms = Date.now() - t0;
      if (code !== 0 && !killed && !m.error && !m.stopped) m.error = (stderr.join('').trim() || `exit ${code}`).slice(0, 300);
      writeFileSync(join(outDir, 'transcripts', `${task.id}-${arm}.jsonl`), transcript.join('\n') + '\n');
      resolvePromise(m);
    });
  });
}

/* Success rate, the 2602.11988 metric: does the agent's patch pass the tests
   the real fix was verified by. The dataset records those test files. A fix
   often ADDS its test, so the file may not exist at the base commit; it is
   taken from the fix commit into the worktree first, then run against the
   agent's change. Each file is run on its own with the runner the repository
   uses, detected from package.json rather than assumed. No test files, or no
   detectable runner, records null rather than a pass. */
function runGoldTests(task, wt) {
  const files = goldTestFiles(task);
  if (!files.length) return { tests_run: 0, tests_passed: null, success: null };
  const runner = detectRunner(wt);
  if (!runner) return { tests_run: 0, tests_passed: null, success: null };
  let passed = 0, run = 0;
  for (const f of files) {
    spawnSync('git', ['checkout', task.fix, '--', f], { cwd: wt, stdio: 'ignore' });
    if (!existsSync(join(wt, f))) continue;
    run++;
    const r = spawnSync(runner.cmd, [...runner.args, f], { cwd: wt, encoding: 'utf8', timeout: 120000, env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) passed++;
  }
  return { tests_run: run, tests_passed: passed, success: run ? passed === run : null };
}

/* Collateral damage. The suite as it stood at the base commit, run again on
   the agent's patch, with the files the real fix changed judged by the gold
   tests instead. Must run BEFORE runGoldTests, which checks those files out
   from the fix commit. Every regression is confirmed on a second run. */
async function runDamage(task, wt, baseline) {
  if (!baseline.results) return { suite_files: null, regressions: null, regressed_tests: null, regressed_files: null };
  const runner = detectRunner(wt);
  const after = await runSuite(wt, runner, baseline.files);
  const keys = await confirm(wt, runner, baseline.results, after, new Set(task.tests || []));
  return {
    suite_files: baseline.files.length,
    regressions: keys,
    regressed_tests: keys.length,
    regressed_files: new Set(keys.map((k) => k.split(' :: ')[0])).size,
  };
}

for (const task of tasks) {
  for (const arm of arms) {
    if (done.has(`${task.id}/${arm}`)) continue;
    log(`${task.id} ${arm}: ${task.title.slice(0, 60)}`);
    const wt = prepareWorktree(task, arm);
    try {
      /* A failure setting up or driving one run is that run's error, recorded
         as a row, and the pass continues. Before this, a transient exception
         here ended the whole pass. */
      let m, baseline, before = null;
      try {
        baseline = await baselineFor(task, wt);
        await armSetup(task, arm, wt);
        before = new Set(untracked(wt));
        m = await runAgent(task, arm, wt);
      } catch (e) {
        m = { ...newMetrics(), error: `harness: ${String(e.message || e).slice(0, 200)}` };
      }
      /* git diff HEAD leaves out untracked files, so a file the agent created
         was missing from `edited`, the patch and diff_lines. Intent to add
         puts it in the diff. Files untracked before the agent started (the
         dataset's prepared inputs) stay out. */
      if (before) {
        const fresh = untracked(wt).filter((f) => !before.has(f));
        if (fresh.length) sh('git', ['add', '-N', '--', ...fresh], wt);
      }
      const edited = sh('git', ['diff', '--name-only', 'HEAD'], wt).split('\n').filter(Boolean);
      /* The patch itself is kept: a regression count is checkable only with
         the diff that produced it. */
      writeFileSync(join(outDir, 'patches', `${task.id}-${arm}.diff`), sh('git', ['diff', 'HEAD'], wt));
      /* Diff size, the AAIF metric: lines added plus removed in the final
         patch, and files touched. Both zero when the agent edited nothing. */
      let diff_lines = 0;
      for (const line of sh('git', ['diff', '--numstat', 'HEAD'], wt).split('\n')) {
        const [a, d] = line.split('\t');
        if (/^\d+$/.test(a)) diff_lines += Number(a);
        if (/^\d+$/.test(d)) diff_lines += Number(d);
      }
      const damage = suiteOn && baseline && !m.error ? await runDamage(task, wt, baseline) : null;
      const success = stopAt === 'none' ? runGoldTests(task, wt) : null;
      const conduct = baseline ? behaviour(edited, m, baseline.risky, wt) : null;
      const rec = { task: task.id, arm, agent, model: model ?? m.agent_model ?? null, skill: skillText ? createHash('sha1').update(skillText).digest('hex').slice(0, 10) : null, names_gold: task.names_gold, gold: task.gold, edited, gold_edited: edited.some((f) => task.gold.includes(f)), diff_lines, diff_files: edited.length, ...success, ...damage, ...conduct, ...m, at: new Date().toISOString() };
      appendFileSync(runsPath, JSON.stringify(rec) + '\n');
      log(`  steps ${m.steps}, first gold read at ${m.first_gold_read ?? '-'}, gold edited ${rec.gold_edited}, success ${rec.success ?? '-'}, regressions ${rec.regressed_tests ?? '-'}, tests run by agent ${m.agent_test_runs}, $${m.cost_usd?.toFixed(3) ?? '?'}${m.gate_fired ? `, gate x${m.gate_fired}` : ''}${m.error ? `, error: ${m.error}` : ''}`);
    } finally {
      if (!flag('--keep')) { spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: dataset.path }); rmSync(wt, { recursive: true, force: true }); }
    }
  }
}
log(`done: ${runsPath}`);
