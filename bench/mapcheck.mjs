// Deterministic checks on one model written COMPLEX.md. No model judges a
// model here: every check is a string rule taken from prompts/generate.md,
// so two runs on the same reply give the same result.
//
//   front_matter  the reply's front matter is byte identical to the computed one
//   sections      the four required sections are present
//   paths         every repository path the prose names exists
//   directives    each hot file the bundle showed has a paragraph under
//                 "Why these files are hot" that ends with exactly one
//                 sentence starting "Before editing this file,"
//   sentences     a description has 25 words at most, an instruction 20
//   em_dashes     no em dash in the prose
//
// Limits: the sentence splitter knows no abbreviations, so "e.g. the" splits
// in two and makes two short sentences, never a long one. An instruction is
// a sentence that starts with "Before editing this file," or with a verb on
// the IMPERATIVES list; any other sentence gets the description limit.
import { normalizeOutput, validateOutput } from '../cli/src/generate.js';
import { inventedPaths } from '../cli/src/paths.js';

export const CHECKS = ['front_matter', 'sections', 'paths', 'directives', 'sentences', 'em_dashes'];
export const DIRECTIVE = 'Before editing this file,';
export const LIMITS = { description: 25, instruction: 20 };
const IMPERATIVES = new Set('add avoid build check compare confirm edit find fix grep inspect install keep open preserve read regenerate remove rename replace review run search treat update verify write'.split(' '));

/** Split a reply into its front matter block (or null) and its prose. */
export function splitReply(reply) {
  let t = String(reply || '').replace(/\r\n/g, '\n').trim();
  const fence = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/.exec(t);
  if (fence) t = fence[1].trim();
  const m = /^---\n[\s\S]*?\n---\n/.exec(t + '\n');
  return m ? { fm: m[0], prose: (t + '\n').slice(m[0].length).trim() } : { fm: null, prose: t };
}

function section(prose, heading) {
  const lines = prose.split('\n');
  const i = lines.findIndex((l) => l.trim() === heading);
  if (i < 0) return '';
  const j = lines.findIndex((l, k) => k > i && /^## /.test(l));
  return lines.slice(i + 1, j < 0 ? lines.length : j).join('\n');
}

/** Paragraphs and list items of prose, code blocks and headings removed. */
function blocks(prose) {
  const out = [];
  let cur = [];
  let inCode = false;
  const flush = () => {
    if (cur.length) out.push(cur.join(' ').trim());
    cur = [];
  };
  for (const line of prose.split('\n')) {
    if (/^\s*```/.test(line)) {
      flush();
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (!line.trim() || /^#/.test(line)) {
      flush();
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      cur.push(line.replace(/^\s*([-*]|\d+\.)\s+/, ''));
      continue;
    }
    cur.push(line.trim());
  }
  flush();
  return out.filter(Boolean);
}

/** Sentences of one block. An inline code span counts as one word. */
export function sentences(block) {
  const flat = block.replace(/`[^`]*`/g, 'CODE');
  // A sentence may start with a lowercase path ("src/a.js reads it.") or
  // a camelCase or snake_case identifier ("isOurs matches it.").
  return flat.split(/(?<=[.!?])\s+(?=[A-Z0-9"(]|[\w-]+[/.]\w|[a-z]+[A-Z_]\w*)/).map((s) => s.trim()).filter(Boolean);
}

const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const isInstruction = (s) => s.startsWith(DIRECTIVE) || IMPERATIVES.has(s.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ''));

function firstDiff(a, b) {
  const x = a.split('\n');
  const y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `line ${i + 1}: expected ${JSON.stringify(y[i] ?? '')}, got ${JSON.stringify(x[i] ?? '')}`;
  return 'identical';
}

const result = (pass, detail = '') => ({ pass, detail });

/**
 * Score one reply. `fm` is the computed front matter, `files` the tracked
 * paths of the repository, `hot` the hot files whose text the bundle showed
 * (at most 5 are expected to get a paragraph).
 */
export function scoreMap({ reply, fm, files, hot }) {
  const { fm: got, prose } = splitReply(reply);
  const out = {};

  // A rescore of an old results.json may have no computed front matter to
  // compare with; the check then fails and the other checks still run.
  if (typeof fm !== 'string') out.front_matter = result(false, 'no computed front matter to compare with');
  else out.front_matter = got === null ? result(false, 'no front matter block') : got === fm ? result(true) : result(false, firstDiff(got, fm));

  const missing = validateOutput(prose);
  out.sections = missing.length ? result(false, `missing ${missing.join(', ')}`) : result(true);

  const bad = inventedPaths(prose, files);
  out.paths = bad.length ? result(false, `${bad.length} not in the repository: ${bad.slice(0, 5).join(', ')}`) : result(true);

  const paras = blocks(section(prose, '## Why these files are hot'));
  const faults = [];
  for (const path of hot.slice(0, 5)) {
    // The file's own paragraph names it first; another paragraph may name
    // it later as a dependent.
    const para = paras.filter((p) => p.includes(path)).sort((a, b) => a.indexOf(path) - b.indexOf(path))[0];
    if (!para) {
      faults.push(`${path}: no paragraph`);
      continue;
    }
    const ss = sentences(para);
    const n = ss.filter((s) => s.startsWith(DIRECTIVE)).length;
    if (n !== 1) faults.push(`${path}: ${n} directive sentences`);
    else if (!ss[ss.length - 1].startsWith(DIRECTIVE)) faults.push(`${path}: the directive is not the last sentence`);
  }
  out.directives = faults.length ? result(false, faults.join('; ')) : result(true);

  const over = [];
  for (const b of blocks(prose)) {
    for (const s of sentences(b)) {
      const kind = isInstruction(s) ? 'instruction' : 'description';
      const n = words(s);
      if (n > LIMITS[kind]) over.push(`${kind} of ${n} words: "${s.slice(0, 60)}..."`);
    }
  }
  out.sentences = over.length ? result(false, `${over.length} over the limit; first: ${over[0]}`) : result(true);

  const dashes = (prose.match(/—/g) || []).length;
  out.em_dashes = dashes ? result(false, `${dashes} em dash${dashes === 1 ? '' : 'es'}`) : result(true);

  return out;
}

/**
 * Score the file the CLI would write, using its own front-matter replacement
 * and validation. A reply the CLI refuses fails every check. `paths`, when
 * given, replaces the path check of a written file: a rescore passes the
 * saved one when the results hold no file list.
 */
export function scoreWrittenMap(input, { paths = null } = {}) {
  let written;
  try {
    written = normalizeOutput(input.reply, input.fm);
  } catch (e) {
    return Object.fromEntries(CHECKS.map((check) => [check, result(false, `not written: ${e.message}`)]));
  }
  const out = scoreMap({ ...input, reply: written });
  if (paths) out.paths = paths;
  return out;
}
