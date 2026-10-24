// Template prose: the four prose sections of COMPLEX.md written from the
// computed signals alone, for a run with no model. Each sentence states a
// number or a path that the analysis found, and nothing else, so the same
// commit gives the same bytes. A model or a maintainer can replace the prose
// later; the front matter marks it `prose: template` until then.
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const MAX_PARAGRAPHS = 5;
const MAX_PAIRS = 5;
const MAX_SEAMS = 3;
const MAX_READ_FIRST = 7;

const LANG = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', pyi: 'Python', go: 'Go', rb: 'Ruby', php: 'PHP', rs: 'Rust',
  java: 'Java', kt: 'Kotlin', cs: 'C#', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++',
  swift: 'Swift', sh: 'shell', bash: 'shell', zsh: 'shell', vue: 'Vue', svelte: 'Svelte',
  astro: 'Astro', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
};
const NOUN = { source: 'source file', config: 'configuration file', markup: 'markup file', style: 'stylesheet' };
const ENTRY_RE = /^(index|main|mod|lib|__init__|__main__)\.[a-z]+$/;

const code = (p) => `\`${p}\``;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
function list(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** At most `max` items, then "and N more" with the noun for the rest. */
function capped(items, max, noun) {
  if (items.length <= max) return list(items);
  return `${items.slice(0, max).join(', ')} and ${plural(items.length - max, `more ${noun}`, `more ${noun}s`)}`;
}

function article(phrase) {
  return /^([aeiou]|HTML|SCSS)/i.test(phrase) && !/^(Ruby|Rust|Python|Kotlin|Java)/.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

/** What a file is, from its kind and extension: "a JavaScript source file". */
function describe(row) {
  const lang = LANG[posix.extname(row.path).slice(1)];
  const noun = NOUN[row.kind] || 'file';
  return article(lang && row.kind !== 'config' && row.kind !== 'style' ? `${lang} ${noun}` : noun);
}

/* The package roots of a repository: the files a user of the package enters
   through. A regression in any file these reach can surface in any test, so
   such a file gets the full test suite rather than its direct tests. Read
   from each package.json (main, module, bin, exports), with an index file as
   the fallback when the declared entry is a build output; a Python package
   initializer at the top level or under src/; the root package of a Go
   module; and the Rust crate roots. Test fixtures and examples are skipped:
   their manifests describe no package of this repository. */
const SKIP_DIR_RE = /(^|\/)(node_modules|fixtures?|examples?|tests?|__tests__|specs?|vendor)\//;
const INDEX_FALLBACK = ['index.js', 'index.mjs', 'index.cjs', 'index.ts', 'src/index.js', 'src/index.mjs', 'src/index.ts', 'src/index.tsx', 'lib/index.js'];

export function packageRoots(root, kinds) {
  const roots = new Set();
  const has = (p) => kinds.has(p);
  for (const path of kinds.keys()) {
    if (posix.basename(path) !== 'package.json' || SKIP_DIR_RE.test(path)) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(root, path), 'utf8'));
    } catch {
      continue;
    }
    const dir = posix.dirname(path);
    const at = (rel) => posix.normalize(dir === '.' ? rel : posix.join(dir, rel)).replace(/^\.\//, '');
    const declared = [];
    for (const k of ['main', 'module']) if (typeof pkg[k] === 'string') declared.push(pkg[k]);
    if (typeof pkg.bin === 'string') declared.push(pkg.bin);
    else if (pkg.bin && typeof pkg.bin === 'object') declared.push(...Object.values(pkg.bin).filter((v) => typeof v === 'string'));
    const walk = (v) => {
      if (typeof v === 'string') { if (v.startsWith('./') && !v.includes('*')) declared.push(v); }
      else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
    };
    walk(pkg.exports);
    const found = declared.map(at).filter(has);
    if (!found.length) for (const f of INDEX_FALLBACK) if (has(at(f))) found.push(at(f));
    for (const f of found) roots.add(f);
  }
  for (const path of kinds.keys()) {
    if (SKIP_DIR_RE.test(path)) continue;
    if (/^(src\/)?[A-Za-z_][\w]*\/__init__\.py$/.test(path)) roots.add(path);
    if (/^src\/(lib|main)\.rs$/.test(path)) roots.add(path);
  }
  if (has('go.mod')) for (const path of kinds.keys()) if (/^[^/]+\.go$/.test(path) && !path.endsWith('_test.go')) roots.add(path);
  return [...roots].sort();
}

