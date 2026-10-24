// The repository paths a map's prose names, and the ones the repository
// does not have.
//
// A model that writes "Before editing this file, run test/route.test.js"
// for a repository with no such file sends every agent that reads the map
// to a dead end. The front matter is computed and cannot name a missing
// path; the prose is written by a model and can. This check runs on the
// prose before a reply is written to disk, and the model matrix scores
// every map with it.
//
// The rules are conservative in one direction: a token is judged only when
// it has the shape of a repository path, so "and/or", "Node.js" and an
// OpenRouter model slug pass. A false alarm costs a rejected reply; a
// missed invented path costs an agent's time on every read.

/* Files the tool itself writes or names; a map may tell an agent to
   regenerate them before they exist in a fresh checkout. */
const OWN_FILES = new Set(['COMPLEX.md', 'AGENTS.md', 'CLAUDE.md']);
const OWN_DIRS = ['.complex-md/'];

const EXT = /\.[A-Za-z][A-Za-z0-9]{0,7}$/;

function clean(raw) {
  let t = raw;
  // Wrapping punctuation, repeated: "(src/a.js)," and "src/a.js:".
  for (let i = 0; i < 4; i++) {
    t = t.replace(/^[(\["'“‘]+/, '').replace(/[)\]"'”’.,;:!?]+$/, '');
    t = t.replace(/['’]s$/, '');
    t = t.replace(/:\d+(:\d+)?$/, '');
  }
  // A route segment keeps its brackets: app/[slug]/page.tsx.
  if (/^\[/.test(raw) || /\/\[/.test(raw)) t = raw.replace(/[).,;:!?]+$/, '').replace(/^\(/, '');
  return t.replace(/^\.\//, '');
}

function skip(t) {
  return (
    !t ||
    t.includes('://') ||
    /^(https?:|mailto:|www\.)/i.test(t) ||
    /^[-/~$@#%=+]/.test(t) ||
    /[*{}=<>|\\]/.test(t) ||
    t.startsWith('../') ||
    t.split('/').some((s) => s === '..') ||
    /(^|\/)node_modules(\/|$)/.test(t)
  );
}

/**
 * Every token in `prose` with the shape of a repository path, in order of
 * first mention: `{ path, kind }`, where kind is "file" (a slash and an
 * extension), "dir" (a slash, no extension) or "name" (a bare file name in
 * backticks).
 */
export function namedPaths(prose) {
  const text = String(prose || '');
  const seen = new Map();
  const add = (path, kind) => {
    if (!seen.has(path)) seen.set(path, { path, kind });
  };
  for (const m of text.matchAll(/[^\s`'"<>,;|]+/g)) {
    const t = clean(m[0]);
    if (skip(t) || !t.includes('/')) continue;
    const segs = t.replace(/\/$/, '').split('/');
    if (segs.some((s) => !s)) continue;
    const last = segs[segs.length - 1];
    if (EXT.test(last) && !/^\d+(\.\d+)+$/.test(last)) add(t, 'file');
    else add(t.replace(/\/$/, ''), 'dir');
  }
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const t = clean(m[1]);
    if (skip(t) || t.includes('/')) continue;
    if (EXT.test(t) && !/^\d/.test(t)) add(t, 'name');
  }
  return [...seen.values()];
}

/**
 * The paths `prose` names that `files` (the repository's tracked paths)
 * does not hold. A path also matches a tracked path that ends with it on a
 * segment boundary, because the prose may shorten a path after its first
 * mention. A directory is judged only when its first segment is a top level
 * directory of the repository.
 */
export function inventedPaths(prose, files) {
  const fileSet = new Set(files);
  const dirs = new Set();
  const top = new Set();
  const basenames = new Set();
  for (const f of files) {
    const segs = f.split('/');
    basenames.add(segs[segs.length - 1]);
    if (segs.length > 1) top.add(segs[0]);
    for (let i = 1; i < segs.length; i++) dirs.add(segs.slice(0, i).join('/'));
  }
  const endsWith = (set, p) => {
    if (set.has(p)) return true;
    for (const x of set) if (x.endsWith('/' + p)) return true;
    return false;
  };
  const own = (p) => OWN_FILES.has(p) || OWN_DIRS.some((d) => p.startsWith(d) || p + '/' === d);
  const out = [];
  for (const { path, kind } of namedPaths(prose)) {
    if (own(path)) continue;
    if (kind === 'name') {
      if (!basenames.has(path)) out.push(path);
    } else if (kind === 'file') {
      if (!endsWith(fileSet, path) && !endsWith(dirs, path)) out.push(path);
    } else if (top.has(path.split('/')[0]) && !endsWith(dirs, path) && !endsWith(fileSet, path)) {
      out.push(path);
    }
  }
  return out;
}
