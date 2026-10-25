// Keeps a bench map under the size the spec recommends: 8,192 bytes, front
// matter and prose together (spec 0.4, section 4). A producer that cannot
// fit SHOULD cut list rows from the end and shorten the prose, and that is
// what this does. The undici maps of the published runs were 10 to 12 KB,
// and the fastify maps 8 to 10 KB.

export const MAP_CAP = 8192;
const bytes = (s) => Buffer.byteLength(String(s), 'utf8');
const fmt = (n) => n.toLocaleString('en-US');

/* The rows a front matter list keeps at least, and about how many bytes
   one row of each list takes, which picks the list to cut next. */
const KEEP = { hotspots: 3, load_bearing: 0, co_change: 1, seams: 0 };
const ROW_BYTES = { hotspots: 260, load_bearing: 100, co_change: 90, seams: 80 };

/** A copy of `sig` whose front matter, as `render(sig)` writes it, fits `budget` bytes. Rows go from the end of the list that takes the most bytes. */
export function fitSignals(sig, render, budget) {
  const s = { ...sig };
  for (const k of Object.keys(KEEP)) s[k] = [...(sig[k] || [])];
  while (bytes(render(s)) > budget) {
    const lists = Object.keys(KEEP).filter((k) => s[k].length > KEEP[k]);
    if (!lists.length) break;
    const k = lists.reduce((a, b) => (s[b].length * ROW_BYTES[b] > s[a].length * ROW_BYTES[a] ? b : a));
    s[k].pop();
  }
  for (const k of Object.keys(KEEP)) if (!sig[k]) delete s[k];
  return s;
}

/* The bytes the prose may take: what the front matter leaves, less a
   margin, because a model misjudges its own length. `scale` lowers it on a
   retry after a reply that was too long. */
export function sizeNote(frontMatter, cap = MAP_CAP, scale = 0.85) {
  const proseBytes = Math.max(1000, Math.floor((cap - bytes(frontMatter) - 2) * scale));
  const words = Math.floor(proseBytes / 6.5);
  const note = ['', '## Size', '', `The whole file, front matter included, must fit in ${fmt(cap)} bytes. The front matter takes ${fmt(bytes(frontMatter))} bytes. Keep the prose after it to ${fmt(proseBytes)} bytes at most, about ${fmt(words)} words. To fit, write fewer and shorter hotspot paragraphs. Keep all four required sections. Describe only the files in the front matter lists.`, ''].join('\n');
  return { note, proseBytes };
}

/** The size of `text` in bytes. Throws when it is over `cap`; a cap of 0 turns the check off. */
export function assertFits(text, cap = MAP_CAP) {
  const n = bytes(text);
  if (cap > 0 && n > cap) throw new Error(`map is ${fmt(n)} bytes, over the ${fmt(cap)} byte cap`);
  return n;
}
