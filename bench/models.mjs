#!/usr/bin/env node
// The model matrix: does each model write a usable COMPLEX.md?
//
// For each model and each of three small public repositories, pinned by
// commit, this builds the same prompt bundle the CLI sends, makes one
// OpenRouter call, and scores the reply with the deterministic checks in
// bench/mapcheck.mjs. The result is pass or fail per check per model. It is
// not a ranking, and the summary keeps the order of --models.
//
//   node bench/models.mjs --dry-run
//   node bench/models.mjs --budget 10 --out bench/results/models/2026-10-24
//   node bench/models.mjs --models deepseek/deepseek-v4-pro,qwen/qwen3.8-27b --repos ky
//   node bench/models.mjs --rescore bench/results/models/2026-10-24
//
// Cost control: before the first call, the run is priced from the public
// OpenRouter model list, with every call charged its full output cap
// (--max-tokens, default 12000). Models that advertise reasoning get a
// 24000-token cap with at most 8000 reserved for reasoning. A run above
// --budget (default 10 USD) is refused. The cap is sent as max_tokens, so
// the estimate bounds the output side of the bill.
// Input tokens are estimated at 3 characters a token, which overstates code.
//
// The key is read from OPENROUTER_API_KEY_COMPLEXMD and from no other
// variable, so a key exported for another tool is never spent here. It is
// sent in one header and written nowhere.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { computeSignals } from '../cli/src/signals.js';
import { buildBundle } from '../cli/src/generate.js';
import { trackedFiles } from '../cli/src/git.js';
import { scoreMap, scoreWrittenMap, splitReply, CHECKS } from './mapcheck.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CLI_VERSION = JSON.parse(readFileSync(resolve(here, '../cli/package.json'), 'utf8')).version;

export const KEY_VAR = 'OPENROUTER_API_KEY_COMPLEXMD';
export const MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const CHARS_PER_TOKEN = 3;
export const MAX_TOKENS = 12000;
export const REASONING_MAX_TOKENS = 24000;
export const REASONING_TOKENS = 8000;
export const BUDGET_USD = 10;
const CALL_TIMEOUT_MS = 300000;

/* Chosen from the public model list on 2026-10-24: the current release of
   each family, open weights first, then three closed families. */
export const DEFAULT_MODELS = [
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4.1-flash',
  'moonshotai/kimi-k2.6',
  'qwen/qwen3.8-27b',
  'qwen/qwen3-coder-next',
  'z-ai/glm-5.1',
  'minimax/minimax-m2.7',
  'nousresearch/hermes-4-405b',
  'mistralai/devstral-2512',
  'meta-llama/llama-4-maverick',
  'google/gemma-4-31b-it',
  'openai/gpt-oss-120b',
  'google/gemini-3.8-flash',
  'openai/gpt-6.1-sol',
  'x-ai/grok-4.7',
];
export const OPEN_WEIGHTS = new Set(DEFAULT_MODELS.slice(0, 12));

/* Three small repositories in three languages, each with a few hundred
   commits and more than one source file, pinned so the bundle is the same
   on every run of the same CLI version. */
export const REPOS = [
  { name: 'ky', url: 'https://github.com/sindresorhus/ky.git', commit: '3541888878c4d303a8bc2ad61815f4e048f55a5d', language: 'TypeScript' },
  { name: 'itsdangerous', url: 'https://github.com/pallets/itsdangerous.git', commit: '672971d66a2ef9f85151e53283113f33d642dabd', language: 'Python' },
  { name: 'pflag', url: 'https://github.com/spf13/pflag.git', commit: 'd26a4dcd30a3c17923a2083b48bd6233aada9d47', language: 'Go' },
];

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A checkout of `repo` at its pinned commit under workDir; clones on first use. */
export function prepareRepo(repo, workDir) {
  const dir = join(workDir, repo.name);
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(workDir, { recursive: true });
    const c = git(['clone', '--quiet', '--no-checkout', repo.url, dir]);
    if (c.status !== 0) throw new Error(`clone of ${repo.url} failed: ${c.stderr.trim()}`);
  }
  const co = git(['checkout', '--quiet', '--detach', repo.commit], dir);
  if (co.status !== 0) throw new Error(`${repo.name}: commit ${repo.commit} not found: ${co.stderr.trim()}`);
  const head = git(['rev-parse', 'HEAD'], dir).stdout.trim();
  if (head !== repo.commit) throw new Error(`${repo.name}: HEAD is ${head}, expected ${repo.commit}`);
  return dir;
}

