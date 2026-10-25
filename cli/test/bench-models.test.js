// The model matrix harness, with a stubbed fetch and a local fixture
// repository: no test reaches OpenRouter or clones over the network. Runs
// only inside the repository checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BENCH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bench');
const load = () => import(pathToFileURL(join(BENCH, 'models.mjs')).href);
const KEY = 'sk-or-test-0123456789abcdef';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-models-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 3; i++) {
    writeFileSync(join(dir, 'src/a.js'), `export const a = ${i + 2};\n`);
    g('add', '.');
    g('commit', '-q', '-m', `fix: a (${i})`);
  }
  return dir;
}

const PRICES = {
  data: [
    { id: 'open/model-a', pricing: { prompt: '0.000001', completion: '0.000002', request: '0' } },
    { id: 'closed/model-b', pricing: { prompt: '0.000003', completion: '0.000015' } },
  ],
};

/* A stub fetch: the public model list, and chat completions that echo the
   computed front matter from the bundle with prose on the fixture's files. */
function stubFetch({ failModel = null } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/models')) return { ok: true, status: 200, json: async () => PRICES };
    const body = JSON.parse(init.body);
    if (body.model === failModel) return { ok: false, status: 500, json: async () => ({ error: { message: 'upstream error' } }) };
    const prompt = body.messages[0].content;
    // The computed block, not the shape example in the prompt text above it.
    const fm = /## Front matter \(computed[^\n]*\n\n```yaml\n([\s\S]*?)\n```/.exec(prompt)[1] + '\n';
    const prose = '## Where the risk lives\n\nRisk sits in src/a.js.\n\n## Why these files are hot\n\nsrc/a.js holds the value. Before editing this file, open src/b.js.\n\n## Change coupling\n\nNone.\n\n## What to read first\n\n1. src/a.js: the value.\n';
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: fm + '\n' + prose }, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 80 }, cost: 0.0012 } }) };
  };
  return { impl, calls, chats: () => calls.filter((c) => c.url.endsWith('/chat/completions')) };
}

function setup() {
  const fixture = makeRepo();
  const repos = [{ name: 'fixture', url: fixture, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture, encoding: 'utf8' }).trim() }];
  const out = mkdtempSync(join(tmpdir(), 'cx-models-out-'));
  const logs = [];
  return { repos, out, logs, log: (l) => logs.push(l), work: mkdtempSync(join(tmpdir(), 'cx-models-work-')) };
}

test('the default matrix: 15 or more models, open weights first, repositories pinned by commit', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { DEFAULT_MODELS, OPEN_WEIGHTS, REPOS } = await load();
  assert.ok(DEFAULT_MODELS.length >= 15);
  assert.equal(new Set(DEFAULT_MODELS).size, DEFAULT_MODELS.length);
  const firstClosed = DEFAULT_MODELS.findIndex((m) => !OPEN_WEIGHTS.has(m));
  assert.ok(DEFAULT_MODELS.slice(firstClosed).every((m) => !OPEN_WEIGHTS.has(m)), 'every open weights model comes before the first closed one');
  assert.ok(firstClosed >= 10);
  assert.equal(REPOS.length, 3);
  for (const r of REPOS) assert.match(r.commit, /^[0-9a-f]{40}$/);
});

test('the price of a run: input tokens, the output cap and any per request fee', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { priceRun } = await load();
  const p = priceRun({ models: ['open/model-a', 'closed/model-b', 'gone/model-c'], inputs: [{ name: 'r', bundle: 'x'.repeat(3000) }], prices: PRICES.data, maxTokens: 1000 });
  assert.deepEqual(p.missing, ['gone/model-c']);
  // 1000 input tokens (3 characters a token) and 1000 output tokens at most.
  assert.equal(p.rows[0].usd, 1000 * 0.000001 + 1000 * 0.000002);
  assert.equal(p.rows[1].usd, 1000 * 0.000003 + 1000 * 0.000015);
  assert.equal(p.total, p.rows[0].usd + p.rows[1].usd);

  const reasoning = priceRun({
    models: ['reason/model'],
    inputs: [{ name: 'r', bundle: 'x'.repeat(3000) }],
    prices: [{ id: 'reason/model', supported_parameters: ['reasoning'], pricing: { prompt: '0.000001', completion: '0.000002' } }],
    maxTokens: 1000,
  });
  assert.equal(reasoning.rows[0].maxOutputTokens, 24000);
  assert.equal(reasoning.rows[0].reasoning, true);
  assert.equal(reasoning.total, 1000 * 0.000001 + 24000 * 0.000002);
});

