// Structural importance by PageRank over the dependency graph.
//
// fan_in counts direct importers: one hop. A file imported by three modules
// that everything else imports matters more than one imported by three
// leaves, and fan_in cannot tell them apart. PageRank can. Importance flows
// along import edges, so a file is important in proportion to the importance
// of what depends on it.
//
// The approach is aider's repo map (Aider-AI/aider, aider/repomap.py,
// Apache 2.0, copyright Paul Gauthier), which ranks files by personalized
// PageRank over a graph of identifier references. Two things are taken from
// it: the choice of PageRank over a degree count, and its treatment of
// orphans by a self edge so a node with no out edges is not lost to the
// dangling mass. aider's graph is built from tree-sitter tags on identifiers
// and carries identifier level weights; this graph is the file level import
// graph this engine already resolves, so those weights do not apply. No code
// is copied; the implementation below is plain power iteration.

/** fanIn: Map<file, Set<importer>>. Returns Map<file, score>; scores sum to 1. */
export function pageRank(fanIn, { damping = 0.85, iterations = 60, tolerance = 1e-8 } = {}) {
  const nodes = new Set();
  for (const [to, froms] of fanIn) { nodes.add(to); for (const f of froms) nodes.add(f); }
  const n = nodes.size;
  if (!n) return new Map();

  // Out edges: importer -> imported. An importer's rank flows to what it imports.
  const out = new Map();
  for (const node of nodes) out.set(node, []);
  for (const [to, froms] of fanIn) for (const from of froms) out.get(from).push(to);
  for (const [node, targets] of out) if (!targets.length) targets.push(node); // self edge, as aider does

  let rank = new Map([...nodes].map((v) => [v, 1 / n]));
  for (let i = 0; i < iterations; i += 1) {
    const next = new Map([...nodes].map((v) => [v, (1 - damping) / n]));
    for (const [from, targets] of out) {
      const share = (damping * rank.get(from)) / targets.length;
      for (const to of targets) next.set(to, next.get(to) + share);
    }
    let delta = 0;
    for (const v of nodes) delta += Math.abs(next.get(v) - rank.get(v));
    rank = next;
    if (delta < tolerance) break;
  }
  return rank;
}

/** The same scores rescaled so the top file is 100: a column a person can read. */
export function rankScaled(fanIn, opts) {
  const r = pageRank(fanIn, opts);
  let max = 0;
  for (const v of r.values()) if (v > max) max = v;
  const out = new Map();
  for (const [k, v] of r) out.set(k, max ? Math.round((v / max) * 100) : 0);
  return out;
}
