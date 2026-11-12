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
// The detector is the E1 rule set in cli/rules/exposure.json, the same one
// that `complex-md exposure` runs: fixed token formats with a known prefix,
// alphabet and length, private key blocks, passwords in connection URLs,
// and 1 heuristic: a value assigned to a name that says key, secret, token
// or password, kept only when the value looks random (Shannon entropy and
// a mix of character classes), so code that names a token but holds none
// stays as it is. Only the shipped rules run here; the rules an engineer
// adds in .complex-md/exposure.json do not change what the bundle carries.
import { shippedRules, compileRules } from './exposure-rules.js';
import { scanText, replaceMatches } from './exposure-scan.js';

export { entropy, looksRandom } from './exposure-rules.js';

let compiled = null;
const e1 = () => (compiled ||= compileRules(shippedRules().rules.filter((r) => r.slice === 'E1')));

/* The rule names that redact() can put in a placeholder, in a fixed order,
   so a log line and a test can name each one. */
export const RULES = shippedRules().rules.filter((r) => r.slice === 'E1').map((r) => r.id);

/**
 * `text` with each secret-shaped value replaced by `[redacted:<rule>]`,
 * and the number of replacements per rule. A text with no match comes
 * back as the same string.
 */
export function redact(text) {
  const s = String(text);
  return replaceMatches(s, scanText(s, e1()));
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
