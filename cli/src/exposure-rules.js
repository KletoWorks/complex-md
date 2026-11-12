// The exposure rule set: load it, check it, compile it.
//
// Rules are data. A rule file holds patterns and names, never code: a rule
// that needs logic beyond its expression names a predicate from the fixed
// table below, and a rule file cannot add one. The same loader reads the
// shipped file, cli/rules/exposure.json, and the rules an engineer adds in
// .complex-md/exposure.json, so both pass the same checks.
//
// JavaScript expressions backtrack, so an expression from a cloned
// repository could stall a run for minutes. checkRegex() accepts only a
// subset: every quantifier has an upper bound, no quantified group holds
// another quantifier, and there are no back references and no lookaround.
// That subset also runs in a linear time engine, if one is used later.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const SLICES = ['E1'];
export const ESTABLISHED = ['exact', 'structural', 'history', 'heuristic'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const CONFIDENCES = ['high', 'medium', 'low'];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_REGEX = 1024;
const MAX_BOUND = 12000;

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEPARATOR = /[-_.:|/]+/;
const CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
const IDENTIFIER_CHAIN = /^[A-Za-z_$][\w$]*(?:[.:-][A-Za-z_$][\w$]*)*$/;
// Values that have the entropy of a secret and are something else: prose,
// a query string, a file path, a media type, or a password hash in crypt
// format.
const NOT_A_SECRET = [
  // Text in a script other than Latin has the entropy of a key; a key is ASCII.
  /[^\x21-\x7e]/,
  /[&?][A-Za-z_][\w.-]{0,40}=/,
  /^(?:[A-Za-z]:[\\/]|\.{0,2}\/|~\/)/,
  /^(?:application|text|image|audio|video|multipart|font|model)\/[a-z0-9.+-]/i,
  /^\$(?:\d[a-z]?|2[abxy]|argon2(?:id|i|d)?|scrypt|pbkdf2[-_a-z0-9]{0,12})\$/i,
];

/* True when `v` looks like a random secret rather than a word or a name.
   It needs the entropy floor, and either a digit and a letter or 3 of the
   4 character classes. A lowercase value made of short parts, such as
   `web-article-v1` or `booking:b1:created`, is a lookup key, not a
   credential: it needs 1 random part of 16 characters or more, or the
   shape of a UUID. */
export function looksRandom(v, { minEntropy = 3.5 } = {}) {
  if (v.includes('://')) return false;
  if (entropy(v) < minEntropy) return false;
  if (NOT_A_SECRET.some((re) => re.test(v))) return false;
  const digitAndLetter = /\d/.test(v) && /[A-Za-z]/.test(v);
  if (!digitAndLetter) {
    if (CLASSES.filter((re) => re.test(v)).length < 3) return false;
    // A name or a member chain such as usage.prompt_tokens is code, not a value.
    if (IDENTIFIER_CHAIN.test(v)) return false;
  }
  if (!/[A-Z]/.test(v) && SEPARATOR.test(v)) return UUID.test(v) || v.split(SEPARATOR).some((s) => s.length >= 16 && /\d/.test(s) && /[a-z]/.test(s));
  return true;
}

/**
 * The predicates a rule may name, with the parameters each one takes.
 * test(value, params, context): `context` is the text of the line before
 * the value, at most 200 characters, such as `  clientId = "`. The
 * parameter `nameNot` is an expression, checked like a rule's, that
 * rejects the match when it matches the context.
 */
export const PREDICATES = {
  'random-value': { params: ['minEntropy', 'nameNot'], test: randomValue },
};

// A UUID is a row id far more often than a secret. It counts only under a
// name that says secret, token, password, credential or jwt, not one that
// says key alone, such as fieldDefKey.
const STRONG_NAME = /secret|token|passw|pwd|credential|jwt/i;
// A public or publishable key is meant to be shared.
const PUBLIC_NAME = /(?:public|publishable)[_.-]?key/i;

function randomValue(v, p = {}, ctx = '', nameNot = null) {
  if (!looksRandom(v, p)) return false;
  if (nameNot && nameNot.test(ctx)) return false;
  if (PUBLIC_NAME.test(ctx)) return false;
  if (UUID.test(v) && ctx && !STRONG_NAME.test(ctx)) return false;
  return true;
}

/**
 * Why `src` is outside the accepted subset, or null when it is inside.
 * Walks the expression once, tracking escapes, classes and groups.
 */
export function checkRegex(src) {
  if (typeof src !== 'string' || !src) return 'the expression is empty';
  if (src.length > MAX_REGEX) return `the expression is longer than ${MAX_REGEX} characters`;
  // 1 entry per open group: q is true when a quantifier sits inside it.
  const stack = [{ q: false }];
  // What a quantifier here would apply to: null (nothing), 'atom', or a closed group.
  let prev = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      if (n === undefined) return 'the expression ends with a backslash';
      if (/[1-9]/.test(n) || n === 'k') return 'back references are not accepted';
      i++;
      prev = 'atom';
    } else if (c === '[') {
      let j = i + 1;
      if (src[j] === '^') j++;
      if (src[j] === ']') j++;
      for (; j < src.length && src[j] !== ']'; j++) if (src[j] === '\\') j++;
      if (j >= src.length) return 'a character class is not closed';
      i = j;
      prev = 'atom';
    } else if (c === '(') {
      if (src[i + 1] === '?') {
        if (/^\(\?<?[=!]/.test(src.slice(i, i + 4))) return 'lookaround is not accepted';
        if (src[i + 2] !== ':') return 'only (?:...) groups and plain capture groups are accepted';
        i += 2;
      }
      stack.push({ q: false });
      prev = null;
    } else if (c === ')') {
      if (stack.length === 1) return 'a group closes that never opened';
      const g = stack.pop();
      if (g.q) stack[stack.length - 1].q = true;
      prev = g;
    } else if (c === '*' || c === '+') {
      return `the quantifier ${c} has no upper bound; write {0,N} or {1,N}`;
    } else if (c === '?' || (c === '{' && /^\{\d/.test(src.slice(i)))) {
      let hi = 1;
      if (c === '{') {
        const m = /^\{(\d{1,6})(?:(,)(\d{1,6})?)?\}/.exec(src.slice(i));
        if (!m) return 'a quantifier is not closed';
        if (m[2] && m[3] === undefined) return `the quantifier ${m[0]} has no upper bound`;
        hi = Number(m[3] ?? m[1]);
        if (hi > MAX_BOUND) return `the quantifier ${m[0]} is above ${MAX_BOUND}`;
        if (hi < Number(m[1])) return `the quantifier ${m[0]} is out of order`;
        i += m[0].length - 1;
      }
      if (prev === null) {
        // A ? right after a quantifier makes it lazy.
        if (c === '?' && /[}?]/.test(src[i - 1])) continue;
        return 'a quantifier follows nothing';
      }
      // A repeated group that holds a quantifier backtracks in exponential
      // time; an optional one does not repeat, so it is accepted.
      if (typeof prev === 'object' && prev.q && hi > 1) return 'a repeated group holds another quantifier';
      stack[stack.length - 1].q = true;
      prev = null;
    } else if (c === '|') {
      prev = null;
    } else {
      prev = 'atom';
    }
  }
  if (stack.length > 1) return 'a group is not closed';
  return null;
}

