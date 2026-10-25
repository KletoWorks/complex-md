// Read a COMPLEX.md: the front matter (our fixed shape, no YAML library
// needed) and the prose, indexed so a tool can hand an agent the paragraph
// for one file without re-reading the whole map.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function loadComplexMd(cwd) {
  const p = join(cwd, 'COMPLEX.md');
  if (!existsSync(p)) return null;
  return parseComplexMd(readFileSync(p, 'utf8'));
}

export function parseComplexMd(text) {
  text = normalizeNewlines(text);
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm = parseFrontMatter(m[1]);
  if (!Object.hasOwn(fm, 'complex_md')) return null;
  if (fm.complex_md === '0.3' && !Object.hasOwn(fm, 'generator') && typeof fm.tool === 'string') {
    const slash = fm.tool.indexOf('/');
    fm.generator = slash < 0
      ? { name: fm.tool }
      : { name: fm.tool.slice(0, slash), version: fm.tool.slice(slash + 1) };
    delete fm.tool;
  }
  /* A commit sha is a string even when every character is a digit. The
     scalar reader turns an all digit value into a Number, and a map whose
     sha happened to be 1234567 then failed every string comparison against
     HEAD and reported itself stale. A few percent of shas are all digits,
     which is exactly the rate at which a test with unpinned commit dates
     fails in CI and passes on the machine that wrote it. */
  if (fm.commit !== undefined && fm.commit !== null) fm.commit = String(fm.commit);
  const prose = m[2];
  const sections = splitSections(prose);
  const hotspotParas = paragraphs(sections['Why these files are hot'] || '');
  const couplingParas = paragraphs(sections['Change coupling'] || '');
  const mentions = mentionMatcher(fm);
  /* A file's own paragraph opens with its name; other paragraphs name it
     later, as a partner to keep in step. Taking the first paragraph that
     mentioned the path handed one file another file's directive. So a
     paragraph that names the full path beats one that names only a suffix,
     and within each kind the earliest mention wins. Ties keep map order. */
  const paragraphFor = (path) => {
    let best = null;
    let bestHit = null;
    for (const para of hotspotParas) {
      const hit = mentions(para, path);
      if (!hit) continue;
      const better = !bestHit
        || (hit.full && !bestHit.full)
        || (hit.full === bestHit.full && hit.at < bestHit.at);
      if (better) { best = para; bestHit = hit; }
    }
    return best;
  };
  const couplingFor = (path) => couplingParas.filter((para) => mentions(para, path));
  return {
    front: fm,
    hotspots: fm.hotspots || [],
    co_change: fm.co_change || [],
    sections,
    riskSummary: (sections['Where the risk lives'] || '').trim(),
    readFirst: (sections['What to read first'] || '').trim(),
    paragraphFor,
    couplingFor,
    partnersOf(path) {
      return (fm.co_change || [])
        .filter((c) => c.files.includes(path))
        .map((c) => ({ partner: c.files.find((f) => f !== path), count: c.count }));
    },
    load_bearing: fm.load_bearing || [],
    seams: fm.seams || [],
    row(path) {
      const hot = (fm.hotspots || []).find((h) => h.path === path);
      if (hot) return hot;
      const lb = (fm.load_bearing || []).find((h) => h.path === path);
      return lb ? { ...lb, churn: 0, fixes: 0, score: 0, load_bearing: true } : null;
    },
    directive(path) {
      const para = paragraphFor(path);
      if (!para) return null;
      const i = para.indexOf('Before editing this file,');
      return i >= 0 ? para.slice(i).trim() : lastSentence(para);
    },
  };
}

/* Where does a paragraph name this path? A paragraph names a path with the
   full path, or with a shorter suffix such as its basename. A suffix counts
   only when the path is in the map and no other mapped path ends with the
   same suffix. A monorepo maps several index.ts or __init__.py files, and a
   plain substring test gave every one of them the paragraph of the first. A
   name counts only with a boundary on each side, so src/index.ts is not
   found inside packages/a/src/index.ts. The search looks for the path itself
   rather than splitting prose into words, because route files carry
   brackets, parentheses and plus signs (app/[slug]/page.tsx). The matcher
   returns { full, at } for the earliest mention, or null. */