/** The bundle, the computed front matter, the tracked files and the hot files shown, per repository. */
export function buildInputs(repos, { workDir, prepare = prepareRepo }) {
  const tool = `complex-md/${CLI_VERSION}`;
  return repos.map((repo) => {
    const dir = prepare(repo, workDir);
    const sig = computeSignals(dir);
    const { bundle, frontMatter } = buildBundle(dir, sig, tool);
    const hot = sig.hotspots.map((h) => h.path).filter((p) => bundle.includes(`\n### ${p}\n\nKind: `)).slice(0, 5);
    return { ...repo, dir, bundle, fm: frontMatter, hot, files: trackedFiles(dir) };
  });
}

const num = (s) => Number(s || 0) || 0;

/* A model is priced only when its prompt and completion prices are numbers
   of 0 or more. The list marks a router whose price depends on the model it
   picks with "-1"; counting that as a price would lower the total. */
const priced = (p) => ['prompt', 'completion'].every((k) => p.pricing?.[k] !== undefined && p.pricing[k] !== '' && Number(p.pricing[k]) >= 0);

/** Price every call at its input estimate plus its full output cap. */
export function priceRun({ models, inputs, prices, maxTokens = MAX_TOKENS }) {
  const byId = new Map(prices.map((p) => [p.id, p]));
  const missing = models.filter((m) => !byId.has(m));
  const unpriced = models.filter((m) => byId.has(m) && !priced(byId.get(m)));
  const rows = [];
  let total = 0;
  for (const model of models) {
    const p = byId.get(model);
    if (!p || !priced(p)) continue;
    const completion = Math.max(num(p.pricing?.completion), num(p.pricing?.internal_reasoning));
    const reasoning = p.supported_parameters?.includes('reasoning') || false;
    const outputCap = reasoning ? Math.max(maxTokens, REASONING_MAX_TOKENS) : maxTokens;
    for (const input of inputs) {
      const inputTokens = Math.ceil(input.bundle.length / CHARS_PER_TOKEN);
      const usd = inputTokens * num(p.pricing?.prompt) + outputCap * completion + num(p.pricing?.request);
      rows.push({ model, repo: input.name, inputTokens, maxOutputTokens: outputCap, reasoning, usd });
      total += usd;
    }
  }
  return { rows, total, missing, unpriced };
}

async function readJson(res, what) {
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${what}: HTTP ${res.status}, body is not JSON (${e.message})`);
  }
}

export async function fetchPrices(fetchImpl = fetch) {
  const res = await fetchImpl(MODELS_URL, { signal: AbortSignal.timeout(60000) });
  const j = await readJson(res, 'model list');
  if (!res.ok || !Array.isArray(j.data)) throw new Error(`model list: HTTP ${res.status}`);
  return j.data;
}

/** One chat completion. Errors name the status and the provider's message, never the request headers. */
export async function callModel({ model, bundle, key, fetchImpl = fetch, maxTokens = MAX_TOKENS, reasoning = false }) {
  const t0 = Date.now();
  const body = { model, messages: [{ role: 'user', content: bundle }], max_tokens: maxTokens, usage: { include: true } };
  if (reasoning) body.reasoning = { max_tokens: Math.min(REASONING_TOKENS, maxTokens - 1) };
  const res = await fetchImpl(CHAT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'HTTP-Referer': 'https://complex.md', 'X-Title': 'complex-md model matrix' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const j = await readJson(res, model);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${j.error?.message || 'no message'}`);
  const content = j.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : '';
  const finishReason = j.choices?.[0]?.finish_reason ?? null;
  const u = j.usage || {};
  return {
    text,
    error: text.trim() ? null : 'empty_content',
    finishReason,
    ms: Date.now() - t0,
    usage: {
      prompt_tokens: u.prompt_tokens ?? null,
      completion_tokens: u.completion_tokens ?? null,
      completion_tokens_details: { reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? null },
    },
    cost: typeof u.cost === 'number' ? u.cost : null,
  };
}

