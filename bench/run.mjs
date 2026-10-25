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
//        file   COMPLEX.md at the task's base commit, wired for Claude Code (CLAUDE.md, per path briefs)
//        hooks  file + the PreToolUse/Stop hooks
//        gold   no agent: the real fix's source diff, judged like a patch (an oracle)
// --stop-at edit kills the run at the agent's first edit: localization only, cheapest.
// --stop-at none runs to completion, which is what regressions, wall clock,
// diff size and success rate need, and the only way the hooks arm can be
// evaluated at all. --no-suite skips the regression suite.
// Runs are appended to <out>/runs.jsonl and skipped when already present, so it resumes.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSignals, findCoveringTests } from '../cli/src/signals.js';
import { buildBundle, normalizeOutput, frontMatter } from '../cli/src/generate.js';
import { wire } from '../cli/src/wire.js';
import { detectRunner, listTestFiles, runSuite, confirm, goldTestFiles } from './suite.mjs';
import { createMeter, newMetrics, behaviour } from './agent-events.mjs';
import { claudeCommand, mapCommand } from './claude-args.mjs';
import { isolatedCheckout, fileAt, fixSourceDiff, applyPatch } from './isolate.mjs';
import { mapAnchor, assertMapUsable, commitTime } from './maps.mjs';
import { MAP_CAP, fitSignals, sizeNote, assertFits } from './fit.mjs';
import { sandboxSupport, sandboxCommand, startProxy, innerPid, which, DEFAULT_ROOTS, DEFAULT_ALLOW } from './sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(here, '../cli/bin/complex-md.js');
/* Every row records the CLI that wired it. The wiring of an arm follows
   this checkout's cli/src/wire.js, so a row is comparable only with rows
   wired the same way. The commit pins it when the version was not bumped. */
const CLI_VERSION = JSON.parse(readFileSync(resolve(here, '../cli/package.json'), 'utf8')).version;
const CLI_COMMIT = spawnSync('git', ['rev-parse', '--short=10', 'HEAD'], { cwd: here, encoding: 'utf8' }).stdout.trim() || null;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);

const dataset = JSON.parse(readFileSync(opt('--dataset', 'bench/data/fastify.json'), 'utf8'));
const arms = opt('--arms', 'none,file').split(',');
/* The mcp arm (hooks plus the MCP server) is retired. Its rows in
   bench/results stay readable, but no new run can add to them. */
const ARMS = ['none', 'front', 'file', 'hooks', 'gold'];
for (const a of arms) {
  if (a === 'mcp') { console.error('the mcp arm is retired; run hooks for the wired map with its hooks.'); process.exit(2); }
  if (!ARMS.includes(a)) { console.error(`unknown arm ${a}: ${ARMS.join(', ')}`); process.exit(2); }
}
const agent = opt('--agent', 'claude');
/* Scripted agents stand in for a model when the harness itself is tested.
   Any other name is refused: an unknown name used to fall through to a real
   Claude Code run. CX_BENCH_NO_MODEL=1 refuses every model call outright. */
const SCRIPTED = { mock: 'mock-agent.mjs', probe: 'leak-probe.mjs' };
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
/* --map-cap: the bytes a map may take, front matter and prose together.
   The default is the 8,192 the spec recommends; 0 turns the check off. The
   runs published before it had no cap.
   --max-runs: rows this pass may add before it stops, so a night's share
   of the usage limit is fixed. A rerun skips finished rows and resumes.
   --maps-only: build the maps the selected tasks need, then stop. Run it
   once before parallel workers share a cache, so no two of them write the
   same month's map. */
const mapCap = Number(opt('--map-cap', MAP_CAP));
const maxRuns = opt('--max-runs', null) === null ? Infinity : Number(opt('--max-runs'));
const mapsOnly = flag('--maps-only');
/* Every agent runs in bench/sandbox.mjs: no network but the model API
   hosts, and no files but its checkout and its own install. --no-sandbox
   runs without it, and each row records which. --allow-host adds proxy
   hosts (host, or host:port); --mask adds directories to hide (a colon
   separated list). */
