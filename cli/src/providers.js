// One table of model providers. Everything except Anthropic speaks the
// OpenAI chat-completions shape, so a provider is a base URL, a key env
// var, and a default model. Defaults are current IDs as of 2026-09 and are
// set only where the ID was verified; providers whose catalog we cannot
// pin (together, ollama, custom) require an explicit --model, which is an
// error message, not a guess.
export const PROVIDERS = [
  { name: 'anthropic', env: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-5' },
  { name: 'openai', env: 'OPENAI_API_KEY', base: 'https://api.openai.com/v1', model: 'gpt-5.6-terra' },
  { name: 'openrouter', env: 'OPENROUTER_API_KEY', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-v4-pro', headers: { 'HTTP-Referer': 'https://complex.md', 'X-Title': 'complex-md' } },
  { name: 'gemini', env: 'GEMINI_API_KEY', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.6-flash' },
  { name: 'xai', env: 'XAI_API_KEY', base: 'https://api.x.ai/v1', model: 'grok-4.6' },
  { name: 'deepseek', env: 'DEEPSEEK_API_KEY', base: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro' },
  { name: 'mistral', env: 'MISTRAL_API_KEY', base: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
  { name: 'groq', env: 'GROQ_API_KEY', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'together', env: 'TOGETHER_API_KEY', base: 'https://api.together.xyz/v1', model: null },
  // Local and self-configured endpoints never auto-detect from a key: ollama
  // opts in via OLLAMA_HOST or --provider, custom via COMPLEX_MD_BASE_URL.
  { name: 'ollama', env: null, hostEnv: 'OLLAMA_HOST', base: 'http://localhost:11434/v1', model: null },
  { name: 'custom', env: 'COMPLEX_MD_API_KEY', baseEnv: 'COMPLEX_MD_BASE_URL', model: null },
];

const byName = new Map(PROVIDERS.map((p) => [p.name, p]));

function detected(p, env) {
  // ollama never auto-detects: OLLAMA_HOST is commonly exported for the
  // ollama CLI itself, and detecting it here would hijack the no-key
  // agent-bundle fallback. Select it with --provider ollama.
  if (p.name === 'ollama') return false;
  if (p.name === 'custom') return Boolean(env[p.baseEnv]);
  return Boolean(env[p.env]);
}

/**
 * Pick the provider and model for one generate call. Returns
 * { name, model, base, key, headers } or null when nothing is configured
 * (the agent-mode prompt bundle is the fallback, never a guess).
 *
 * Explicit beats detected: `--provider x`, or `--model x/model` where x is
 * a known provider name, or COMPLEX_MD_PROVIDER. Otherwise the first
 * provider in table order with its key set wins. `--model a/b` for an
 * unknown prefix `a` is passed through as the model (openrouter slugs
 * contain a slash).
 */
export function resolveProvider({ model = null, provider = null, env = process.env } = {}) {
  let want = provider || env.COMPLEX_MD_PROVIDER || null;
  let mdl = model || env.COMPLEX_MD_MODEL || null;
  // A provider-name prefix on the model selects that provider, but only
  // when it is actually configured: vendor prefixes in openrouter slugs
  // collide with provider names (deepseek/..., mistral/...), and the
  // configured one is the one the user means.
  if (!want && mdl && mdl.includes('/')) {
    const head = mdl.slice(0, mdl.indexOf('/'));
    const p = byName.get(head);
    if (p && (detected(p, env) || head === 'ollama')) {
      want = head;
      mdl = mdl.slice(head.length + 1);
    }
  }
  let p;
  if (want) {
    p = byName.get(want);
    if (!p) throw new Error(`unknown provider "${want}"; one of: ${PROVIDERS.map((x) => x.name).join(', ')}`);
  } else {
    p = PROVIDERS.find((x) => detected(x, env));
    if (!p) return null;
  }
  const chosen = mdl || p.model;
  if (!chosen) throw new Error(`provider "${p.name}" has no default model; pass --model (or COMPLEX_MD_MODEL)`);
  const base = (p.baseEnv && env[p.baseEnv]) || (p.hostEnv && env[p.hostEnv] ? env[p.hostEnv].replace(/\/$/, '') + '/v1' : null) || p.base || null;
  const key = p.env ? env[p.env] || null : null;
  if (p.env && !key && p.name !== 'ollama') throw new Error(`provider "${p.name}" selected but ${p.env} is not set`);
  return { name: p.name, model: chosen, base, key, headers: p.headers || {} };
}
