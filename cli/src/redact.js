// Secret-shaped values out of the model bundle.
//
// The bundle carries excerpts of hotspot files, and generate sends it to a
// model provider, to the agent CLI that --via names, or to the agent that
// reads .complex-md/prompt.md. A key that is hard-coded in a hotspot file
// would reach that third party with it. So each text that the bundle
// carries goes through redact() first, and each match becomes the fixed
// placeholder `[redacted:<rule>]`. The value itself is never logged,
// counted by content or kept.
//
// The token formats follow the public rule descriptions of gitleaks
// (gitleaks/gitleaks, MIT): a fixed prefix and a fixed alphabet and length.
// The expressions here are this project's own. The last rule is a
// heuristic: a value assigned to a name that says key, secret, token or
// password, kept only when the value looks random (Shannon entropy and a
// digit), so code that names a token but holds none stays as it is.

const B64URL = 'A-Za-z0-9_-';

/* Each exact rule: a name, and an expression whose whole match is the
   secret. Order matters where 2 formats share a prefix: anthropic-key runs
   before openai-key, which both start with `sk-`. */
const TOKEN_RULES = [
  { rule: 'private-key', re: /-----BEGIN[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----(?:[\s\S]*?-----END[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|[A-Za-z0-9+/=\s:,\\-]*)/g },
  { rule: 'aws-access-key', re: /\b(?:AKIA|ASIA|ABIA|ACCA|A3T[A-Z0-9])[A-Z2-7]{16}\b/g },
  { rule: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g },
  { rule: 'github-token', re: /\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\b/g },
  { rule: 'anthropic-key', re: new RegExp(`\\bsk-ant-[a-z]+\\d{2}-[${B64URL}]{32,}`, 'g') },
  { rule: 'openai-key', re: new RegExp(`\\bsk-(?:(?:proj|svcacct|admin)-)?[${B64URL}]{20,}T3BlbkFJ[${B64URL}]{20,}`, 'g') },
  { rule: 'openai-key', re: new RegExp(`\\bsk-(?:proj|svcacct|admin)-[${B64URL}]{40,}`, 'g') },
  { rule: 'slack-token', re: /\bxox[abposr]-(?:\d+-)+[A-Za-z0-9-]{10,}/g },
  { rule: 'slack-token', re: /\bxapp-\d-[A-Z0-9]+-\d+-[a-z0-9]{32,}/g },
  { rule: 'slack-webhook', re: /https:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/_-]{20,}/g },
  { rule: 'stripe-key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { rule: 'google-api-key', re: new RegExp(`\\bAIza[${B64URL}]{35}(?![${B64URL}])`, 'g') },
  { rule: 'jwt', re: new RegExp(`\\beyJ[${B64URL}]{10,}\\.eyJ[${B64URL}]{10,}\\.[${B64URL}]{10,}`, 'g') },
];

/* The assignment rule. A name that holds key, secret, token, password or
   credential, then `=`, `:=`, `:` or `=>`, then a value: quoted, or bare up
   to the next space, comma, semicolon, bracket or quote. Only the value is
   replaced, so the line keeps its shape and its name. The name starts at
   a word boundary and has bounded parts, so a long run of base64 in a file
   costs linear time, not quadratic. */
const NAME = String.raw`(?<![A-Za-z0-9_.-])[A-Za-z0-9_.-]{0,40}(?:key|secret|token|passw(?:or)?d|pwd|credential)[A-Za-z0-9_.-]{0,40}`;
const ASSIGN = new RegExp(String.raw`(${NAME}["']?\s*(?:=>|:=|=|:)\s*)(?:(["'\x60])([^"'\x60\s]{12,200})\2|([A-Za-z0-9+/=_.~!@#%^&*-]{16,200})(?=[\s,;)\]}"'\x60]|$))`, 'gim');

/** Shannon entropy of `s` in bits per character. */
export function entropy(s) {
  const counts = new Map();
  for (const c of s) counts.set(c, (counts.get(c) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// Values that name a secret but hold none: an environment lookup, a
// template slot, a placeholder word, or a value that is already redacted.
const NOT_A_VALUE = /^\[redacted:|\$\{|^\$[A-Z_]|^<.*>$|^%.*%$|^\{\{|process\.env|os\.environ|getenv|example|placeholder|changeme|your[_-]/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEPARATOR = /[-_.:|/]+/;

/* True when `v` looks like a random secret rather than a word or a name.
   A lowercase value made of short parts, such as `web-article-v1` or
   `booking:b1:created`, is a lookup key, not a credential: it needs 1
   random part of 16 characters or more, or the shape of a UUID. */
export function looksRandom(v) {
  if (NOT_A_VALUE.test(v) || v.includes('://')) return false;
  if (!/\d/.test(v) || !/[A-Za-z]/.test(v)) return false;
  if (entropy(v) < 3.5) return false;
  if (!/[A-Z]/.test(v) && SEPARATOR.test(v)) return UUID.test(v) || v.split(SEPARATOR).some((s) => s.length >= 16 && /\d/.test(s) && /[a-z]/.test(s));
  return true;
}

/* The rule names that redact() can put in a placeholder, in a fixed order,
   so a log line and a test can name each one. */
export const RULES = [...new Set(TOKEN_RULES.map((r) => r.rule)), 'generic-assignment'];

/**
 * `text` with each secret-shaped value replaced by `[redacted:<rule>]`,
 * and the number of replacements per rule. A text with no match comes
 * back as the same string.
 */
export function redact(text) {
  const counts = {};
  const hit = (rule) => {
    counts[rule] = (counts[rule] || 0) + 1;
    return `[redacted:${rule}]`;
  };
  let out = String(text);
  for (const { rule, re } of TOKEN_RULES) out = out.replace(re, () => hit(rule));
  out = out.replace(ASSIGN, (m, head, q, quoted, bare) => {
    const v = quoted ?? bare;
    if (!looksRandom(v)) return m;
    const ph = hit('generic-assignment');
    return quoted !== undefined ? `${head}${q}${ph}${q}` : `${head}${ph}`;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: total ? out : String(text), counts, total };
}

/** Add the counts of one redact() result into `into`, and return `into`. */
export function addCounts(into, r) {
  for (const [k, v] of Object.entries(r.counts)) into.counts[k] = (into.counts[k] || 0) + v;
  into.total += r.total;
  return into;
}

/** One log line for `r`, or null when nothing was redacted. It names rules and counts, never a value. */
export function redactionLine(r) {
  if (!r?.total) return null;
  const by = RULES.filter((k) => r.counts[k]).map((k) => `${k} ${r.counts[k]}`).join(', ');
  return `redacted ${r.total} secret-shaped value${r.total === 1 ? '' : 's'} in the prompt bundle (${by}); each is sent as [redacted:<rule>].`;
}
