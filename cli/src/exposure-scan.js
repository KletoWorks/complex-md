// The exposure scanner: text in, matches out. No file system, no git and
// no clock, so the bundle redaction, the tree scan and the history walk
// all call the same code.
//
// Per rule: a keyword check on the lower cased text (a rule runs only
// when 1 of its keywords is present), the expression over the whole text,
// then the value checks on the secret part of the match: length, entropy,
// the placeholder and stopword lists, and the rule's predicate. When 2
// rules match the same characters, the earlier rule in the file keeps the
// match, so a specific token rule wins over the generic assignment rule.
import { createHash } from 'node:crypto';
import { entropy } from './exposure-rules.js';

/* The secret part of a match: the first capture group that took part, or
   the whole match when the expression has no group. */
function secretSpan(m) {
  for (let g = 1; g < m.length; g++) if (m[g] !== undefined && m[g] !== '') return m.indices[g];
  return m.indices[0];
}

function passes(rule, value, context, compiled) {
  if (value.length < rule.minLength) return false;
  if (rule.minEntropy && entropy(value) < rule.minEntropy) return false;
  if (compiled.placeholders.some((re) => re.test(value))) return false;
  const lower = value.toLowerCase();
  if (compiled.stopwords.some((w) => lower.includes(w))) return false;
  if (rule.predicate && !rule.predicate(value, context)) return false;
  return true;
}

/* Index of the last element of sorted `starts` that is <= x, or -1. */
function floorIndex(starts, x) {
  let lo = 0, hi = starts.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= x) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** 1-based line and column of each offset in `text`, from 1 pass over the newlines. */
export function lineIndex(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    const l = floorIndex(starts, offset);
    return { line: l + 1, column: offset - starts[l] + 1 };
  };
}

/* The keywords that occur in `lower`, from 1 pass over its characters. A
   keyword found also proves each shorter keyword inside it. */
function keywordsIn(lower, compiled) {
  const { two, one, bits } = compiled.keywordIndex;
  const present = new Set();
  const n = lower.length;
  let c = lower.charCodeAt(0);
  for (let i = 0; i < n; i++) {
    const d = lower.charCodeAt(i + 1);
    if (one.size && one.has(c)) for (const k of one.get(c)) present.add(k);
    if (!bits[((c & 255) << 8) | (d & 255)]) { c = d; continue; }
    const list = two.get(c * 65536 + d);
    c = d;
    if (!list) continue;
    for (const k of list) {
      if (present.has(k) || !lower.startsWith(k, i)) continue;
      for (const s of compiled.within.get(k)) present.add(s);
    }
  }
  return present;
}

/**
 * Every match of the compiled rules in `text`, sorted by offset. Each match:
 * { rule, start, end, value, line, column }. `value` is the secret itself;
 * the caller uses it in memory to fingerprint or to replace, and never
 * writes it out.
 */
export function scanText(text, compiled) {
  const present = keywordsIn(text.toLowerCase(), compiled);
  if (!present.size) return [];
  const found = [];
  for (const rule of compiled.rules) {
    if (!rule.keywords.some((k) => present.has(k))) continue;
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const [start, end] = secretSpan(m);
      const value = text.slice(start, end);
      // The context is the line before the value, at most 200 characters.
      const from = Math.max(text.lastIndexOf('\n', m.index) + 1, start - 200);
      if (passes(rule, value, text.slice(from, start), compiled)) found.push({ rule, start, end, value });
    }
  }
  if (!found.length) return [];
  // Earlier rules first; a later match that overlaps a kept one is dropped.
  found.sort((a, b) => a.rule.order - b.rule.order || a.start - b.start);
  const keptStarts = [];
  const kept = [];
  for (const f of found) {
    const i = floorIndex(keptStarts, f.end - 1);
    // Kept spans do not overlap each other, so only the nearest one at or
    // before f.end can overlap f.
    if (i >= 0 && kept[i].end > f.start) continue;
    keptStarts.splice(i + 1, 0, f.start);
    kept.splice(i + 1, 0, f);
  }
  const at = lineIndex(text);
  return kept.map((f) => ({ ...f, ...at(f.start) }));
}

/**
 * `text` with each match replaced by `[redacted:<rule id>]`, and the
 * number of replacements per rule id.
 */
export function replaceMatches(text, matches) {
  const counts = {};
  let out = '';
  let last = 0;
  for (const m of matches) {
    out += text.slice(last, m.start) + `[redacted:${m.rule.id}]`;
    last = m.end;
    counts[m.rule.id] = (counts[m.rule.id] || 0) + 1;
  }
  return { text: matches.length ? out + text.slice(last) : text, counts, total: matches.length };
}

/**
 * The identity of 1 secret: 16 hex characters of the SHA-256 of the rule
 * id and the value. It does not depend on the path or the line, so a key
 * keeps its identity when its file moves, and the tree and the history
 * name the same key with the same fingerprint. Every rule requires a
 * fixed token format or a random value, so the hash does not make a
 * guess cheap to confirm.
 */
export function fingerprint(ruleId, value) {
  return createHash('sha256').update(`complex-md exposure v1\0${ruleId}\0${value}`).digest('hex').slice(0, 16);
}

/* `complex-md: allow <rule-id> <reason>`. The rule id is required; there is
   no allow for every rule. A comment closer at the end is not part of the
   reason. */
const ALLOW_RE = /complex-md:\s{0,3}allow\s{1,5}([a-z0-9][a-z0-9-]{1,63})(?:[ \t]{1,5}([^\n]{1,200}))?/g;

/** The allow comments on 1 line: [{ rule, reason }]. A comment with no reason is listed with reason ''. */
export function allowComments(line) {
  if (!line || !line.includes('complex-md')) return [];
  const out = [];
  for (const m of line.matchAll(ALLOW_RE)) {
    const reason = (m[2] || '').replace(/\s*(\*\/|-->|#\}|%\})\s*$/, '').trim();
    out.push({ rule: m[1], reason: /[A-Za-z]/.test(reason) ? reason : '' });
  }
  return out;
}

/**
 * The inline allow for a match of `ruleId` on `line`, from that line or
 * the line above it: { reason } or null. `prevLine` may be null.
 */
export function inlineAllow(ruleId, line, prevLine) {
  for (const l of [line, prevLine]) {
    const a = allowComments(l).find((c) => c.rule === ruleId && c.reason);
    if (a) return { reason: a.reason };
  }
  return null;
}