const slug = (model) => model.replace(/[/:]/g, '__');
const usd = (n) => `$${n.toFixed(2)}`;

export function summaryTable(rows) {
  const head = ['model', 'repo', ...CHECKS.flatMap((c) => [`${c.replace(/_/g, ' ')} raw`, `${c.replace(/_/g, ' ')} written`])];
  const lines = [
    '# Model matrix',
    '',
    'Pass or fail per check for the raw reply and the file the CLI would write, from bench/mapcheck.mjs. This is not a ranking: rows keep the order of --models.',
    '',
    `| ${head.join(' | ')} |`,
    `|${head.map(() => ' --- ').join('|')}|`,
  ];
  for (const r of rows) {
    const cells = r.error
      ? ['error', ...CHECKS.flatMap(() => ['', ''])]
      : CHECKS.flatMap((c) => ['raw', 'written'].map((kind) => (r.checks[kind][c].pass ? 'pass' : 'fail')));
    lines.push(`| ${r.model} | ${r.repo} | ${cells.join(' | ')} |`);
  }
  const scored = rows.filter((r) => !r.error && r.checks?.written);
  const allWrittenPass = scored.filter((r) => CHECKS.every((c) => r.checks.written[c].pass)).length;
  lines.push('', `Written maps passing every check: ${allWrittenPass} of ${scored.length} scored maps.`);
  const errors = rows.filter((r) => r.error);
  if (errors.length) lines.push('', 'Errors:', '', ...errors.map((r) => `- ${r.model} on ${r.repo}: ${r.error}`));
  return lines.join('\n') + '\n';
}

/** Re-score saved model replies without preparing repositories or making network requests. */
export function rescoreResults(outDir) {
  const out = resolve(outDir);
  const resultsPath = join(out, 'results.json');
  const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const repos = new Map((results.repos || []).map((repo) => [repo.name, repo]));
  const oldChecks = (row) => row.checks?.raw || row.checks;
  const computedFrontMatter = (name) => {
    const repo = repos.get(name) || {};
    if (repo.front_matter) return repo.front_matter;
    const candidate = (results.rows || []).find((r) => r.repo === name && oldChecks(r)?.front_matter?.pass);
    if (!candidate) return null;
    const path = join(out, 'maps', name, `${slug(candidate.model)}.md`);
    return existsSync(path) ? splitReply(readFileSync(path, 'utf8')).fm : null;
  };
  for (const row of results.rows || []) {
    row.finish_reason ??= null;
    const oldUsage = row.usage || {};
    row.usage = {
      prompt_tokens: oldUsage.prompt_tokens ?? oldUsage.input ?? null,
      completion_tokens: oldUsage.completion_tokens ?? oldUsage.output ?? null,
      completion_tokens_details: { reasoning_tokens: oldUsage.completion_tokens_details?.reasoning_tokens ?? oldUsage.reasoning ?? null },
    };
    const replyPath = join(out, 'maps', row.repo, `${slug(row.model)}.md`);
    if (!existsSync(replyPath)) {
      if (/no choices\[0\]\.message\.content/.test(row.error || '')) row.error = 'empty_content';
      continue;
    }
    const reply = readFileSync(replyPath, 'utf8');
    const repo = repos.get(row.repo) || {};
    const previous = oldChecks(row);
    const scoreInput = { reply, fm: computedFrontMatter(row.repo), files: repo.files || [], hot: repo.hot || [] };
    const raw = scoreMap(scoreInput);
    if (!repo.files && previous?.paths) raw.paths = previous.paths;
    const written = scoreInput.fm ? scoreWrittenMap(scoreInput) : Object.fromEntries(CHECKS.map((check) => [check, { pass: false, detail: 'not written: computed front matter was not saved' }]));
    if (!repo.files && raw.paths) written.paths = raw.paths;
    row.checks = { raw, written };
    row.error = null;
  }
  writeFileSync(resultsPath, JSON.stringify(results, null, 2) + '\n');
  writeFileSync(join(out, 'summary.md'), summaryTable(results.rows || []));
  return results;
}

