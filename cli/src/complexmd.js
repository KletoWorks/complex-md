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
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm = parseFrontMatter(m[1]);
  const prose = m[2];
  const sections = splitSections(prose);
  const hotspotParas = paragraphs(sections['Why these files are hot'] || '');
  const couplingParas = paragraphs(sections['Change coupling'] || '');
  const paragraphFor = (path) => {
    const hits = hotspotParas.filter((para) => mentions(para, path));
    return hits.length ? hits[0] : null;
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

function mentions(para, path) {
  if (para.includes(path)) return true;
  const base = path.split('/').pop();
  return base.length > 6 && para.includes(base);
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
  const lines = src.split('\n');
  let i = 0;
  const scalar = (v) => {
    v = v.trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
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
    if (arr) return arr[1].split(',').map((s) => scalar(s));
    return scalar(v);
  }
}
