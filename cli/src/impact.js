// Consequence analysis: what changing a file costs, not that it is risky.
//
// Dempsey and Wrage (CMU SEI, DOI 10.58012/4c2e-xd64) divide the work four
// ways: the engineer "defines intent, assumptions, requirements, review
// criteria, and acceptable evidence"; the AI produces model text; the language
// server enforces the grammar; and the analyses "calculate consequences of the
// instantiated model under explicit analysis assumptions". This engine had the
// middle two. It ranked files and never said what changing one costs, and it
// never asked what the engineer considers acceptable.
//
// Their load bearing warning is about the row this module must not skip:
// "Without the first row, a clean and analyzable model can still answer the
// wrong question." So a consequence here is always reported against a bound
// the repository declared, and when no bound is declared the report says the
// number is unbounded rather than inventing a threshold. complex-md picks the
// ranking; it does not get to pick what is acceptable.
//
// Two further things taken from the same paper. A consequence DECOMPOSES:
// their latency analysis splits an end to end path "into device processing,
// connection delay, periodic sampling, thread processing, delayed
// communication, and queuing contributions", so "reaches 31 modules" is
// trivia and the contributions are the decision. And a result carries margin
// against its bound, which is what makes it actionable rather than
// descriptive.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { submodulePaths } from './graph.js';

/* Transitive importers, breadth first, with the depth each was reached at.
   Depth matters: a direct importer is a different kind of consequence from
   something six hops away, and collapsing them into one count is what makes
   a blast radius number unbelievable. Cycles terminate on `seen`. */
export function reach(fanIn, path, { maxDepth = 6 } = {}) {
  const seen = new Map([[path, 0]]);
  let frontier = [path];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const importer of fanIn.get(node) || []) {
        if (seen.has(importer)) continue;
        seen.set(importer, depth);
        next.push(importer);
      }
    }
    frontier = next;
  }
  seen.delete(path);
  return seen;
}

/* The declared bounds. This is Table 2's first row and it is the engineer's
   file, never generated: complex-md reads it and reports against it.

   .complex-md/bounds.json, all keys optional:
     { "reach": 25, "untested_reach": 5, "hot_reach": 3, "cross_boundary": 0 }

   A missing file is not a failure and not a default. It means no bound was
   declared, and every consequence is then reported as unbounded. Inventing a
   threshold here would be the tool answering a question the engineer was
   never asked. */
export const BOUNDS_PATH = '.complex-md/bounds.json';
export const BOUND_KEYS = ['reach', 'untested_reach', 'hot_reach', 'cross_boundary'];

export function loadBounds(cwd) {
  const p = join(cwd, BOUNDS_PATH);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    const out = {};
    for (const k of BOUND_KEYS) {
      if (typeof raw[k] === 'number' && Number.isFinite(raw[k]) && raw[k] >= 0) out[k] = raw[k];
    }
    return Object.keys(out).length ? out : null;
  } catch {
    /* A malformed bounds file must not silently become "no bounds", because
       that reads identically to a repository that never declared any. The
       caller surfaces this. */
    return { __invalid: true };
  }
}

/* One measured contribution against its bound. `bound` null means undeclared,
   which is reported as such and never as passing. */
function measure(name, value, contributors, bound) {
  const m = { name, value, contributors };
  if (bound === undefined || bound === null) {
    m.bound = null;
    m.status = 'unbounded';
    return m;
  }
  m.bound = bound;
  m.margin = bound - value;
  m.status = value > bound ? 'over' : 'within';
  return m;
}

/* The analysis for one path.
 *
 * `graph` supplies fanIn, tests and kinds. `map` is the parsed COMPLEX.md,
 * used only to know which reached files are themselves ranked. `boundaryOf`
 * maps a path to the unit it belongs to (a package, a workspace, a
 * submodule); when supplied, crossing one is its own contribution, which is
 * the cheapest early form of the cross repository question.
 */
export function analyse(path, { graph, map = null, bounds = null, boundaryOf = null, maxDepth = 6 } = {}) {
  const reached = reach(graph.fanIn, path, { maxDepth });
  const all = [...reached.keys()].sort();
  const direct = all.filter((f) => reached.get(f) === 1);

  const untested = all.filter((f) => !(graph.tests.get(f)?.size > 0));
  const hot = map ? all.filter((f) => !!map.row(f)) : [];
  const home = boundaryOf ? boundaryOf(path) : null;
  const crossing = boundaryOf ? all.filter((f) => boundaryOf(f) !== home) : [];

  const contributions = [
    measure('reach', all.length, all, bounds?.reach),
    measure('direct', direct.length, direct, undefined),
    measure('untested_reach', untested.length, untested, bounds?.untested_reach),
    measure('hot_reach', hot.length, hot, bounds?.hot_reach),
  ];
  if (boundaryOf) {
    contributions.push(measure('cross_boundary', crossing.length, crossing, bounds?.cross_boundary));
  }

  const over = contributions.filter((c) => c.status === 'over');
  return {
    path,
    covered: (graph.tests.get(path)?.size || 0) > 0,
    depth_of: Object.fromEntries(all.map((f) => [f, reached.get(f)])),
    contributions,
    /* `within` only when at least one bound was declared AND none is
       exceeded. A repository with no bounds is `unbounded`, which is a
       different answer from passing and must not be rendered as one. */
    status: contributions.every((c) => c.status === 'unbounded')
      ? 'unbounded'
      : over.length
        ? 'over'
        : 'within',
    over: over.map((c) => c.name),
  };
}

/* Plain text, for the CLI and the hooks. Deliberately states the bound or its
   absence on every line: a number without its bound is the trivia the paper
   warns about. */
export function formatImpact(a) {
  const out = [`${a.path}  ${a.covered ? 'covered by a test' : 'NOT covered by a test'}`];
  for (const c of a.contributions) {
    const head = `  ${c.name.padEnd(15)} ${String(c.value).padStart(4)}`;
    if (c.status === 'unbounded') {
      out.push(`${head}   (no bound declared)`);
    } else if (c.status === 'over') {
      out.push(`${head}   OVER bound ${c.bound} by ${-c.margin}`);
    } else {
      out.push(`${head}   within bound ${c.bound}, margin ${c.margin}`);
    }
  }
  if (a.status === 'unbounded') {
    out.push(`  no bounds declared; add ${BOUNDS_PATH} to say what is acceptable here`);
  }
  return out.join('\n');
}

/* Boundaries, the tractable half of the federated question.
 *
 * The concurrent engineering literature's problem is several teams working
 * simultaneously against one authoritative model. The codebase version starts
 * smaller and is already visible here: a repository that contains submodules,
 * or workspace packages, has internal boundaries that a single dependency
 * graph walks straight through without remark. Reaching twelve files inside
 * one package and reaching twelve files across four packages are different
 * consequences and were reported as the same number.
 *
 * What this does NOT do, and should not be read as doing: it does not analyse
 * ACROSS repositories. Pairing commits between a superproject and a submodule
 * needs a decision about what counts as one change (the submodule pointer
 * move is the likely answer) and that decision is not made here.
 */
export function boundariesFor(cwd, { workspaces = [] } = {}) {
  const subs = submodulePaths(cwd);
  const units = [...subs, ...workspaces]
    .map((p) => p.replace(/\/+$/, ''))
    .filter(Boolean)
    /* Longest first: sites/a/b must win over sites/a for a path inside it. */
    .sort((a, b) => b.length - a.length);
  if (!units.length) return null;
  return (path) => units.find((u) => path === u || path.startsWith(`${u}/`)) || '';
}