test('--dry-run prints the plan and the price, needs no key and calls no model', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const f = stubFetch();
  const r = await runMatrix({ models: ['open/model-a', 'closed/model-b'], repos: s.repos, dryRun: true, env: {}, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log });
  assert.equal(f.chats().length, 0);
  assert.ok(r.total > 0);
  assert.ok(s.logs.some((l) => /estimated total: \$\d+\.\d{2} for 2 calls/.test(l)), s.logs.join('\n'));
  assert.deepEqual(readdirSync(s.out), []);
});

test('a run priced above the budget is refused before any call', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const f = stubFetch();
  await assert.rejects(runMatrix({ models: ['closed/model-b'], repos: s.repos, budget: 0.0001, env: { OPENROUTER_API_KEY_COMPLEXMD: KEY }, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log }), /above the budget of \$0\.00/);
  assert.equal(f.chats().length, 0);
});

test('the key comes only from OPENROUTER_API_KEY_COMPLEXMD', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const f = stubFetch();
  await assert.rejects(runMatrix({ models: ['open/model-a'], repos: s.repos, env: { OPENROUTER_API_KEY: KEY }, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log }), /OPENROUTER_API_KEY_COMPLEXMD is not set; no other variable is read/);
  assert.equal(f.chats().length, 0);
});

test('a run scores each map, records a failed call and never writes the key', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const f = stubFetch({ failModel: 'closed/model-b' });
  const r = await runMatrix({ models: ['open/model-a', 'closed/model-b'], repos: s.repos, env: { OPENROUTER_API_KEY_COMPLEXMD: KEY }, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log });
  const chats = f.chats();
  assert.equal(chats.length, 2);
  assert.equal(chats[0].init.headers.authorization, `Bearer ${KEY}`);
  assert.equal(JSON.parse(chats[0].init.body).max_tokens, 12000);

  const results = JSON.parse(readFileSync(join(s.out, 'results.json'), 'utf8'));
  const [a, b] = results.rows;
  assert.equal(a.model, 'open/model-a');
  assert.equal(a.error, null);
  assert.equal(a.finish_reason, 'stop');
  assert.deepEqual(a.usage, { prompt_tokens: 900, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 80 } });
  assert.equal(a.cost_usd, 0.0012);
  assert.deepEqual(Object.values(a.checks.raw).map((c) => c.pass), [true, true, true, true, true, true], JSON.stringify(a.checks));
  assert.deepEqual(Object.values(a.checks.written).map((c) => c.pass), [true, true, true, true, true, true], JSON.stringify(a.checks));
  assert.match(b.error, /HTTP 500: upstream error/);
  assert.equal(b.checks, null);
  assert.ok(existsSync(join(s.out, 'maps', 'fixture', 'open__model-a.md')));

  const summary = readFileSync(join(s.out, 'summary.md'), 'utf8');
  assert.match(summary, /\| open\/model-a \| fixture \| pass \| pass \| pass \| pass/);
  assert.match(summary, /\| closed\/model-b \| fixture \| error \|/);
  const errorLine = summary.split('\n').find((line) => line.includes('| closed/model-b |'));
  assert.equal(errorLine.split('|').length - 2, 2 + 2 * 6);
  assert.match(summary, /not a ranking/i);
  assert.match(summary, /Written maps passing every check: 1 of 1 scored maps/);
  assert.equal(r.rows.length, 2);

  const stdout = execFileSync('node', [join(BENCH, 'models.mjs'), '--rescore', s.out], { encoding: 'utf8' });
  assert.match(stdout, /rescored 2 calls/);
  const rescored = JSON.parse(readFileSync(join(s.out, 'results.json'), 'utf8'));
  assert.deepEqual(Object.values(rescored.rows[0].checks.written).map((c) => c.pass), [true, true, true, true, true, true]);
  for (const text of [JSON.stringify(results), summary, s.logs.join('\n'), ...readdirSync(join(s.out, 'maps', 'fixture')).map((f2) => readFileSync(join(s.out, 'maps', 'fixture', f2), 'utf8'))]) {
    assert.ok(!text.includes(KEY), 'the key appears in no output');
  }
});

