#!/usr/bin/env node
// Build the complex.md static site into dist/. Zero dependencies: a minimal
// markdown renderer plus a shared page shell. deploy-site.sh runs `npm run
// build` and rsyncs dist/ to the webroot, then fingerprints assets.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://complex.md';
const AUTHOR = 'James L. Cowan Jr.';
const AUTHOR_URL = 'https://jameslcowan.com';
const REPO = 'https://github.com/KletoWorks/complex-md';
const MARK_PATH = readFileSync(join(ROOT, 'site/mark.path'), 'utf8').trim();
const mark = (cls, size) => `<svg class="${cls}" viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg>`;
const GH_MARK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

// ---------------------------------------------------------------- versions
const genPrompt = readFileSync(join(ROOT, 'prompts/generate.md'), 'utf8');
const promptVersion = /prompt_version:\s*([\d.]+)/.exec(genPrompt)?.[1] ?? '0.0.0';
const specVersion = /spec_version:\s*"([\d.]+)"/.exec(genPrompt)?.[1] ?? '0.1';
// The wiring block has one source. The spec and the skill both carry it
// through {{INTEGRATION_BLOCK}}, so neither can drift from prompts/.
const integrationBlock = readFileSync(join(ROOT, 'prompts/integration.md'), 'utf8').trim();

