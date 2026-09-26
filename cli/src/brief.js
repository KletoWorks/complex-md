// The per path brief: what an agent needs about ONE file, at the moment it
// edits that file.
//
// Wiring used to write a single rule holding a flat list of every hot path,
// whose body said: go and read COMPLEX.md at the root and find the paragraph
// about this file. The trigger was local and the payload was central, so the
// agent received a redirect at exactly the moment it needed an answer.
//
// AGENTS.md is the counter example worth learning from. It spread because you
// find one in every folder and what it says is about where you are, with no
// lookup. The lesson is not nesting; nesting is how a hand written file
// achieves locality. The lesson is that context has to arrive at the path,
// already scoped, unasked. Hand written nesting also goes stale in silence,
// which a computed file does not have to.
//
// So: one brief per path, carrying that file's own numbers, its paragraph,
// its co-change partners and its directive. One rule file each, scoped to one
// path, rather than one rule listing them all. The distinction matters for
// cost as much as for ergonomics: a single file holding thirty briefs puts
// thirty paragraphs into context the moment any one of them is touched.

/* A path becomes a filename: separators and anything not portable collapse to
   a dash. Collisions are possible in principle (a/b.js and a-b.js) and are
   resolved by appending a short hash of the full path, so a brief is never
   silently overwritten by another file's. */
export function slugFor(path) {
  const flat = path.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  let h = 0;
  for (let i = 0; i < path.length; i += 1) h = (Math.imul(31, h) + path.charCodeAt(i)) | 0;
  return `${flat || 'path'}-${(h >>> 0).toString(36).slice(0, 6)}`;
}

/* The numbers, in the order the table uses, skipping what a row does not
   carry. Rendered on one line because a brief that scrolls is a brief that
   gets skimmed. */
function stats(row) {
  if (!row) return '';
  const parts = [];
  for (const k of ['churn', 'fixes', 'fan_in', 'tests', 'loc', 'score']) {
    if (row[k] !== undefined && row[k] !== null) parts.push(`${k} ${row[k]}`);
  }
  return parts.join('  ');
}

/* One brief. Returns null when the map has nothing to say about the path,
   so a caller never writes an empty rule. */
export function briefFor(map, path) {
  const row = map.row(path);
  const para = map.paragraphFor(path);
  const partners = (Array.isArray(map.co_change) ? map.co_change : [])
    .filter((c) => c.files.includes(path))
    .map((c) => ({ partner: c.files.find((f) => f !== path), coupling: c.coupling, count: c.count }))
    .filter((p) => p.partner)
    .sort((a, b) => b.coupling - a.coupling);
  if (!row && !para && !partners.length) return null;

  /* The lead says only what the map actually asserts about this path. A
     co-change partner that is not itself ranked is NOT a risky file and must
     not be introduced as one; it is a file that travels with another. */
  const lines = [`# ${path}`, ''];
  if (row?.load_bearing) {
    lines.push('Load bearing in COMPLEX.md: dependents rely on it and nobody changed it in the window.');
  } else if (row) {
    lines.push('Listed in COMPLEX.md as a file where edits are risky.');
  } else {
    lines.push('Not ranked in COMPLEX.md. It is here because it moves with a file that is.');
  }
  const s = stats(row);
  if (s) lines.push('', `    ${s}`);
  if (para) lines.push('', para.trim());

  if (partners.length) {
    lines.push('', 'Moves with:');
    for (const p of partners) {
      lines.push(`- ${p.partner} (${p.coupling}% of this file's commits, ${p.count} together)`);
    }
    lines.push('', 'Open the partner and say in the change description whether it needed a change too.');
  }

  /* The directive is the last sentence of the paragraph and is already in the
     text above. Repeating it as an imperative is deliberate: it is the one
     line that says what to DO, and it should be the last thing read. */
  const directive = map.directive(path);
  if (directive) lines.push('', `**${directive.replace(/\s+/g, ' ').trim()}**`);

  return `${lines.join('\n')}\n`;
}

/* Every path the map can brief, hot files and load bearing files alike,
   deduplicated and in a stable order so wiring output is reproducible. */
export function pathBriefs(map) {
  const seen = new Set();
  const paths = [];
  const list = (v) => (Array.isArray(v) ? v : []);
  for (const row of [...list(map.hotspots), ...list(map.load_bearing)]) {
    if (row?.path && !seen.has(row.path)) {
      seen.add(row.path);
      paths.push(row.path);
    }
  }
  /* A co-change partner is worth a brief even when it is not itself hot: it
     is the file the agent is most likely to forget. */
  for (const c of list(map.co_change)) {
    for (const f of list(c?.files)) {
      if (f && !seen.has(f)) {
        seen.add(f);
        paths.push(f);
      }
    }
  }
  paths.sort();
  const out = [];
  for (const path of paths) {
    const text = briefFor(map, path);
    if (text) out.push({ path, slug: slugFor(path), text });
  }
  return out;
}