/**
 * Plan, price and, unless dryRun, run the matrix. Refuses before any call
 * when the budget or the output cap is not a positive number, a model is
 * not in the price list or has no fixed price, the estimate is above the
 * budget, or the key is not set.
 */
export async function runMatrix({ models = DEFAULT_MODELS, repos = REPOS, budget = BUDGET_USD, maxTokens = MAX_TOKENS, dryRun = false, env = process.env, fetchImpl = fetch, workDir = join(tmpdir(), 'complex-md-models'), outDir, prepare = prepareRepo, log = console.log, now = new Date() }) {
  // A NaN budget is never below a total, so it would let any run start.
  if (!(Number.isFinite(budget) && budget > 0)) throw new Error(`--budget needs a positive number of USD, got ${budget}`);
  if (!(Number.isInteger(maxTokens) && maxTokens > 0)) throw new Error(`--max-tokens needs a positive whole number, got ${maxTokens}`);
  const inputs = buildInputs(repos, { workDir, prepare });
  for (const i of inputs) log(`${i.name} @ ${i.commit.slice(0, 10)}: bundle ${i.bundle.length} characters, about ${Math.ceil(i.bundle.length / CHARS_PER_TOKEN)} tokens; ${i.hot.length} hot files shown`);
  const prices = await fetchPrices(fetchImpl);
  const plan = priceRun({ models, inputs, prices, maxTokens });
  if (plan.missing.length) throw new Error(`not in the OpenRouter model list: ${plan.missing.join(', ')}`);
  if (plan.unpriced.length) throw new Error(`no fixed price in the OpenRouter model list, so the run cannot be priced: ${plan.unpriced.join(', ')}`);
  const perModel = new Map();
  for (const r of plan.rows) perModel.set(r.model, (perModel.get(r.model) || 0) + r.usd);
  for (const [m, v] of perModel) log(`  ${usd(v).padStart(7)}  ${m}`);
  const maxOutputTokens = Math.max(maxTokens, ...plan.rows.map((r) => r.maxOutputTokens));
  log(`estimated total: ${usd(plan.total)} for ${plan.rows.length} calls (${models.length} models x ${inputs.length} repositories), at most ${maxOutputTokens} output tokens a call; budget ${usd(budget)}`);
  const over = plan.total > budget;
  if (dryRun) {
    log(over ? `dry run: a real run would be refused, because the estimate is above the budget of ${usd(budget)}.` : 'dry run: no model was called and nothing was written.');
    return { plan, total: plan.total, rows: [] };
  }
  if (over) throw new Error(`the estimate of ${usd(plan.total)} is above the budget of ${usd(budget)}; pass a smaller --models list or a larger --budget`);
  const key = env[KEY_VAR];
  if (!key) throw new Error(`${KEY_VAR} is not set; no other variable is read, so a key exported for another tool is never spent here`);

  const out = outDir || join(here, 'results', 'models', now.toISOString().slice(0, 10));
  const rows = [];
  for (const model of models) {
    for (const input of inputs) {
      log(`call: ${model} on ${input.name}`);
      const planRow = plan.rows.find((r) => r.model === model && r.repo === input.name);
      const row = {
        model,
        repo: input.name,
        commit: input.commit,
        error: null,
        finish_reason: null,
        ms: null,
        usage: { prompt_tokens: null, completion_tokens: null, completion_tokens_details: { reasoning_tokens: null } },
        cost_usd: null,
        checks: null,
      };
      try {
        const r = await callModel({ model, bundle: input.bundle, key, fetchImpl, maxTokens: planRow.maxOutputTokens, reasoning: planRow.reasoning });
        Object.assign(row, { finish_reason: r.finishReason, ms: r.ms, usage: r.usage, cost_usd: r.cost });
        if (r.error) {
          row.error = r.error;
          log(`  error: ${row.error} (finish_reason ${row.finish_reason ?? 'unknown'})`);
          rows.push(row);
          continue;
        }
        const scoreInput = { reply: r.text, fm: input.fm, files: input.files, hot: input.hot };
        row.checks = { raw: scoreMap(scoreInput), written: scoreWrittenMap(scoreInput) };
        mkdirSync(join(out, 'maps', input.name), { recursive: true });
        writeFileSync(join(out, 'maps', input.name, `${slug(model)}.md`), r.text);
        log(`  ${CHECKS.map((c) => `${c} raw ${row.checks.raw[c].pass ? 'pass' : 'fail'}, written ${row.checks.written[c].pass ? 'pass' : 'fail'}`).join(', ')}`);
      } catch (e) {
        row.error = e?.name === 'TimeoutError' ? `no reply within ${CALL_TIMEOUT_MS / 1000} s` : String(e?.message || e);
        log(`  error: ${row.error}`);
      }
      rows.push(row);
    }
  }
  mkdirSync(out, { recursive: true });
  const spent = rows.reduce((s, r) => s + (r.cost_usd || 0), 0);
  const results = { generated: now.toISOString(), cli_version: CLI_VERSION, max_tokens: maxTokens, budget_usd: budget, estimate_usd: plan.total, cost_usd: spent, repos: inputs.map(({ name, url, commit, language, hot, files, fm }) => ({ name, url, commit, language, hot, files, front_matter: fm })), checks: CHECKS, rows };
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  writeFileSync(join(out, 'summary.md'), summaryTable(rows));
  log(`wrote ${join(out, 'results.json')} and summary.md; reported cost ${usd(spent)}`);
  return { plan, total: plan.total, rows, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  const list = (s, all) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : all);
  const repoNames = list(opt('--repos'), REPOS.map((r) => r.name));
  const repos = REPOS.filter((r) => repoNames.includes(r.name));
  const unknown = repoNames.filter((n) => !REPOS.some((r) => r.name === n));
  if (unknown.length) {
    console.error(`unknown repository: ${unknown.join(', ')}; one of: ${REPOS.map((r) => r.name).join(', ')}`);
    process.exit(2);
  }
  const rescore = opt('--rescore');
  if (args.includes('--rescore')) {
    if (!rescore || rescore.startsWith('--')) {
      console.error('models: --rescore needs a results directory');
      process.exit(2);
    }
    try {
      const results = rescoreResults(rescore);
      console.log(`rescored ${results.rows.length} calls from ${resolve(rescore)}; wrote results.json and summary.md`);
    } catch (e) {
      console.error(`models: ${e.message}`);
      process.exit(2);
    }
  } else {
    runMatrix({
      models: list(opt('--models'), DEFAULT_MODELS),
      repos,
      budget: Number(opt('--budget', BUDGET_USD)),
      maxTokens: Number(opt('--max-tokens', MAX_TOKENS)),
      dryRun: args.includes('--dry-run'),
      workDir: opt('--work', join(tmpdir(), 'complex-md-models')),
      outDir: opt('--out', undefined),
    }).catch((e) => {
      console.error(`models: ${e.message}`);
      process.exit(2);
    });
  }
}
