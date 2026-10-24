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
  // Open model vendors, as of 2026-10. Base URL, key variable and default
  // model are the ones each vendor's quickstart uses. Qwen's base is the
  // DashScope international endpoint; a workspace specific endpoint goes
  // through custom (COMPLEX_MD_BASE_URL).
  { name: 'moonshot', env: 'MOONSHOT_API_KEY', base: 'https://api.moonshot.ai/v1', model: 'kimi-k3.1-pro' },
  { name: 'qwen', env: 'DASHSCOPE_API_KEY', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-max' },
  { name: 'zai', env: 'ZAI_API_KEY', base: 'https://api.z.ai/api/paas/v4', model: 'glm-5.3' },
  { name: 'minimax', env: 'MINIMAX_API_KEY', base: 'https://api.minimax.io/v1', model: 'MiniMax-M3.1-Flash' },
  { name: 'fireworks', env: 'FIREWORKS_API_KEY', base: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/glm-5p3-flash' },
  { name: 'cerebras', env: 'CEREBRAS_API_KEY', base: 'https://api.cerebras.ai/v1', model: 'qwen-3.8-27b' },
  // Explicit only: these never auto-detect. HF_TOKEN is exported for model
  // downloads as often as for inference, and OLLAMA_HOST for the ollama CLI;
  // detecting either would send code to a model when the user expected the
  // no-key bundle. keyEnv is read only after --provider names the entry.
  { name: 'huggingface', env: null, keyEnv: 'HF_TOKEN', explicit: true, base: 'https://router.huggingface.co/v1', model: 'openai/gpt-oss-120b' },
  { name: 'ollama', env: null, hostEnv: 'OLLAMA_HOST', explicit: true, base: 'http://localhost:11434/v1', model: null },
  { name: 'lmstudio', env: null, explicit: true, base: 'http://localhost:1234/v1', model: null },
  // A self-configured endpoint is detected from COMPLEX_MD_BASE_URL.
  { name: 'custom', env: 'COMPLEX_MD_API_KEY', baseEnv: 'COMPLEX_MD_BASE_URL', model: null },
];

const byName = new Map(PROVIDERS.map((p) => [p.name, p]));

function detected(p, env) {
  // An explicit entry never auto-detects (see the table). Select it with
  // --provider, or with --model <name>/<id>.
  if (p.explicit) return false;
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
    if (p && (detected(p, env) || p.explicit)) {
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
  const keyVar = p.env || p.keyEnv || null;
  const key = keyVar ? env[keyVar] || null : null;
  if (keyVar && !key) throw new Error(`provider "${p.name}" selected but ${keyVar} is not set`);
  return { name: p.name, model: chosen, base, key, headers: p.headers || {} };
}