const sandboxOn = !flag('--no-sandbox') && arms.some((a) => a !== 'gold');
if (sandboxOn) {
  const s = sandboxSupport();
  if (!s.ok) { console.error(`the agent sandbox is not available on this host (${s.reason}). --no-sandbox runs without network and file isolation.`); process.exit(2); }
}
const allowHosts = [...DEFAULT_ALLOW, ...opt('--allow-host', '').split(',').filter(Boolean)];
const maskRoots = () => [...DEFAULT_ROOTS, dataset.path, resolve(outDir), resolve(cacheDir), resolve(here, '..'), resolve(workRoot), ...opt('--mask', '').split(':').filter(Boolean)];
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

/* COMPLEX.md as a user would have had it at the task's base commit. One map
   per calendar month of task dates, built at the oldest base of that month
   in the whole dataset (bench/maps.mjs), and refused for a task whose base
   does not have that commit in its history. The cache key names the commit
   the map was built at, so a map cached under the old rule is never read. */
const commitTimes = new Map();
const timeOf = (sha) => { if (!commitTimes.has(sha)) commitTimes.set(sha, commitTime(dataset.path, sha)); return commitTimes.get(sha); };

async function mapFor(task) {
  const anchor = mapAnchor(dataset.tasks, task, timeOf);
  assertMapUsable(dataset.path, anchor, task);
  const month = task.date.slice(0, 7);
  const key = `${(dataset.repo || 'repo').replace('/', '-')}-${month}-${anchor.slice(0, 10)}.md`;
  const cached = join(cacheDir, 'maps', key);
  // A map cached before the cap, or under a larger one, is built again.
  if (existsSync(cached) && (mapCap <= 0 || Buffer.byteLength(readFileSync(cached)) <= mapCap)) return { text: readFileSync(cached, 'utf8'), anchor };
  log(`generating map for ${month} at ${anchor.slice(0, 10)}`);
  const wt = isolatedCheckout(dataset.path, anchor, join(workRoot, `.map-${anchor.slice(0, 12)}`));
  try {
    return { text: await writeMap(wt, cached), anchor };
  } finally { rmSync(wt, { recursive: true, force: true }); }
}