// ---------------------------------------------------------- markdown (mini)
// Supports exactly what the content files use: h1-h3, paragraphs, fenced code,
// inline code, links, bold, tables, ordered and unordered lists, raw HTML
// passthrough for lines starting with '<'.
function inline(s) {
  return s
    .replace(/&(?![a-z]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function markdown(src) {
  const out = [];
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      const esc = buf.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      out.push(`<pre><code>${esc}</code></pre>`);
      continue;
    }
    if (/^<..*/.test(line)) { out.push(line); i++; continue; }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^\| /.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const head = cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('');
      const body = rows.slice(2).map((r) =>
        `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }
    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (/^[-*] /.test(lines[i]) || /^\d+\. /.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        if (/^ {2,}\S/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim();
        else items.push(lines[i].replace(/^([-*]|\d+\.) /, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('\n')}</${tag}>`);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|```|\||[-*] |\d+\. |<)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

// -------------------------------------------------------------- page shell
function articleJsonLd(m, canonical) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: m.title,
    description: m.description,
    datePublished: m.date,
    dateModified: m.updated || m.date,
    author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
    mainEntityOfPage: canonical,
  });
}

/** Document furniture for rendered markdown: a header block (h1, kicker or
 *  dateline, lede) and, when the page has four or more sections, an "On this
 *  page" list. Returns the body and whether a contents list was added. */
function docify(html, { kicker, dateline } = {}) {
  const meta = kicker ? `<p class="kicker">${kicker}</p>` : dateline ? `<p class="dateline">${dateline}</p>` : '';
  let out = html.replace(/^(<h1[^>]*>[\s\S]*?<\/h1>)\n?(<p>[\s\S]*?<\/p>)?/, (_, h1, lede = '') =>
    `<header class="doc-head">\n${h1}\n${meta}\n${lede}\n</header>`);
  const sections = [...out.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(([, id, t]) => ({ id, t: t.replace(/<[^>]+>/g, '') }));
  if (sections.length < 4) return { body: out, toc: false };
  const toc = `<nav class="toc-wrap" aria-label="On this page"><details class="toc"><summary>On this page</summary><ol>\n${sections
    .map((s) => `<li><a href="#${s.id}">${s.t}</a></li>`).join('\n')}\n</ol></details></nav>`;
  out = out.replace('</header>', '</header>\n' + toc);
  return { body: out, toc: true };
}

// Site-level identity for search engines and answer engines: the site, its
// author, and the org, stated once on every non-article page.
const siteJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'complex.md',
  url: ORIGIN,
  description: 'COMPLEX.md is a computed markdown file that tells a coding agent where the structural risk in a codebase lives.',
  author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
  license: 'https://opensource.org/license/mit/',
});

const cliVersion = JSON.parse(readFileSync(join(ROOT, 'cli/package.json'), 'utf8')).version;
// The compatibility marquee: monochrome marks in site/logos, listed in
// site/logos/agents.json, inlined so currentColor follows the theme. The
// track is doubled so the loop is seamless.
function agentMarquee() {
  const list = JSON.parse(readFileSync(join(ROOT, 'site/logos/agents.json'), 'utf8'));
  const items = list.map((a) => `<li>${readFileSync(join(ROOT, 'site/logos', a.slug + '.svg'), 'utf8').trim()}<span>${a.name}</span></li>`).join('');
  return `<div class="marquee" aria-label="Agents that read COMPLEX.md"><ul class="track">${items}</ul><ul class="track" aria-hidden="true">${items}</ul></div>`;
}
const softwareJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'complex-md',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows',
  softwareVersion: cliVersion,
  downloadUrl: 'https://www.npmjs.com/package/complex-md',
  codeRepository: REPO,
  license: 'https://opensource.org/license/mit/',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
  description: 'Generates COMPLEX.md, a computed map of where edits are risky and where bugs get fixed, and wires it into coding agents.',
});
/** FAQPage schema from the rendered FAQ items, so the answers on the page and the answers search engines quote are the same text. */
function faqJsonLd(html) {
  const items = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p>/g)].map(([, q, a]) => ({
    '@type': 'Question', name: q.replace(/<[^>]+>/g, '').trim(),
    acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() },
  }));
  return items.length ? JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items }) : null;
}
function techArticleJsonLd(title, description, canonical) {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'TechArticle', headline: title, description, url: canonical, author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL }, license: 'https://opensource.org/license/mit/', isPartOf: { '@type': 'WebSite', name: 'complex.md', url: ORIGIN } });
}

function shell({ title, description, path, body, article, layout, toc }) {
  const canonical = ORIGIN + (path === '/' ? '/' : path + '/');
  const blocks = article ? [articleJsonLd(article, canonical)] : [siteJsonLd];
  if (path === '/') { blocks.push(softwareJsonLd); const f = faqJsonLd(body); if (f) blocks.push(f); }
  if (path === '/spec' || path === '/skill') blocks.push(techArticleJsonLd(title, description, canonical));
  const jsonLd = blocks.map((b) => `\n<script type="application/ld+json">${b}</script>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="author" content="${AUTHOR}">
<link rel="canonical" href="${canonical}">
<link rel="author" href="${AUTHOR_URL}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:site_name" content="complex.md">
<meta property="og:image" content="${ORIGIN}/og.png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta property="og:image:alt" content="COMPLEX.md: a simple, open file that shows coding agents which parts of a codebase are most likely to break">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ORIGIN}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="/platform.css">
<link rel="stylesheet" href="/site.css">
<script src="/analytics.js" defer></script>
<script src="/site.js" defer></script>
${jsonLd}
</head>
<body>
<header class="site-header">
<nav>
<div class="brand-group">
<a class="brand-chip" href="/">complex.md</a>
<a class="dl-sq" href="/complex-md.skill.md" download="complex-md.skill.md" title="Download the complex-md skill" aria-label="Download the complex-md skill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m6 9 6 6 6-6"/><path d="M19 21H5"/></svg></a>
</div>
<a class="nav" href="/spec/">Spec</a>
<a class="nav" href="/skill/">Skill</a>
<a class="nav" href="/articles/">Articles</a>
<a class="gh-sq" href="${REPO}" title="Source on GitHub" aria-label="Source on GitHub">${GH_MARK}</a>
</nav>
</header>
<main class="${layout === 'full' ? 'full' : 'doc'}${toc ? ' has-toc' : ''}">
${body}
</main>
<footer class="site-footer">
<div class="inner">
${mark('mark foot-mark', 18)}
<small>&copy; 2026 <a href="${AUTHOR_URL}" rel="author">${AUTHOR}</a> &middot; MIT &middot; <a href="${REPO}">GitHub</a> &middot; <a href="https://www.npmjs.com/package/complex-md">npm</a></small>
<small class="vers">spec ${specVersion} &middot; prompt ${promptVersion} &middot; cli ${cliVersion}</small>
</div>
</footer>
</body>
</html>
`;
}

function meta(src) {
  const m = /<!-- meta\n([\s\S]*?)-->/.exec(src);
  const o = {};
  for (const line of (m?.[1] ?? '').trim().split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) o[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta: o, body: src.replace(/<!-- meta\n[\s\S]*?-->\n*/, '') };
}

function emit(path, html) {
  const dir = path === '/' ? DIST : join(DIST, path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

// -------------------------------------------------------------------- build
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Top level pages: .md rendered, .html wrapped as is.
for (const file of readdirSync(join(ROOT, 'content'))) {
  if (!/\.(md|html)$/.test(file)) continue;
  const { meta: m, body } = meta(readFileSync(join(ROOT, 'content', file), 'utf8').replaceAll('{{INTEGRATION_BLOCK}}', integrationBlock));
  const path = m.path ?? '/' + file.replace(/\.(md|html)$/, '');
  const kicker = m.kicker?.replaceAll('{{SPEC_VERSION}}', specVersion).replaceAll('{{PROMPT_VERSION}}', promptVersion);
  const doc = file.endsWith('.md') ? docify(markdown(body), { kicker }) : { body: body.replace('{{AGENT_MARQUEE}}', agentMarquee()), toc: false };
  emit(path, shell({ title: m.title, description: m.description, path, layout: m.layout, ...doc }));
  if (file === 'spec.md') writeFileSync(join(DIST, 'spec.md'), body);
}

// Articles: content/articles/<slug>.md -> /articles/<slug>/ plus the index.
const articles = [];
const artDir = join(ROOT, 'content/articles');
if (existsSync(artDir)) {
  for (const file of readdirSync(artDir)) {
    if (!file.endsWith('.md')) continue;
    const { meta: m, body } = meta(readFileSync(join(artDir, file), 'utf8'));
    const slug = file.replace(/\.md$/, '');
    const path = `/articles/${slug}`;
    const dateline = `<a href="${AUTHOR_URL}" rel="author">${AUTHOR}</a> &middot; <time datetime="${m.date}">${m.date}</time>`;
    emit(path, shell({
      title: `${m.title} | complex.md`, description: m.description, path,
      ...docify(markdown(body), { dateline }),
      article: m,
    }));
    articles.push({ slug, ...m });
  }
  articles.sort((a, b) => (a.date < b.date ? 1 : -1));
  const list = articles.map((a) =>
    `<li><a href="/articles/${a.slug}/">${a.title}</a><br><span class="dim">${a.description}</span> <time datetime="${a.date}">${a.date}</time></li>`).join('\n');
  emit('/articles', shell({
    title: 'Articles | complex.md',
    description: 'Writing on COMPLEX.md, hotspot analysis, and giving coding agents structural context.',
    path: '/articles',
    body: `<header class="doc-head">\n<h1>Articles</h1>\n<p class="kicker">By ${AUTHOR}</p>\n</header>\n<ul class="article-list">\n${list}\n</ul>`,
  }));
}

// The downloadable skill: template + the generation prompt + the canonical
// integration block, all verbatim from their single sources in prompts/.
const skill = readFileSync(join(ROOT, 'skill/SKILL.tmpl.md'), 'utf8')
  .replaceAll('{{PROMPT_VERSION}}', promptVersion)
  .replaceAll('{{SPEC_VERSION}}', specVersion)
  .replace('{{INTEGRATION_BLOCK}}', integrationBlock)
  .replace('{{GENERATE_PROMPT}}', genPrompt.replace(/^---[\s\S]*?---\n\n/, ''));
writeFileSync(join(DIST, 'complex-md.skill.md'), skill);
writeFileSync(join(DIST, 'integration.md'), integrationBlock + '\n');

// The CLI package ships the same two prompts; keep its copies in lockstep.
mkdirSync(join(ROOT, 'cli/prompts'), { recursive: true });
cpSync(join(ROOT, 'prompts/generate.md'), join(ROOT, 'cli/prompts/generate.md'));
cpSync(join(ROOT, 'prompts/integration.md'), join(ROOT, 'cli/prompts/integration.md'));

for (const f of ['site.css', 'site.js', '404.html', 'favicon.svg', 'logo.svg', 'og.png', 'sw.js', 'robots.txt']) cpSync(join(ROOT, 'site', f), join(DIST, f));
for (const d of ['fonts', 'icons']) cpSync(join(ROOT, 'site', d), join(DIST, d), { recursive: true });

// Sitemap: every rendered page, articles included.
const pages = ['/', '/spec/', '/skill/', '/articles/', ...articles.map((a) => `/articles/${a.slug}/`)];
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`);

// Dual-audience mirror (RESEARCH.md principle 7): tell agents where the raw
// markdown lives.
writeFileSync(join(DIST, 'llms.txt'), `# complex.md

> COMPLEX.md is a markdown file at the root of a repository, computed from git
> history, that tells a coding agent where the structural risk in a codebase
> lives. Spec ${specVersion}.

- [The spec (raw markdown)](${ORIGIN}/spec.md)
- [The skill: generate COMPLEX.md with any coding agent](${ORIGIN}/complex-md.skill.md)
- [Articles](${ORIGIN}/articles/)
`);

console.log(`built dist/ (spec ${specVersion}, prompt ${promptVersion}, ${articles.length} articles)`);
