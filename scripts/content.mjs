// Content helpers for the site build: the meta block and draft articles.
// No file system writes here, so the tests can call each function on a
// scratch folder.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Split a content file into its `<!-- meta -->` keys and its body. */
export function parseMeta(src) {
  const m = /<!-- meta\n([\s\S]*?)-->/.exec(src);
  const meta = {};
  for (const line of (m?.[1] ?? '').trim().split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: src.replace(/<!-- meta\n[\s\S]*?-->\n*/, '') };
}

/** A draft has `draft: true` in its meta block. Any other value publishes. */
export const isDraft = (meta) => meta.draft === 'true';

/** The articles in `dir`, newest first. Drafts are left out unless
 *  `drafts` is set; each entry says whether it is one. */
export function readArticles(dir, { drafts = false } = {}) {
  if (!existsSync(dir)) return [];
  const list = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const { meta, body } = parseMeta(readFileSync(join(dir, file), 'utf8'));
    const draft = isDraft(meta);
    if (draft && !drafts) continue;
    list.push({ slug: file.replace(/\.md$/, ''), meta, body, draft });
  }
  return list.sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}