test('reasoning calls reserve answer capacity and preserve metadata on empty content', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/models')) return { ok: true, status: 200, json: async () => ({ data: [{ ...PRICES.data[0], supported_parameters: ['reasoning'] }] }) };
    return { ok: true, status: 200, json: async () => ({
      choices: [{ message: { content: null, reasoning: 'internal reasoning only' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 900, completion_tokens: 24000, completion_tokens_details: { reasoning_tokens: 8000 } },
    }) };
  };
  const r = await runMatrix({ models: ['open/model-a'], repos: s.repos, env: { OPENROUTER_API_KEY_COMPLEXMD: KEY }, fetchImpl, workDir: s.work, outDir: s.out, log: s.log });
  const body = JSON.parse(calls.find((c) => c.url.endsWith('/chat/completions')).init.body);
  assert.equal(body.max_tokens, 24000);
  assert.deepEqual(body.reasoning, { max_tokens: 8000 });
  const row = r.rows[0];
  assert.equal(row.error, 'empty_content');
  assert.equal(row.finish_reason, 'length');
  assert.deepEqual(row.usage, { prompt_tokens: 900, completion_tokens: 24000, completion_tokens_details: { reasoning_tokens: 8000 } });
  assert.equal(row.checks, null);
  assert.equal(r.plan.rows[0].maxOutputTokens, 24000);
  assert.ok(r.plan.total < 10, `priced run exceeds budget: ${r.plan.total}`);
});

test('a budget or an output cap that is not a positive number is refused before any call', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { runMatrix } = await load();
  const s = setup();
  const f = stubFetch();
  const env = { OPENROUTER_API_KEY_COMPLEXMD: KEY };
  // "--budget abc" and a bare "--budget" both arrive as NaN, and NaN is never above a total.
  await assert.rejects(runMatrix({ models: ['closed/model-b'], repos: s.repos, budget: NaN, env, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log }), /--budget needs a positive number/);
  await assert.rejects(runMatrix({ models: ['closed/model-b'], repos: s.repos, maxTokens: NaN, env, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log }), /--max-tokens needs a positive whole number/);
  await assert.rejects(runMatrix({ models: ['closed/model-b'], repos: s.repos, budget: -1, env, fetchImpl: f.impl, workDir: s.work, outDir: s.out, log: s.log }), /--budget needs a positive number/);
  assert.equal(f.calls.length, 0);
});

test('a model with no price, or a negative price, is refused: it cannot be priced', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { priceRun } = await load();
  const prices = [
    { id: 'router/auto', pricing: { prompt: '-1', completion: '-1' } },
    { id: 'no/pricing' },
    { id: 'open/model-a', pricing: { prompt: '0.000001', completion: '0.000002' } },
  ];
  const p = priceRun({ models: ['router/auto', 'no/pricing', 'open/model-a'], inputs: [{ name: 'r', bundle: 'x'.repeat(3000) }], prices, maxTokens: 1000 });
  assert.deepEqual(p.unpriced, ['router/auto', 'no/pricing']);
  assert.deepEqual(p.rows.map((r) => r.model), ['open/model-a']);
  assert.ok(p.total > 0);
});
