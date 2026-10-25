// Check a COMPLEX.md against the spec 0.4 draft: the JSON Schema for the front
// matter, then the MUST rules that the schema cannot express. Findings carry
// the rule codes of spec/0.4/fixtures/README.md, plus path-relative and
// path-missing. A map over the size cap is a warning, not an error.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontMatter } from './complexmd.js';
import { loadSchema, validate } from './schema.js';

export const SIZE_CAP = 8192;
const REQUIRED_SECTIONS = ['Where the risk lives', 'Why these files are hot', 'Change coupling', 'What to read first'];
const DIRECTIVE = 'Before editing this file,';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function sectionText(lines, heading) {
  const i = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).trimEnd() === heading);
  if (i < 0) return null;
  const rest = lines.slice(i + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

const paragraphsOf = (text) => text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

/* The reason a path breaks spec section 7.8, or null. */
export function pathProblem(p) {
  if (typeof p !== 'string' || !p) return null;
  if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\')) return 'is absolute, and a path is relative to the repository root';
  if (p.includes('\\')) return 'uses a backslash, and a path uses / between segments';
  if (p.startsWith('./')) return 'starts with ./';
  if (p.split('/').includes('..')) return 'has a .. segment';
  if (p.endsWith('/')) return 'ends with /';
  return null;
}

/* Every path value in the front matter, with the JSON pointer it sits at. */
function listedPaths(front) {
  const out = [];
  const rows = (key, field) => {
    if (!Array.isArray(front[key])) return;
    front[key].forEach((r, i) => {
      if (!isObject(r)) return;
      if (field === 'path') out.push([`/${key}/${i}/path`, r.path]);
      else if (Array.isArray(r[field])) r[field].forEach((p, j) => out.push([`/${key}/${i}/${field}/${j}`, p]));
      if (Array.isArray(r.test_files)) r.test_files.forEach((p, j) => out.push([`/${key}/${i}/test_files/${j}`, p]));
    });
  };
  rows('hotspots', 'path');
  rows('load_bearing', 'path');
  rows('co_change', 'files');
  rows('seams', 'dirs');
  rows('workspaces', 'path');
  return out;
}

/**
 * Lint the bytes of a map. `root` is the repository root that listed paths are
 * resolved against; null skips the check that they exist.
 * Returns { ok, errors, warnings }, each finding { line, rule, message }.
 */
export function lintMap(bytes, { root = null, exists = existsSync } = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, rule, message) => errors.push({ line, rule, message });
  const raw = Buffer.from(bytes).toString('utf8');
  const hasBom = raw.startsWith('\uFEFF');
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lineOf = (needle) => {
    const i = text.split('\n').findIndex((l) => l.includes(needle));
    return i < 0 ? 1 : i + 1;
  };
  const finish = () => ({ ok: errors.length === 0, errors, warnings });

  if (hasBom) err(1, 'bom', 'the file starts with a byte order mark');
  if (Buffer.byteLength(raw) > SIZE_CAP) warnings.push({ line: 1, rule: 'size', message: `the file is ${Buffer.byteLength(raw)} bytes; a map SHOULD NOT be larger than ${SIZE_CAP}` });

  const m = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(text);
  if (!m) { err(1, 'no-front-matter', 'the file has no front matter, or the front matter has no closing --- line'); return finish(); }
  /* The schema checks the data as written. parseComplexMd is the wrong
     input: it turns a numeric commit into a string, and its prose index
     throws on a list key whose value is not a list. */
  const front = parseFrontMatter(m[1]);

  if (!('complex_md' in front)) { err(2, 'no-version', 'the front matter has no complex_md key'); return finish(); }
  if (front.complex_md !== '0.4') {
    err(lineOf('complex_md'), 'version', `complex_md is ${JSON.stringify(front.complex_md)}; lint checks version 0.4`);
    return finish();
  }

  /* Path rules first, so the schema's own path pattern does not report a
     path that already has a finding. */
  const flagged = new Set();
  for (const [pointer, p] of listedPaths(front)) {
    if (typeof p !== 'string') continue;
    const problem = pathProblem(p);
    if (problem) { flagged.add(pointer); err(lineOf(p), 'path-relative', `${JSON.stringify(p)} ${problem}`); }
    else if (root && !exists(join(root, p))) err(lineOf(p), 'path-missing', `${JSON.stringify(p)} does not exist in the working tree`);
  }

  for (const msg of validate(loadSchema(), front)) {
    const pointer = msg.slice(0, msg.indexOf(': '));
    if (flagged.has(pointer)) continue;
    const key = pointer.split('/')[1];
    err(key ? lineOf(`${key}:`) : 1, 'schema', msg.startsWith(': ') ? msg.slice(2) : msg);
  }

  /* The reader turns a list key with no value into [], as section 10.3
     requires of a reader. The schema checks the data as written, where the
     key is null, so a linter reports it from the text. */
  for (const key of ['hotspots', 'load_bearing', 'co_change', 'seams', 'blind_spots', 'workspaces']) {
    const at = m[1].split('\n').findIndex((l, i, all) => l === `${key}:` && !/^\s/.test(all[i + 1] ?? 'x'));
    if (at >= 0 && !errors.some((e) => e.rule === 'schema' && e.message.startsWith(`/${key}`))) err(lineOf(`${key}:`), 'schema', `/${key}: expected array, got null`);
  }

  const lines = m[2].split('\n');
  const found = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trimEnd()).filter((h) => REQUIRED_SECTIONS.includes(h));
  if (found.join('|') !== REQUIRED_SECTIONS.join('|')) err(lineOf('## '), 'sections', `the required sections, in order, are: ${REQUIRED_SECTIONS.join('; ')}`);
  const hot = sectionText(lines, 'Why these files are hot');
  if (hot !== null) {
    for (const p of paragraphsOf(hot)) {
      if (!p.includes(DIRECTIVE)) err(lineOf(p.split(' ').slice(0, 3).join(' ')), 'directive', `a paragraph in "Why these files are hot" has no "${DIRECTIVE}" sentence: ${p.slice(0, 50)}`);
    }
  }
  return finish();
}

export function lintFile(file, opts = {}) {
  if (!existsSync(file)) return { ok: false, errors: [{ line: 0, rule: 'no-file', message: `${file} does not exist` }], warnings: [] };
  return lintMap(readFileSync(file), opts);
}

export function formatLint(file, r) {
  return [...r.errors.map((f) => ({ ...f, level: 'error' })), ...r.warnings.map((f) => ({ ...f, level: 'warning' }))]
    .map((f) => `${file}:${f.line}: ${f.rule}: ${f.message}`)
    .join('\n');
}
