import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(r.model, 'claude-sonnet-5');
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
