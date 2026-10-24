import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveProvider, PROVIDERS } from '../src/providers.js';

test('detection: first provider in table order with a key set wins', () => {
  const r = resolveProvider({ env: { GROQ_API_KEY: 'g', MISTRAL_API_KEY: 'm' } });
  assert.equal(r.name, 'mistral', 'mistral precedes groq in the table');
  assert.equal(r.model, 'mistral-large-latest');
  assert.equal(r.key, 'm');
});

test('anthropic outranks everything and keeps its default model', () => {
  const r = resolveProvider({ env: { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', XAI_API_KEY: 'x' } });
  assert.equal(r.name, 'anthropic');
  assert.equal(r.model, 'claude-sonnet-5-5');
});

test('nothing configured resolves to null, never a guess', () => {
  assert.equal(resolveProvider({ env: {} }), null);
});

test('--model provider/id selects the provider and strips the prefix', () => {
  const r = resolveProvider({ model: 'gemini/gemini-3.6-flash', env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' } });
  assert.equal(r.name, 'gemini');
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.match(r.base, /generativelanguage/);
});

test('a slash in the model with an unknown prefix passes through (openrouter slugs)', () => {
  const r = resolveProvider({ model: 'deepseek/deepseek-v4-pro', env: { OPENROUTER_API_KEY: 'k' } });
  assert.equal(r.name, 'openrouter');
  assert.equal(r.model, 'deepseek/deepseek-v4-pro');
  assert.equal(r.headers['X-Title'], 'complex-md');
});

test('explicit provider without its key is an error, not a silent fallback', () => {
  assert.throws(() => resolveProvider({ provider: 'xai', env: {} }), /XAI_API_KEY/);
});

test('unknown provider names every valid one', () => {
  assert.throws(() => resolveProvider({ provider: 'bogus', env: {} }), /openrouter/);
});

test('together has no default model: explicit --model required', () => {
  assert.throws(() => resolveProvider({ env: { TOGETHER_API_KEY: 't' } }), /--model/);
  const r = resolveProvider({ model: 'meta-llama/Llama-Guard-4', env: { TOGETHER_API_KEY: 't' } });
  assert.equal(r.name, 'together');
});

test('ollama: never auto-detected (OLLAMA_HOST is the CLI convention), explicit only, keyless', () => {
  assert.equal(resolveProvider({ env: { OLLAMA_HOST: 'http://box:11434' } }), null, 'a stray OLLAMA_HOST must not hijack the agent-bundle fallback');
  const r = resolveProvider({ provider: 'ollama', model: 'qwen3', env: { OLLAMA_HOST: 'http://box:11434/' } });
  assert.equal(r.name, 'ollama');
  assert.equal(r.base, 'http://box:11434/v1');
  assert.equal(r.key, null);
  assert.equal(resolveProvider({ provider: 'ollama', model: 'qwen3', env: {} }).base, 'http://localhost:11434/v1');
});

test('custom endpoint via COMPLEX_MD_BASE_URL', () => {
  const r = resolveProvider({ model: 'my-model', env: { COMPLEX_MD_BASE_URL: 'https://llm.internal/v1', COMPLEX_MD_API_KEY: 's' } });
  assert.equal(r.name, 'custom');
  assert.equal(r.base, 'https://llm.internal/v1');
  assert.equal(r.key, 's');
});

test('COMPLEX_MD_PROVIDER and COMPLEX_MD_MODEL env selection', () => {
  const r = resolveProvider({ env: { COMPLEX_MD_PROVIDER: 'groq', COMPLEX_MD_MODEL: 'llama-3.1-8b-instant', GROQ_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' } });
  assert.equal(r.name, 'groq');
  assert.equal(r.model, 'llama-3.1-8b-instant');
});

test('every table entry is well-formed', () => {
  for (const p of PROVIDERS) {
    assert.ok(p.name);
    assert.ok(p.name === 'anthropic' || p.base || p.baseEnv || p.hostEnv, `${p.name} needs a base`);
  }
});

// Named providers for open model vendors. Each base URL, key variable and
// default model comes from the vendor's own quickstart.
const NAMED = [
  ['moonshot', 'MOONSHOT_API_KEY', 'https://api.moonshot.ai/v1', 'kimi-k3.1-pro'],
  ['qwen', 'DASHSCOPE_API_KEY', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen3.8-max'],
  ['zai', 'ZAI_API_KEY', 'https://api.z.ai/api/paas/v4', 'glm-5.3'],
  ['minimax', 'MINIMAX_API_KEY', 'https://api.minimax.io/v1', 'MiniMax-M3.1-Flash'],
  ['fireworks', 'FIREWORKS_API_KEY', 'https://api.fireworks.ai/inference/v1', 'accounts/fireworks/models/glm-5p3-flash'],
  ['cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1', 'qwen-3.8-27b'],
];

for (const [name, envVar, base, model] of NAMED) {
  test(`${name}: detected from ${envVar}, with its base URL and default model`, () => {
    const r = resolveProvider({ env: { [envVar]: 'k' } });
    assert.deepEqual({ name: r.name, base: r.base, model: r.model, key: r.key }, { name, base, model, key: 'k' });
  });
}

test('the named providers come after the existing ones in detection order', () => {
  assert.equal(resolveProvider({ env: { MOONSHOT_API_KEY: 'm', GROQ_API_KEY: 'g' } }).name, 'groq');
  assert.equal(resolveProvider({ env: { CEREBRAS_API_KEY: 'c', ZAI_API_KEY: 'z' } }).name, 'zai');
});

test('an OpenRouter slug that starts with a vendor name stays an OpenRouter slug', () => {
  const r = resolveProvider({ model: 'qwen/qwen3-coder-next', env: { OPENROUTER_API_KEY: 'k' } });
  assert.equal(r.name, 'openrouter');
  assert.equal(r.model, 'qwen/qwen3-coder-next');
  const q = resolveProvider({ model: 'qwen/qwen3.8-max', env: { OPENROUTER_API_KEY: 'k', DASHSCOPE_API_KEY: 'd' } });
  assert.equal(q.name, 'qwen', 'with the vendor key set, the vendor prefix selects the vendor');
});

test('huggingface: HF_TOKEN alone never selects it; --provider does', () => {
  assert.equal(resolveProvider({ env: { HF_TOKEN: 'h' } }), null, 'a token exported for model downloads must not send code to the router');
  const r = resolveProvider({ provider: 'huggingface', env: { HF_TOKEN: 'h' } });
  assert.deepEqual({ base: r.base, key: r.key, model: r.model }, { base: 'https://router.huggingface.co/v1', key: 'h', model: 'openai/gpt-oss-120b' });
  assert.throws(() => resolveProvider({ provider: 'huggingface', env: {} }), /HF_TOKEN/);
});

test('lmstudio: local, keyless, explicit only, and needs --model', () => {
  assert.equal(resolveProvider({ env: {} }), null);
  const r = resolveProvider({ provider: 'lmstudio', model: 'qwen3.8-27b', env: {} });
  assert.deepEqual({ base: r.base, key: r.key }, { base: 'http://localhost:1234/v1', key: null });
  assert.throws(() => resolveProvider({ provider: 'lmstudio', env: {} }), /--model/);
});

test('--help names every key variable and the local servers', () => {
  const bin = readFileSync(new URL('../bin/complex-md.js', import.meta.url), 'utf8');
  const help = /const HELP = `([\s\S]*?)`;/.exec(bin)[1];
  for (const p of PROVIDERS) {
    for (const v of [p.env, p.keyEnv, p.hostEnv, p.baseEnv]) if (v) assert.ok(help.includes(v), `--help names ${v} (${p.name})`);
  }
  assert.match(help, /LM Studio/);
});