/** Every file reachable from `roots` along dependency edges (from -> Set of targets), the roots included. */
export function reachableFrom(roots, edges) {
  const seen = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    for (const next of edges.get(queue.shift()) || []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

function mappedPaths(sig) {
  return new Set([
    ...sig.hotspots.map((h) => h.path),
    ...(sig.load_bearing || []).map((h) => h.path),
    ...sig.co_change.flatMap((c) => c.files),
  ]);
}

function riskSection(sig) {
  const p = sig.profile;
  const out = [];
  if (/^(structure-only|size-only)/.test(p.confidence)) {
    out.push(`The ranking rests on size and dependents, because the analysis found ${plural(sig.commits_analyzed, 'commit')} of usable history.`);
  }
  if (sig.hotspots.length) {
    out.push(`Change risk concentrates in ${plural(sig.hotspots.length, 'hotspot')}: ${capped(sig.hotspots.map((h) => code(h.path)), 3, 'file')}.`);
  } else {
    out.push('No file ranks as a hotspot on this repository yet.');
  }
  const fixed = sig.table.filter((r) => r.fixes > 0).sort((a, b) => b.fixes - a.fixes).slice(0, 3);
  if (fixed.length) out.push(`Bug fixes landed most in ${list(fixed.map((r) => `${code(r.path)} (${plural(r.fixes, 'fix', 'fixes')})`))}.`);
  else if (sig.commits_analyzed) out.push('No analyzed commit carries a fix label.');
  const lb = sig.load_bearing || [];
  if (lb.length) {
    const named = lb.slice(0, 3);
    out.push(`No commit in the window changed ${list(named.map((h) => code(h.path)))}, and ${list(named.map((h) => String(h.fan_in)))} files depend on ${named.length === 1 ? 'it' : 'them'}.`);
  }
  if (p.authors_total > 1) {
    const owned = sig.hotspots.find((h) => h.churn >= 5 && h.owner_share >= 0.8);
    if (owned) out.push(`One committer made ${Math.round(owned.owner_share * 100)}% of the commits to ${code(owned.path)}.`);
  }
  const subs = sig.blind_spots.find((b) => /submodules? not analyzed/.test(b));
  if (subs) out.push(`The map does not cover the ${/^(\d+)/.exec(subs)[1]} git submodule${/^1 /.test(subs) ? '' : 's'}.`);
  const vendored = sig.blind_spots.find((b) => /vendored files excluded/.test(b));
  if (vendored) out.push(`The map does not cover the ${/^(\d+)/.exec(vendored)[1]} vendored files.`);
  out.push('A template wrote this prose from the computed numbers.');
  out.push('It states no design intent that the numbers cannot show.');
  return out.join(' ');
}

function hotParagraph(sig, h, { mapped, reachable, roots, testCommand }) {
  const s = [];
  s.push(`${code(h.path)} is ${describe(h)} of ${plural(h.loc, 'line')}.`);
  const base = posix.basename(h.path);
  if (roots.has(h.path)) s.push('It is a package root.');
  else if (ENTRY_RE.test(base)) s.push(`It is the entry module of ${posix.dirname(h.path) === '.' ? 'the repository root' : code(posix.dirname(h.path))}.`);
  if (h.churn > 0) {
    const fixes = h.fixes === 0 ? 'and none of them was a fix' : `and ${h.fixes} of them ${h.fixes === 1 ? 'was a fix' : 'were fixes'}`;
    s.push(`It changed in ${h.churn} of the last ${sig.window_commits} commits, ${fixes}.`);
  } else {
    s.push(`No commit in the last ${sig.window_commits} commits changed it.`);
  }
  const importers = (sig.importers[h.path] || []).filter((p) => !mapped.has(p));
  if (h.fan_in > 0) {
    const sample = importers.slice(0, 3).map(code);
    s.push(`${plural(h.fan_in, 'file')} ${h.fan_in === 1 ? 'depends' : 'depend'} on it${sample.length ? `, for example ${list(sample)}` : ''}.`);
  } else {
    s.push('No other file depends on it through an import or a path reference.');
  }
  const tests = (sig.tests[h.path] || []).map(code);
  if (tests.length) s.push(`${capped(tests, 3, 'test file')} ${tests.length === 1 ? 'covers' : 'cover'} it.`);
  else s.push('No test file reaches it.');
  const viaRoot = reachable.has(h.path);
  if (viaRoot && !roots.has(h.path)) s.push('The package root reaches it through imports, so a break here can surface in any test.');
  else if (viaRoot) s.push('A break here can surface in any test of the package.');
  s.push(directive({ viaRoot, tests, importers, fanIn: h.fan_in, testCommand }));
  return s.join(' ');
}

function directive({ viaRoot, tests, importers, fanIn, testCommand }) {
  const lead = 'Before editing this file,';
  if (viaRoot) return `${lead} run the full test suite${testCommand ? ` with ${code(testCommand)}` : ''}.`;
  if (tests.length) return `${lead} run ${list(tests.slice(0, 3))}.`;
  if (importers.length) return `${lead} open ${list(importers.slice(0, 2).map(code))} and check how ${importers.length === 1 ? 'it uses' : 'they use'} it, because no test covers it.`;
  if (fanIn > 0) return `${lead} open its ${plural(fanIn, 'importer')} and check each call site, because no test covers it.`;
  return `${lead} decide how you will verify the change, because no test covers it.`;
}

function couplingSection(sig) {
  const out = [];
  for (const c of sig.co_change.slice(0, MAX_PAIRS)) {
    const [a, b] = c.files.map(code);
    out.push(`${a} and ${b} changed together in ${plural(c.count, 'commit')}, with ${c.coupling}% coupling. When you change one of them, open the other and check whether it needs the same change.`);
  }
  for (const s of (sig.seams || []).slice(0, MAX_SEAMS)) {
    const [a, b] = s.dirs.map(code);
    out.push(`The areas ${a} and ${b} changed together in ${plural(s.count, 'commit')}, with ${s.coupling}% coupling. When you change a file in one area, check the other area for a matching change.`);
  }
  if (!out.length) return 'No file pair or directory pair changed together often enough to report.';
  out.unshift("Coupling is the share of the quieter file's commits that also changed the other file.");
  return out.join('\n\n');
}

function readFirstSection(sig) {
  const items = [];
  for (const h of (sig.load_bearing || []).slice(0, 2)) items.push(`${code(h.path)}: ${plural(h.fan_in, 'file')} ${h.fan_in === 1 ? 'depends' : 'depend'} on it, and no commit in the window changed it.`);
  sig.hotspots.slice(0, MAX_READ_FIRST - items.length).forEach((h, i) => {
    const what = i === 0 ? 'the top hotspot, with ' : '';
    items.push(`${code(h.path)}: ${what}${plural(h.fan_in, 'dependent')} and ${plural(h.fixes, 'fix', 'fixes')} in ${plural(h.churn, 'commit')}.`);
  });
  if (!items.length) return 'No file ranks as a hotspot or as load bearing yet.';
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

/**
 * The four prose sections, from the computed signals only.
 * `reachable`: files a package root reaches (see packageRoots); they get
 * the full test suite directive. `roots`: the package roots themselves.
 * `testCommand`: the repository's test command when one is known.
 */
export function templateProse(sig, { reachable = new Set(), roots = [], testCommand = null } = {}) {
  const ctx = { mapped: mappedPaths(sig), reachable, roots: new Set(roots), testCommand };
  const hot = sig.hotspots.slice(0, MAX_PARAGRAPHS).map((h) => hotParagraph(sig, h, ctx));
  return [
    '## Where the risk lives', '', riskSection(sig), '',
    '## Why these files are hot', '', hot.length ? hot.join('\n\n') : 'No file ranks as a hotspot on this repository yet.', '',
    '## Change coupling', '', couplingSection(sig), '',
    '## What to read first', '', readFirstSection(sig), '',
  ].join('\n');
}

/** One computed fact about the repository, as a plain sentence for the end of a run. */
export function repositoryFact(sig) {
  const fixed = [...(sig.table || [])].filter((r) => r.fixes > 0).sort((a, b) => b.fixes - a.fixes)[0];
  if (fixed && sig.fix_commits) return `${fixed.path} received ${fixed.fixes} of the ${plural(sig.fix_commits, 'fix commit')} in the last ${plural(sig.window_commits, 'commit')}.`;
  const pair = sig.co_change[0];
  if (pair) return `${pair.files[0]} and ${pair.files[1]} changed together in ${plural(pair.count, 'commit')}.`;
  const wide = [...(sig.table || []), ...(sig.load_bearing || [])].sort((a, b) => b.fan_in - a.fan_in || a.path.localeCompare(b.path))[0];
  if (wide && wide.fan_in > 0) return `${wide.path} has ${plural(wide.fan_in, 'dependent')}, the most of any file in the map.`;
  return `complex-md read ${plural(sig.files_analyzed, 'rankable file')} and ${plural(sig.window_commits, 'commit')}.`;
}