async function writeMap(wt, cached) {
  const all = computeSignals(wt);
  /* List rows are cut from the end until the front matter leaves the prose
     room under the cap (bench/fit.mjs); the model gets a byte budget. */
  const tool = 'complex-md/bench';
  const sig = mapCap > 0 ? fitSignals(all, (s) => frontMatter(s, tool), Math.floor(mapCap * 0.44)) : all;
  const { bundle, frontMatter: fm } = buildBundle(wt, sig, tool);
  let text;
  if (SCRIPTED[agent]) {
    text = `${fm}\n## Where the risk lives\n\n${sig.hotspots.slice(0, 3).map((h) => `${h.path} (${h.fixes} fixes)`).join(', ')} carry the fix history. Fixing a bug you have not located: start there.\n`;
  } else {
    // The prose model call goes through the same Claude Code login the agent runs use; no tools, one turn.
    noModel();
    const [cmd, a, env] = mapCommand({ model });
    /* A reply over the cap gets two more tries, each with a smaller prose
       budget. A map still over it is refused, and the task's row says so. */
    for (let scale = 0.85, tries = 0; ; scale *= 0.75, tries++) {
      const { note } = mapCap > 0 ? sizeNote(fm, mapCap, scale) : { note: '' };
      const r = spawnSync(cmd, a, { cwd: wt, input: bundle + note, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      let j; try { j = JSON.parse(r.stdout); } catch { throw new Error(`map generation failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`); }
      if (j.is_error) throw new Error(`map generation failed: ${j.result}`); // the harness reports the agent's own error text
      text = normalizeOutput(j.result, fm);
      log(`map: ${text.split('\n').length} lines, ${Buffer.byteLength(text)} bytes, ${sig.hotspots.length} of ${all.hotspots.length} hotspots, $${(j.total_cost_usd || 0).toFixed(3)}`);
      if (mapCap <= 0 || Buffer.byteLength(text) <= mapCap || tries >= 2) break;
    }
  }
  assertFits(text, mapCap);
  writeFileSync(cached, text);
  return text;
}

/* The dataset clone's install, copied once (hard links where the file
   system allows) to a directory that holds nothing else. A link straight
   into the clone led an agent from node_modules to the clone and its
   future history. */
let deps;
function depsFor() {
  if (deps !== undefined) return deps;
  const src = join(dataset.path, 'node_modules');
  if (!existsSync(src)) return (deps = null);
  const dest = join(workRoot, '.deps', (dataset.repo || 'repo').replace('/', '-'), 'node_modules');
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    if (spawnSync('cp', ['-al', src, dest]).status !== 0) { rmSync(dest, { recursive: true, force: true }); sh('cp', ['-a', src, dest]); }
  }
  return (deps = dest);
}

function prepareWorktree(task, arm) {
  const wt = join(workRoot, `${task.id}-${arm}`);
  /* A fresh repository with the history up to the base and nothing after
     it, never a worktree of the dataset clone (bench/isolate.mjs). */
  isolatedCheckout(dataset.path, task.base, wt);
  // No arm gets a pre-existing map or wiring from the repository itself.
  for (const f of ['COMPLEX.md', '.complex-md']) rmSync(join(wt, f), { recursive: true, force: true });
  /* A worktree has no node_modules of its own. Without this, every test the
     agent ran failed with a missing module in every arm, and the success
     metric could never be true. The link is the dataset checkout's install,
     made once; a repository without one records success as null. */
  const nm = depsFor();
  if (nm && !existsSync(join(wt, 'node_modules'))) symlinkSync(nm, join(wt, 'node_modules'), 'dir');
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
  const runner = suiteOn ? detectRunner(wt, dataset.suite) : null;
  const files = runner ? listTestFiles(wt, dataset.suite) : [];
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
  if (arm === 'none' || arm === 'gold') return;
  const { text: full, anchor } = await mapFor(task);
  const given = arm === 'front' ? frontMatterOnly(full) : full;
  writeFileSync(join(wt, 'COMPLEX.md'), given);
  /* The runs published in bench/results were wired when wire also wrote
     .claude/rules/complex-md.md: the integration block again, loaded when
     the agent touched a listed path. wire no longer writes it, because
     CLAUDE.md carries the block, so a rerun of the file arm is not the arm
     those runs measured. Compare a rerun with rows of the same
     cli_version and cli_commit, not with the published rows. */
  wire(wt, { agents: ['claude'], profile: 'full', hooks: arm === 'hooks', block: skillText });
  // The hooks call this checkout's binary, so a run measures this CLI.
  const settings = join(wt, '.claude/settings.json');
  if (existsSync(settings)) writeFileSync(settings, readFileSync(settings, 'utf8').replace(/"command": "[^"]*\bcomplex-md\b[^"]*?\b(hook [\w-]+)[^"]*"/g, `"command": "node ${BIN} $1"`));
  // The map is context, not a change the agent made.
  sh('git', ['add', '-A'], wt);
  sh('git', ['-c', 'user.email=bench@complex.md', '-c', 'user.name=bench', 'commit', '-q', '-m', 'bench: COMPLEX.md and wiring'], wt);
  return { anchor, bytes: Buffer.byteLength(given) };
}

/* No instruction about tests: whether the agent checks what its change
   reaches is part of what is measured. */
const PROMPT = (t) => `Fix this issue in the repository. Find the code responsible and change it. Do not commit.\n\n# ${t.title}\n\n${t.text}`;

function agentCommand(task, arm, wt) {
  if (SCRIPTED[agent]) return [process.execPath, [join(here, SCRIPTED[agent])], { CX_GOLD: task.gold.join(',') }];
  noModel();
  return claudeCommand({ arm, wt, budget, model });
}

/* What the agent may see: its checkout, the dependency copy, the Node
   install, and the agent's own install and credentials. The CLI checkout is
   there for the hooks arm, which calls its binary. */
function agentKeeps(wt) {
  const keeps = [wt, dirname(dirname(realpathSync(process.execPath)))];
  if (depsFor()) keeps.push(depsFor());
  if (SCRIPTED[agent]) return [...keeps, join(here, SCRIPTED[agent])];
  const c = which('claude');
  if (c) keeps.push(dirname(dirname(realpathSync(c))));
  keeps.push(resolve(here, '../cli'));
  for (const f of [join(homedir(), '.claude', '.credentials.json'), join(homedir(), '.claude.json')]) if (existsSync(f)) keeps.push(f);
  return keeps;
}

async function runAgent(task, arm, wt) {
  let [cmd, a, env] = agentCommand(task, arm, wt);
  let proxy = null;
  const sbx = `${wt}.sandbox`;
  if (sandboxOn) {
    rmSync(sbx, { recursive: true, force: true });
    mkdirSync(sbx, { recursive: true });
    const [c2, a2, env2, { socket }] = sandboxCommand({ cmd, args: a, cwd: wt, dir: sbx, roots: maskRoots(), keeps: agentKeeps(wt) });
    proxy = await startProxy({ socket, allow: allowHosts });
    [cmd, a, env] = [c2, a2, { ...env, ...env2 }];
  }
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, a, { cwd: wt, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    /* In the sandbox the agent is the child of unshare, which ignores
       SIGINT and SIGTERM; SIGKILL to unshare takes the namespace down. */
    const stop = (sig) => {
      const pid = proxy && sig !== 'SIGKILL' ? innerPid(child.pid) : null;
      try { if (pid) process.kill(pid, sig); else child.kill(sig); } catch {}
    };
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
      stop('SIGINT');
      hardKill = setTimeout(() => stop('SIGKILL'), graceS * 1000);
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
          setTimeout(() => stop('SIGTERM'), 1500); // let the tool result land so a gate denial is recorded
        }
      }
    });
    child.on('close', async (code) => {
      clearTimeout(timer); clearTimeout(hardKill);
      /* Where the agent tried to connect: a denied host is a leak attempt
         or a dependency the allowlist lacks, and either is worth reading. */
      m.sandbox = Boolean(proxy);
      if (proxy) {
        await proxy.close();
        m.net_allowed = [...proxy.allowed];
        m.net_denied = [...proxy.denied];
        rmSync(sbx, { recursive: true, force: true });
      }
      // The harness clock: the agent's own duration_ms comes only with its result event.
      m.wall_ms = Date.now() - t0;
      if (code !== 0 && !killed && !m.error && !m.stopped) m.error = (stderr.join('').trim() || `exit ${code}`).slice(0, 300);
      writeFileSync(join(outDir, 'transcripts', `${task.id}-${arm}.jsonl`), transcript.join('\n') + '\n');
      resolvePromise(m);
    });
  });
}

