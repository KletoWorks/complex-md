// The parts every complex.md page shares: the site constants, the versions
// the footer names, the header and the footer. build.mjs wraps the content
// pages in them, and hosted-pages.mjs wraps the hosted map pages, so both
// kinds of page carry the same navigation.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://complex.md';
export const AUTHOR = 'James L. Cowan Jr.';
export const AUTHOR_URL = 'https://jameslcowan.com';
export const REPO = 'https://github.com/KletoWorks/complex-md';

const MARK_PATH = readFileSync(join(ROOT, 'site/mark.path'), 'utf8').trim();
export const mark = (cls, size) => `<svg class="${cls}" viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg>`;
export const GH_MARK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

const genPrompt = readFileSync(join(ROOT, 'prompts/generate.md'), 'utf8');
export const promptVersion = /prompt_version:\s*([\d.]+)/.exec(genPrompt)?.[1] ?? '0.0.0';
export const specVersion = /spec_version:\s*"([\d.]+)"/.exec(genPrompt)?.[1] ?? '0.1';
export const cliVersion = JSON.parse(readFileSync(join(ROOT, 'cli/package.json'), 'utf8')).version;

export function siteHeader() {
  return `<header class="site-header">
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
</header>`;
}

export function siteFooter() {
  return `<footer class="site-footer">
<div class="inner">
${mark('mark foot-mark', 18)}
<small>&copy; 2026 <a href="${AUTHOR_URL}" rel="author">${AUTHOR}</a> &middot; MIT &middot; <a href="${REPO}">GitHub</a> &middot; <a href="https://www.npmjs.com/package/complex-md">npm</a></small>
<small class="vers">spec ${specVersion} &middot; prompt ${promptVersion} &middot; cli ${cliVersion}</small>
</div>
</footer>`;
}
