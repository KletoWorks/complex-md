// Content helpers for the site build: the meta block, draft articles, the
// FAQ as plain text and llms-full.txt. No file system writes here, so the
// tests can call each function on a scratch folder.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from './text.mjs';

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
    const { meta, body } = parseMeta(readText(join(dir, file)));
    const draft = isDraft(meta);
    if (draft && !drafts) continue;
    list.push({ slug: file.replace(/\.md$/, ''), meta, body, draft });
  }
  return list.sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", middot: '·', nbsp: ' ' };
const plain = (html) => html
  .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
  .replace(/<[^>]+>/g, '')
  .replace(/&([a-z]+|#\d+);/g, (all, e) => ENTITIES[e] ?? all)
  .replace(/\s+/g, ' ')
  .trim();

/** The home page FAQ as `{ q, a }` pairs of plain text, code kept in
 *  backticks. */
export function faqItems(html) {
  return [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p>/g)]
    .map(([, q, a]) => ({ q: plain(q), a: plain(a) }));
}

/** llms-full.txt: every published page's text in one markdown file, for an
 *  agent that wants the site without crawling it. `docs` holds
 *  `{ url, body }` entries whose bodies start with their own h1. */
export function llmsFull({ origin, summary, docs, faq }) {
  const parts = [`# complex.md\n\n> ${summary}\n\nThis file holds the full text of ${origin}: the spec, the skill page, the questions from the home page and every published article. The short index is ${origin}/llms.txt.`];
  if (faq.length) {
    parts.push(`# Questions\n\nSource: ${origin}/#faq\n\n${faq.map(({ q, a }) => `### ${q}\n\n${a}`).join('\n\n')}`);
  }
  for (const d of docs) {
    const body = d.body.trim();
    const nl = body.indexOf('\n');
    const [h1, rest] = nl === -1 ? [body, ''] : [body.slice(0, nl), body.slice(nl + 1).trim()];
    parts.push(`${h1}\n\nSource: ${d.url}${rest ? `\n\n${rest}` : ''}`);
  }
  // Site relative links mean nothing outside the site.
  return parts.join('\n\n---\n\n').replace(/\]\(\//g, `](${origin}/`) + '\n';
}