function mentionMatcher(fm) {
  const mapped = new Set([
    ...(fm.hotspots || []).map((h) => h.path),
    ...(fm.load_bearing || []).map((h) => h.path),
    ...(fm.co_change || []).flatMap((c) => c.files || []),
  ].filter((p) => typeof p === 'string'));
  const endsWith = (p, suffix) => p === suffix || p.endsWith('/' + suffix);
  const sharedSuffix = (path, suffix) => [...mapped].some((p) => p !== path && endsWith(p, suffix));
  return (para, path) => {
    const at = nameAt(para, path);
    if (at >= 0) return { full: true, at };
    if (!mapped.has(path)) return null;
    let best = -1;
    const parts = path.split('/');
    for (let k = 1; k < parts.length; k++) {
      const suffix = parts.slice(k).join('/');
      if (!suffix.includes('/') && suffix.length <= 6) continue;
      if (sharedSuffix(path, suffix)) continue;
      const i = nameAt(para, suffix);
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    return best >= 0 ? { full: false, at: best } : null;
  };
}

/* The index where para holds name with no path character joined to either
   end, or -1. A leading ./ is allowed, and so is a full stop that ends a
   sentence. */
function nameAt(para, name) {
  if (!name) return -1;
  for (let i = para.indexOf(name); i !== -1; i = para.indexOf(name, i + 1)) {
    let start = i;
    if (para.slice(i - 2, i) === './') start = i - 2;
    const before = para[start - 1];
    const end = i + name.length;
    const after = para[end];
    if (before !== undefined && /[\w@.\/+~$-]/.test(before)) continue;
    if (after !== undefined && /[\w@\/+~$-]/.test(after)) continue;
    if (after === '.' && /\w/.test(para[end + 1] || '')) continue;
    return start;
  }
  return -1;
}

/* A Windows checkout has CRLF line ends by default (core.autocrlf=true),
   and some editors write a byte order mark. Either one made the map parse
   to null, and every hook then went silent on that machine. */
function normalizeNewlines(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function lastSentence(para) {
  const s = para.trim().split(/(?<=\.)\s+/);
  return s[s.length - 1];
}

function splitSections(prose) {
  const out = {};
  let cur = null;
  for (const line of prose.split('\n')) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      cur = h[1].trim();
      out[cur] = '';
    } else if (cur !== null) {
      out[cur] += line + '\n';
    }
  }
  return out;
}

function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/** Minimal parser for the spec's front matter shape: scalars, `hotspots` list of maps, `co_change` list with inline arrays. */
export function parseFrontMatter(src) {
  const out = {};
  const lines = normalizeNewlines(src).split('\n');
  let i = 0;
  const scalar = (v) => {
    v = v.trim();
    /* frontMatter quotes with JSON.stringify, so a double quoted value is
       read back with JSON.parse: \" becomes " and \\ becomes \. An escape
       JSON lacks (YAML's \x41) keeps its backslash, and only \" and \\ are
       undone. A single quoted value doubles its quote, as YAML does. */
    if (/^".*"$/.test(v)) {
      try {
        return JSON.parse(v);
      } catch {
        return v.slice(1, -1).replace(/\\(["\\])/g, '$1');
      }
    }
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    /* An inline flow sequence. A generated map never writes one: every list
       it emits is a block. A HAND WRITTEN map does, and writing one by hand
       is a documented way to use this format, so `co_change: []` arriving as
       the two character string "[]" is a real defect and not a theoretical
       one. It crashed `wire` on the first end to end run of 0.7.0. */
    if (/^\[.*\]$/.test(v)) {
      return flowList(v.slice(1, -1));
    }
    return v;
  };
  /* A comma inside a double quoted item does not split it. Only a quote
     that opens an item starts a quoted scalar: spec 0.4 section 6.2 lets a
     plain scalar hold a quote after its first character, and frontMatter
     writes co_change paths unquoted, so lib/a"b.js is a plain path. */
  const flowList = (inner) => {
    if (!inner.trim()) return [];
    const items = [];
    let quoted = false;
    let escaped = false;
    let opening = true;
    let start = 0;
    for (let j = 0; j < inner.length; j++) {
      const c = inner[j];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === ',') {
        items.push(scalar(inner.slice(start, j)));
        start = j + 1;
        opening = true;
      } else if (opening && c === '"') {
        quoted = true;
        opening = false;
      } else if (c !== ' ') opening = false;
    }
    items.push(scalar(inner.slice(start)));
    return items;
  };
  while (i < lines.length) {
    const line = lines[i];
    const kv = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (!kv) {
      i++;
      continue;
    }
    const [, key, rest] = kv;
    if (rest.trim() !== '') {
      out[key] = scalar(rest);
      i++;
      continue;
    }
    // Block: a list of maps (hotspots, co_change), a list of strings
    // (blind_spots) or a nested map of scalars (profile). Decided by the
    // first indented line.
    i++;
    const block = [];
    while (i < lines.length && /^\s+\S/.test(lines[i])) block.push(lines[i++]);
    if (!block.length) { out[key] = []; continue; }
    if (/^\s+-\s+[\w]+:\s*/.test(block[0])) {
      const items = [];
      let item = null;
      for (const l of block) {
        const first = /^\s+-\s+([\w]+):\s*(.*)$/.exec(l);
        const cont = /^\s+([\w]+):\s*(.*)$/.exec(l);
        if (first) { item = {}; items.push(item); item[first[1]] = value(first[2]); }
        else if (cont && item) item[cont[1]] = value(cont[2]);
      }
      out[key] = items;
    } else if (/^\s+-\s/.test(block[0])) {
      out[key] = block.map((l) => scalar(l.replace(/^\s+-\s*/, '')));
    } else {
      const map = {};
      for (const l of block) {
        const kv2 = /^\s+([\w]+):\s*(.*)$/.exec(l);
        if (kv2) map[kv2[1]] = scalar(kv2[2]);
      }
      out[key] = map;
    }
  }
  return out;

  function value(v) {
    v = v.trim();
    const arr = /^\[(.*)\]$/.exec(v);
    if (arr) return flowList(arr[1]);
    return scalar(v);
  }
}