/* The oracle arm: the real fix's source change, applied with no agent and
   no model, then judged like any agent's patch. It separates a regression
   the agent caused from a test the real fix breaks too, or a flaky one. */
function goldRun(task, wt) {
  applyPatch(wt, fixSourceDiff(dataset.path, task.base, task.fix));
  return { ...newMetrics(), cost_usd: 0 };
}

/* Success rate, the 2602.11988 metric: does the agent's patch pass the tests
   the real fix was verified by. The dataset records those test files. A fix
   often ADDS its test, so the file may not exist at the base commit; it is
   taken from the fix commit into the worktree first, then run against the
   agent's change. Each file is run on its own with the runner the repository
   uses, detected from package.json rather than assumed. No test files, or no
   detectable runner, records null rather than a pass. */
function runGoldTests(task, wt) {
  const files = goldTestFiles(task, dataset.suite);
  if (!files.length) return { tests_run: 0, tests_passed: null, success: null };
  const runner = detectRunner(wt, dataset.suite);
  if (!runner) return { tests_run: 0, tests_passed: null, success: null };
  let passed = 0, run = 0;
  for (const f of files) {
    // The fix commit is not in the isolated checkout: its test file comes from the clone.
    const body = fileAt(dataset.path, task.fix, f);
    if (body) { mkdirSync(dirname(join(wt, f)), { recursive: true }); writeFileSync(join(wt, f), body); }
    if (!existsSync(join(wt, f))) continue;
    run++;
    const r = spawnSync(runner.cmd, [...runner.args, f], { cwd: wt, encoding: 'utf8', timeout: 120000, env: { ...process.env, CI: '1', ...runner.env }, maxBuffer: 64 * 1024 * 1024 });
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
  const runner = detectRunner(wt, dataset.suite);
  const after = await runSuite(wt, runner, baseline.files);
  const keys = await confirm(wt, runner, baseline.results, after, new Set(task.tests || []));
  return {
    suite_files: baseline.files.length,
    regressions: keys,
    regressed_tests: keys.length,
    regressed_files: new Set(keys.map((k) => k.split(' :: ')[0])).size,
  };
}

if (mapsOnly) {
  const mapArms = arms.filter((a) => a !== 'none' && a !== 'gold');
  /* A month whose map fails is logged and left; its tasks' rows record the
     error when a worker tries again. */
  let failed = 0;
  for (const task of tasks) {
    if (!mapArms.some((a) => !done.has(`${task.id}/${a}`))) continue;
    try { await mapFor(task); } catch (e) { failed++; log(`map for ${task.id} failed: ${String(e.message || e).slice(0, 200)}`); }
  }
  log(`maps built: ${join(cacheDir, 'maps')}${failed ? `, ${failed} tasks without a map` : ''}`);
  process.exit(failed ? 4 : 0);
}

let added = 0;
pass: for (const task of tasks) {
  for (const arm of arms) {
    if (done.has(`${task.id}/${arm}`)) continue;
    if (added >= maxRuns) { log(`--max-runs ${maxRuns} reached`); break pass; }
    log(`${task.id} ${arm}: ${task.title.slice(0, 60)}`);
    const wt = prepareWorktree(task, arm);
    try {
      /* A failure setting up or driving one run is that run's error, recorded
         as a row, and the pass continues. Before this, a transient exception
         here ended the whole pass. */
      let m, baseline, before = null, mapCommit = null, mapBytes = null;
      try {
        baseline = await baselineFor(task, wt);
        const setup = await armSetup(task, arm, wt);
        mapCommit = setup?.anchor ?? null;
        mapBytes = setup?.bytes ?? null;
        before = new Set(untracked(wt));
        m = arm === 'gold' ? goldRun(task, wt) : await runAgent(task, arm, wt);
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
      const rec = { task: task.id, arm, agent, model: model ?? m.agent_model ?? null, cli_version: CLI_VERSION, cli_commit: CLI_COMMIT, skill: skillText ? createHash('sha1').update(skillText).digest('hex').slice(0, 10) : null, map_commit: mapCommit, map_bytes: mapBytes, map_cap: mapCap || null, names_gold: task.names_gold, gold: task.gold, edited, gold_edited: edited.some((f) => task.gold.includes(f)), diff_lines, diff_files: edited.length, ...success, ...damage, ...conduct, ...m, at: new Date().toISOString() };
      appendFileSync(runsPath, JSON.stringify(rec) + '\n');
      added++;
      log(`  steps ${m.steps}, first gold read at ${m.first_gold_read ?? '-'}, gold edited ${rec.gold_edited}, success ${rec.success ?? '-'}, regressions ${rec.regressed_tests ?? '-'}, tests run by agent ${m.agent_test_runs}, $${m.cost_usd?.toFixed(3) ?? '?'}${m.gate_fired ? `, gate x${m.gate_fired}` : ''}${m.error ? `, error: ${m.error}` : ''}`);
    } finally {
      if (!flag('--keep')) rmSync(wt, { recursive: true, force: true });
    }
  }
}
log(`done: ${runsPath}`);
