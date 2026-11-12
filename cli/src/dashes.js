// Em and en dashes in model prose. The map's sentence rules allow neither
// as punctuation, and models write them anyway: 25 of 40 maps in the first
// model matrix run had at least 1. This module finds the sentences that use
// one, asks the model once to rewrite only those sentences, and replaces
// any dash that is left with a comma or a space.
//
// A dash inside a code span or a path is part of a name, not punctuation,
// and stays as it is. A fenced code block stays as it is.

const DASH = /[\u2013\u2014]/;
const DASHES = /[\u2013\u2014]/g;
// Characters that end a path token. A path keeps its own dashes.
const PATH = /[^\s`'"()<>[\],;]*[/\\][^\s`'"()<>[\],;]*/g;
const FENCE = /^\s*(```|~~~)/;
// A list marker or a heading marker opens a line but is not a sentence.
const LEAD = /^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)?/;

/** The [start, end) ranges of `line` that hold a code span or a path. */
function masked(line) {
  const out = [];
  for (const m of line.matchAll(/(`+)[^`]*?\1/g)) out.push([m.index, m.index + m[0].length]);
  for (const m of line.matchAll(PATH)) {
    // A sentence can end on a path: "read src/a.js." keeps the period out.
    const tok = m[0].replace(/[.,:;!?)]+$/, '');
    if (tok) out.push([m.index, m.index + tok.length]);
  }
  return out;
}

// True when `before` holds only an indent, a list marker or a heading marker.
const opensLine = (before) => !before.slice(LEAD.exec(before)[0].length).trim();

const inside = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);

/** The offsets in `line` of each dash that is punctuation. */
function punctuationDashes(line, ranges = masked(line)) {
  return [...line.matchAll(DASHES)].map((m) => m.index).filter((i) => !inside(ranges, i));
}

/* The sentences of one line, as [start, end) offsets. A sentence ends at
   ". ", "! " or "? " before a capital letter, a digit or a code span,
   outside a code span or a path. A paragraph is 1 line in a generated map;
   a hard wrapped paragraph gives its lines as separate pieces. */
function sentences(line, ranges) {
  const lead = LEAD.exec(line)[0].length;
  const out = [];
  let start = lead;
  const end = /[.!?]\s+(?=[A-Z0-9`"(])/g;
  end.lastIndex = lead;
  for (let m; (m = end.exec(line)); ) {
    if (inside(ranges, m.index)) continue;
    out.push([start, m.index + 1]);
    start = m.index + m[0].length;
  }
  if (start < line.trimEnd().length) out.push([start, line.trimEnd().length]);
  return out;
}

/**
 * Each sentence in `prose` that uses an em dash or an en dash as
 * punctuation, as { start, end, text } with offsets into `prose`.
 */
export function dashSentences(prose) {
  const out = [];
  let at = 0;
  let fenced = false;
  for (const line of String(prose).split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && DASH.test(line)) {
      const ranges = masked(line);
      const dashes = punctuationDashes(line, ranges);
      for (const [a, b] of sentences(line, ranges)) {
        if (dashes.some((i) => i >= a && i < b)) out.push({ start: at + a, end: at + b, text: line.slice(a, b) });
      }
    }
    at += line.length + 1;
  }
  return out;
}

/* The replacement for 1 dash, from the text on each side of it. An en dash
   between 2 digits is a range and reads "to". A dash that opens or ends a
   line, or stands before other punctuation, goes. A dash between 2 words
   with no space becomes a space, and so does a dash after a comma. Any
   other dash becomes a comma. */
function replacement(before, dash, after) {
  if (dash === '\u2013' && /\d$/.test(before) && /^\d/.test(after)) return ' to ';
  if (opensLine(before) || /^\s*([,;:.!?)]|$)/.test(after)) return '';
  if (!/\s$/.test(before) && !/^\s/.test(after)) return ' ';
  if (/[,;:.!?(]$/.test(before.trimEnd())) return ' ';
  return ', ';
}

/** `text` with each punctuation dash replaced, and the number replaced. */
export function replaceDashes(text) {
  let count = 0;
  let fenced = false;
  const lines = String(text).split('\n').map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return line;
    }
    if (fenced || !DASH.test(line)) return line;
    const ranges = masked(line);
    return line.replace(/[ \t]*([\u2013\u2014]+)[ \t]*/g, (all, dash, offset) => {
      const at = offset + all.indexOf(dash);
      if (inside(ranges, at)) return all;
      count += dash.length;
      const before = line.slice(0, at);
      const after = line.slice(at + dash.length);
      const r = replacement(before, dash[0], after);
      // The spaces around the dash are part of the match. A dash that opens
      // the line keeps the indent before it.
      if (r === '' && opensLine(before)) return all.slice(0, all.indexOf(dash));
      return r;
    });
  });
  return { text: lines.join('\n'), count };
}

/** The repair request for `items`, the sentences from dashSentences. */
export function repairPrompt(items) {
  return [
    'Each numbered sentence below is from a COMPLEX.md map. Each one uses an em dash or an en dash as punctuation.',
    'Rewrite each sentence without an em dash and without an en dash. Keep its meaning, its facts, its numbers, its paths and its code spans.',
    'Split a sentence in 2 when that reads better. Keep each rewrite on 1 line.',
    'Reply with the rewrites only, numbered as below, 1 per line, and nothing before or after them.',
    '',
    ...items.map((s, i) => `${i + 1}. ${s.text}`),
    '',
  ].join('\n');
}

const pathsIn = (text) => [...String(text).matchAll(PATH)].map((m) => m[0].replace(/[.,:;!?)]+$/, '')).filter(Boolean);

/* The rewrite for each item, or null where the reply gives no usable one.
   A rewrite is usable when it is on 1 line, has no punctuation dash, keeps
   every code span of the sentence it replaces and names no other path. */
export function parseRepair(reply, items) {
  const got = new Map();
  for (const line of String(reply || '').replace(/\r\n/g, '\n').replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').split('\n')) {
    const m = /^\s*(\d+)[.)]\s+(.+?)\s*$/.exec(line);
    if (m && !got.has(Number(m[1]))) got.set(Number(m[1]), m[2]);
  }
  return items.map((s, i) => {
    const r = got.get(i + 1);
    if (!r || punctuationDashes(r).length) return null;
    const spans = s.text.match(/(`+)[^`]*?\1/g) || [];
    const known = new Set(pathsIn(s.text));
    return spans.every((c) => r.includes(c)) && pathsIn(r).every((p) => known.has(p)) ? r : null;
  });
}

/**
 * `prose` with no punctuation dash. `ask(prompt)` makes the 1 repair call
 * and returns the reply text; without it, or when the call fails, each
 * dash is replaced. Returns { prose, sentences, repaired, replaced, error }.
 */
export async function removeDashes(prose, { ask = null } = {}) {
  const items = dashSentences(prose);
  if (!items.length) return { prose, sentences: 0, repaired: 0, replaced: 0, error: null };
  let rewrites = items.map(() => null);
  let error = null;
  if (ask) {
    try {
      rewrites = parseRepair(await ask(repairPrompt(items)), items);
    } catch (e) {
      error = String(e?.message || e);
    }
  }
  let out = prose;
  for (let i = items.length - 1; i >= 0; i--) {
    const s = items[i];
    out = out.slice(0, s.start) + (rewrites[i] ?? s.text) + out.slice(s.end);
  }
  // A sentence the repair did not fix, and any dash the split missed.
  const rest = replaceDashes(out);
  return { prose: rest.text, sentences: items.length, repaired: rewrites.filter(Boolean).length, replaced: rest.count, error };
}