/* Check 1 rule. Returns a list of problems, empty when the rule is good. */
function checkRule(r, where) {
  const errs = [];
  const at = `${where}: rule ${typeof r?.id === 'string' ? r.id : '(no id)'}`;
  if (!r || typeof r !== 'object') return [`${where}: a rule is not an object`];
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) errs.push(`${at}: id must be lower case letters, digits and hyphens`);
  if (!SLICES.includes(r.slice)) errs.push(`${at}: slice must be one of ${SLICES.join(', ')}`);
  if (typeof r.title !== 'string' || !r.title) errs.push(`${at}: title is missing`);
  if (!ESTABLISHED.includes(r.established)) errs.push(`${at}: established must be one of ${ESTABLISHED.join(', ')}`);
  if (!SEVERITIES.includes(r.severity)) errs.push(`${at}: severity must be one of ${SEVERITIES.join(', ')}`);
  if (!CONFIDENCES.includes(r.confidence)) errs.push(`${at}: confidence must be one of ${CONFIDENCES.join(', ')}`);
  if (typeof r.cwe !== 'string' || !/^CWE-\d{1,5}$/.test(r.cwe)) errs.push(`${at}: cwe must look like CWE-798`);
  if (typeof r.directive !== 'string' || !r.directive) errs.push(`${at}: directive is missing`);
  const m = r.match;
  if (!m || typeof m !== 'object') return [...errs, `${at}: match is missing`];
  if (m.type !== 'content') errs.push(`${at}: match.type must be content`);
  if (!Array.isArray(m.keywords) || !m.keywords.length || m.keywords.some((k) => typeof k !== 'string' || !k || k !== k.toLowerCase())) errs.push(`${at}: match.keywords must be 1 or more lower case strings`);
  const why = checkRegex(m.regex);
  if (why) errs.push(`${at}: match.regex: ${why}`);
  if (m.flags !== undefined && (typeof m.flags !== 'string' || !/^[ims]{0,3}$/.test(m.flags))) errs.push(`${at}: match.flags may hold only i, m and s`);
  if (!why) {
    try { new RegExp(m.regex, (m.flags || '') + 'gd'); } catch (e) { errs.push(`${at}: match.regex does not compile: ${e.message}`); }
  }
  for (const k of ['minLength', 'minEntropy']) if (m[k] !== undefined && !(typeof m[k] === 'number' && m[k] >= 0 && m[k] <= 1000)) errs.push(`${at}: match.${k} must be a number`);
  if (m.predicate !== undefined) {
    const p = PREDICATES[m.predicate];
    if (!p) errs.push(`${at}: match.predicate ${JSON.stringify(m.predicate)} is not one of ${Object.keys(PREDICATES).join(', ')}`);
    else for (const k of Object.keys(m.params || {})) if (!p.params.includes(k)) errs.push(`${at}: match.params.${k} is not a parameter of ${m.predicate}`);
    const nn = m.params?.nameNot;
    if (nn !== undefined) {
      const w = checkRegex(nn);
      if (w) errs.push(`${at}: match.params.nameNot: ${w}`);
    }
    const me = m.params?.minEntropy;
    if (me !== undefined && !(typeof me === 'number' && me >= 0 && me <= 8)) errs.push(`${at}: match.params.minEntropy must be a number from 0 to 8`);
  }
  return errs;
}

