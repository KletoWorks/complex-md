// The site build: draft articles stay unpublished, and llms-full.txt carries
// the published text in one file. Runs only inside the repository checkout;
// the published CLI package has no scripts/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const content = () => import(pathToFileURL(join(ROOT, 'scripts/content.mjs')).href);

/** Build the site into a fresh folder, so this file never races the other
 *  build tests for dist/. */
function build(...args) {
  const out = mkdtempSync(join(tmpdir(), 'cx-site-'));
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', out, ...args], { stdio: 'pipe' });
  return out;
}

const article = (meta, body) => `<!-- meta\n${Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n')}\n-->\n\n${body}\n`;

test('readArticles leaves out a draft unless asked for drafts', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { readArticles } = await content();
  const dir = mkdtempSync(join(tmpdir(), 'cx-articles-'));
  writeFileSync(join(dir, 'live.md'), article({ title: 'Live', description: 'd', date: '2026-10-01' }, '# Live'));
  writeFileSync(join(dir, 'later.md'), article({ title: 'Later', description: 'd', date: '2026-10-02', draft: 'true' }, '# Later'));
  writeFileSync(join(dir, 'notes.txt'), 'not an article');
  assert.deepEqual(readArticles(dir).map((a) => a.slug), ['live']);
  const all = readArticles(dir, { drafts: true });
  assert.deepEqual(all.map((a) => [a.slug, a.draft]), [['later', true], ['live', false]], 'newest first, each marked');
  assert.deepEqual(readArticles(join(dir, 'missing')), []);
});

test('only draft: true marks a draft', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { isDraft } = await content();
  assert.equal(isDraft({ draft: 'true' }), true);
  for (const m of [{}, { draft: 'false' }, { draft: '' }]) assert.equal(isDraft(m), false, JSON.stringify(m));
});

test('faqItems reads each question and its answer as plain text', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { faqItems } = await content();
  const html = '<details class="faq-item"><summary>Is it <em>free</em>?</summary><p>Yes. Run <code>npx complex-md</code> &amp; read the <a href="/spec/">spec</a>.</p></details>';
  assert.deepEqual(faqItems(html), [{ q: 'Is it free?', a: 'Yes. Run `npx complex-md` & read the spec.' }]);
});

test('llmsFull puts each page under its own h1 with its URL, links made absolute', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { llmsFull } = await content();
  const text = llmsFull({
    origin: 'https://example.test', summary: 'S.',
    docs: [{ url: 'https://example.test/a/', body: '# Page A\n\nSee [the spec](/spec/).' }],
    faq: [{ q: 'Why?', a: 'Because.' }],
  });
  assert.match(text, /^# complex\.md\n\n> S\.\n/);
  assert.ok(text.includes('### Why?\n\nBecause.'));
  assert.ok(text.includes('# Page A\n\nSource: https://example.test/a/\n\nSee [the spec](https://example.test/spec/).'));
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'));
});

test('the build publishes no draft and lists none', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const out = build();
  const drafts = draftSlugs();
  const index = readFileSync(join(out, 'articles/index.html'), 'utf8');
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  for (const slug of drafts) {
    assert.ok(!existsSync(join(out, 'articles', slug)), `${slug} has no page`);
    assert.ok(!index.includes(`/articles/${slug}/`), `the index does not link ${slug}`);
    assert.ok(!sitemap.includes(`/articles/${slug}/`), `the sitemap does not list ${slug}`);
  }
});

test('--drafts renders a draft with noindex, still unlisted', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const dir = mkdtempSync(join(tmpdir(), 'cx-articles-'));
  writeFileSync(join(dir, 'hidden.md'), article({ title: 'Hidden', description: 'd', date: '2026-10-03', draft: 'true' }, '# Hidden\n\nSecret text.'));
  writeFileSync(join(dir, 'shown.md'), article({ title: 'Shown', description: 'd', date: '2026-10-02' }, '# Shown\n\nPublic text.'));
  const out = build('--drafts', '--articles', dir);
  const page = readFileSync(join(out, 'articles/hidden/index.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex">/, 'the draft asks not to be indexed');
  assert.doesNotMatch(readFileSync(join(out, 'articles/shown/index.html'), 'utf8'), /noindex/, 'a published article does not');
  assert.ok(!readFileSync(join(out, 'articles/index.html'), 'utf8').includes('/articles/hidden/'), 'the index does not link the draft');
  assert.ok(!readFileSync(join(out, 'sitemap.xml'), 'utf8').includes('/articles/hidden/'), 'the sitemap does not list the draft');
});

test('llms-full.txt carries the spec, the skill, the FAQ and every published article', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const out = build();
  const full = readFileSync(join(out, 'llms-full.txt'), 'utf8');
  assert.match(full, /^# complex\.md\n/);
  assert.ok(full.includes('# COMPLEX.md spec '), 'the spec');
  assert.ok(full.includes('# The complex-md skill'), 'the skill page');
  assert.ok(!full.includes('{{'), 'no placeholder is left');
  assert.ok(!full.includes('<!-- meta'), 'no front matter block is left');
  const home = readFileSync(join(ROOT, 'content/index.html'), 'utf8');
  for (const [, q] of home.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary>/g)) {
    assert.ok(full.includes(`### ${q.replace(/<[^>]+>/g, '')}`), `the FAQ question "${q}"`);
  }
  const drafts = new Set(draftSlugs());
  for (const f of readdirMd('content/articles')) {
    const title = /^title: (.*)$/m.exec(readFileSync(join(ROOT, 'content/articles', f), 'utf8'))[1];
    const slug = f.replace(/\.md$/, '');
    if (drafts.has(slug)) assert.ok(!full.includes(`https://complex.md/articles/${slug}/`), `draft ${slug} is left out`);
    else assert.ok(full.includes(`# ${title}`) && full.includes(`https://complex.md/articles/${slug}/`), `article ${slug}`);
  }
  assert.match(readFileSync(join(out, 'llms.txt'), 'utf8'), /\(https:\/\/complex\.md\/llms-full\.txt\)/, 'llms.txt links it');
});

test('a draft in a scratch content folder stays out of a real build', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  // Guards the build itself, whatever content/articles holds today.
  const dir = mkdtempSync(join(tmpdir(), 'cx-articles-'));
  writeFileSync(join(dir, 'hidden.md'), article({ title: 'Hidden', description: 'd', date: '2026-10-03', draft: 'true' }, '# Hidden\n\nSecret text.'));
  writeFileSync(join(dir, 'shown.md'), article({ title: 'Shown', description: 'd', date: '2026-10-02' }, '# Shown\n\nPublic text.'));
  const out = build('--articles', dir);
  assert.ok(existsSync(join(out, 'articles/shown/index.html')));
  assert.ok(!existsSync(join(out, 'articles/hidden')));
  const full = readFileSync(join(out, 'llms-full.txt'), 'utf8');
  assert.ok(full.includes('Public text.'));
  assert.ok(!full.includes('Secret text.'));
});

function readdirMd(d) {
  return existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.md')) : [];
}
function draftSlugs() {
  return readdirMd('content/articles')
    .filter((f) => /^draft:\s*true\s*$/m.test(readFileSync(join(ROOT, 'content/articles', f), 'utf8')))
    .map((f) => f.replace(/\.md$/, ''));
}
