// Marked blocks. Text that complex-md writes into a file the user owns
// (AGENTS.md, CLAUDE.md, REVIEW.md, .gitattributes, a TOML config) sits
// between a begin and an end marker that name the tool and the spec
// version. Text outside the markers is never changed: a rewrite replaces
// the marked text only, and removal takes out the region plus the
// separator bytes that were added with it, so the file returns to the
// bytes it had before.
import { createHash } from 'node:crypto';

const STYLES = {
  html: (s) => `<!-- ${s} -->`,
  hash: (s) => `# ${s}`,
};

/** The two marker lines for a comment style ('html' or 'hash') and a spec version. */
export function markerLines(style, spec) {
  const wrap = STYLES[style];
  if (!wrap) throw new Error(`unknown marker style ${style}`);
  return { begin: wrap(`BEGIN complex-md (spec ${spec})`), end: wrap(`END complex-md (spec ${spec})`) };
}

/* Any spec version, either comment style, so a region written by an
   older version is found and replaced in place. */
const BEGIN_RE = /^[ \t]*(?:<!--|#) BEGIN complex-md \(spec [^)\r\n]*\)(?: -->)?[ \t]*\r?$/m;
const END_RE = /^[ \t]*(?:<!--|#) END complex-md \(spec [^)\r\n]*\)(?: -->)?[ \t]*\r?$/m;

/** The line ending a file uses: CRLF when its first line ends in one. */
export function eolOf(text) {
  const i = text.indexOf('\n');
  return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

/** sha256 of the text with CRLF read as LF, so a converting checkout is not an edit. */
export function normalizedHash(text) {
  return createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * The marked region in `text`: { start, end, body } where start is the
 * first byte of the begin line and end is the byte after the end line's
 * line ending. null when there is none; { broken: true } when a begin
 * marker has no end marker after it.
 */
export function findRegion(text) {
  const b = BEGIN_RE.exec(text);
  if (!b) return null;
  const afterBegin = b.index + b[0].length;
  END_RE.lastIndex = 0;
  const rest = text.slice(afterBegin);
  const e = END_RE.exec(rest);
  if (!e) return { broken: true };
  let end = afterBegin + e.index + e[0].length;
  if (text[end] === '\n') end += 1;
  return { start: b.index, end, text: text.slice(b.index, end) };
}

/** The text between the markers, LF line endings, or null. */
export function regionBody(text) {
  const r = findRegion(text);
  if (!r || r.broken) return null;
  const lines = r.text.replace(/\r\n/g, '\n').split('\n');
  return lines.slice(1, lines.length - 2).join('\n') + (lines.length > 3 ? '\n' : '');
}

/** The file's text with the region cut out, for tests on the user's own text. */
export function outsideRegion(text) {
  const r = findRegion(text);
  if (!r || r.broken) return text;
  return text.slice(0, r.start) + text.slice(r.end);
}

/** The whole region for `content`, in the file's line ending. */
export function renderRegion(content, { style, spec, eol = '\n' }) {
  const { begin, end } = markerLines(style, spec);
  const body = String(content).replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const lines = [begin, ...(body ? body.split('\n') : []), end];
  return lines.join(eol) + eol;
}

/* Where a region near the top goes: after any front matter, after a
   first level heading on the first line, and after the blank lines that
   follow it. Elsewhere at the very top. */
function topOffset(text, eol) {
  let k = 0;
  const lineEnd = (i) => {
    const n = text.indexOf('\n', i);
    return n < 0 ? text.length : n + 1;
  };
  if (text.startsWith('---\n') || text.startsWith('---\r\n')) {
    let i = lineEnd(0);
    while (i < text.length) {
      const next = lineEnd(i);
      if (/^---\r?\n?$/.test(text.slice(i, next))) {
        k = next;
        break;
      }
      i = next;
    }
  }
  if (text.startsWith('# ', k)) {
    k = lineEnd(k);
    while (k < text.length && text.startsWith(eol, k)) k += eol.length;
  }
  return k;
}

/**
 * Insert or replace the region. Returns { text, replaced, broken, before,
 * after }: `before` and `after` are the separator bytes added around a
 * new region, which removeRegion takes out again.
 */
export function upsertRegion(text, content, { place = 'end', style = 'html', spec }) {
  const eol = text.includes('\n') ? eolOf(text) : '\n';
  const found = findRegion(text);
  if (found?.broken) return { text, broken: true };
  const region = renderRegion(content, { style, spec, eol });
  if (found) {
    return { text: text.slice(0, found.start) + region + text.slice(found.end), replaced: true };
  }
  const k = place === 'top' ? topOffset(text, eol) : text.length;
  const pre = text.slice(0, k);
  let before = '';
  if (pre) before = pre.endsWith(eol + eol) ? '' : pre.endsWith(eol) ? eol : eol + eol;
  const after = k < text.length ? eol : '';
  return { text: pre + before + region + after + text.slice(k), replaced: false, before, after };
}

/**
 * Remove the region and the separators recorded when it was added, when
 * they are still where they were put. Returns { text, removed }.
 */
export function removeRegion(text, sep = {}) {
  const found = findRegion(text);
  if (!found || found.broken) return { text, removed: false };
  const eol = eolOf(text);
  /* The separators were recorded in the line ending the file had then. A
     checkout with core.autocrlf may have converted the file since, so they
     are read in the line ending it has now. */
  const before = (sep.before || '').replace(/\r?\n/g, eol);
  const after = (sep.after || '').replace(/\r?\n/g, eol);
  let s = found.start;
  let e = found.end;
  const pre = text.slice(0, s);
  if (before && pre.endsWith(before)) {
    const rest = pre.slice(0, pre.length - before.length);
    const sane = before === eol ? rest.endsWith(eol) : before === eol + eol ? rest !== '' && !rest.endsWith('\n') : true;
    if (sane) s -= before.length;
  }
  if (after && text.startsWith(after, e)) e += after.length;
  return { text: text.slice(0, s) + text.slice(e), removed: true };
}