/**
 * Check a parsed rule file: { placeholders, stopwords, rules }. Returns the
 * list of problems; an empty list means every rule compiles.
 */
export function checkRuleFile(data, where = 'rule file') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [`${where}: not a JSON object`];
  const errs = [];
  if (!Array.isArray(data.rules)) errs.push(`${where}: rules must be a list`);
  for (const k of ['placeholders', 'stopwords']) {
    if (data[k] !== undefined && (!Array.isArray(data[k]) || data[k].some((s) => typeof s !== 'string' || !s))) errs.push(`${where}: ${k} must be a list of strings`);
  }
  for (const p of data.placeholders || []) {
    const why = checkRegex(p);
    if (why) errs.push(`${where}: placeholder ${JSON.stringify(p)}: ${why}`);
  }
  const seen = new Set();
  for (const r of data.rules || []) {
    errs.push(...checkRule(r, where));
    if (r?.id && seen.has(r.id)) errs.push(`${where}: rule ${r.id} appears twice`);
    seen.add(r?.id);
  }
  return errs;
}

const SHIPPED_URL = new URL('../rules/exposure.json', import.meta.url);
let shipped = null;

/** The shipped rule file, parsed and checked once per process. */
export function shippedRules() {
  if (shipped) return shipped;
  const text = readFileSync(SHIPPED_URL, 'utf8');
  const data = JSON.parse(text);
  const errs = checkRuleFile(data, 'cli/rules/exposure.json');
  if (errs.length) throw new Error(errs.join('\n'));
  shipped = { ...data, hash: createHash('sha256').update(text).digest('hex').slice(0, 12) };
  return shipped;
}

/* The predicate of 1 rule, with its parameters bound. nameNot is matched
   with the rule's own flags, so an i rule ignores case in it too. */
function predicateFor(match) {
  const { test } = PREDICATES[match.predicate];
  const params = match.params || {};
  const nameNot = params.nameNot ? new RegExp(params.nameNot, (match.flags || '').replace('m', '')) : null;
  return (value, context) => test(value, params, context, nameNot);
}

/* Keywords grouped by their first 2 characters (a 1 character keyword by
   its only one), longest first, so the scanner tests a position against
   the few keywords that can start there. */
function keywordIndex(keywords) {
  const two = new Map();
  const one = new Map();
  // A bit per pair of low bytes: most positions fail this test, and only a
  // hit pays for the map lookup and the string compare.
  const bits = new Uint8Array(65536);
  for (const k of keywords) {
    const m = k.length === 1 ? one : two;
    const key = k.length === 1 ? k.charCodeAt(0) : k.charCodeAt(0) * 65536 + k.charCodeAt(1);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(k);
    if (k.length > 1) bits[((k.charCodeAt(0) & 255) << 8) | (k.charCodeAt(1) & 255)] = 1;
  }
  return { two, one, bits };
}

/**
 * Compile rule definitions for scanning. `disable` names rule ids that do
 * not run. Placeholders and stopwords come from the shipped file.
 */
export function compileRules(defs, { disable = [], placeholders = shippedRules().placeholders, stopwords = shippedRules().stopwords } = {}) {
  const off = new Set(disable);
  // A heuristic rule yields a shared span to every other rule, an own rule
  // from .complex-md/exposure.json included, so it compiles last.
  const on = defs.filter((r) => !off.has(r.id));
  const rules = [...on.filter((r) => r.established !== 'heuristic'), ...on.filter((r) => r.established === 'heuristic')];
  // 1 pass over the text finds every keyword: longest first, so at 1
  // position the longest keyword wins, and `within` maps each keyword to
  // the shorter keywords inside it, which that match also proves present.
  const keywords = [...new Set(rules.flatMap((r) => r.match.keywords))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const within = new Map(keywords.map((k) => [k, keywords.filter((s) => k.includes(s))]));
  return {
    keywordIndex: keywordIndex(keywords),
    within,
    rules: rules.map((r, order) => ({
      ...r,
      order,
      keywords: r.match.keywords,
      re: new RegExp(r.match.regex, (r.match.flags || '') + 'gd'),
      minLength: r.match.minLength || 0,
      minEntropy: r.match.minEntropy || 0,
      predicate: r.match.predicate ? predicateFor(r.match) : null,
    })),
    placeholders: (placeholders || []).map((p) => new RegExp(p)),
    stopwords: (stopwords || []).map((s) => s.toLowerCase()),
  };
}
