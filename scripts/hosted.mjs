// Hosted map pages: one static page per mapped repository, built from the
// export's maps.json. hosted-pages.mjs is the command; this module holds the
// pure parts, so a test can call them without a file system.
//
// Everything in an entry comes from a stranger: the owner and the name, the
// file paths, and any text in the map. So the module checks identities
// against GitHub's own name rules, keeps only paths in a small character set,
// strips bidi and control characters from text, renders a fixed set of front
// matter fields and never any other, caps every list, and escapes all output
// through the report renderer. The image is drawn from a fixed font, so text
// in it can only be pixels. A page loads only files from its own origin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseComplexMd } from '../cli/src/complexmd.js';
import { reportParts, grepBlindFiles } from '../cli/src/render.js';
import { ROOT, ORIGIN, mark, siteHeader, siteFooter } from './chrome.mjs';
import { renderOgImage, OG_WIDTH, OG_HEIGHT } from './og-image.mjs';

export const RESERVED = new Set(JSON.parse(readFileSync(join(ROOT, 'site/reserved.json'), 'utf8')));

// Caps. A page with every list full stays near 100 kB.
export const LIMITS = { hotspots: 25, load_bearing: 10, co_change: 15, seams: 8, blind_spots: 12, blindFileList: 400, rawText: 262_144, page: 400_000 };

// The one line of the AGENTS.md section that agents act on, for a person who
// wires the map by hand.
export const AGENTS_LINE = 'Before editing a file listed under `hotspots` or `load_bearing` in COMPLEX.md, read its paragraph under "Why these files are hot" and do what its last sentence says.';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const code = (text) => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');

// GitHub's rules: an owner is 1 to 39 letters, digits or single hyphens,
// with no hyphen at either end; a repository name is 1 to 100 letters,
// digits, dots, hyphens or underscores, and never . or ..
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
export const validOwner = (s) => typeof s === 'string' && OWNER.test(s);
export const validName = (s) => typeof s === 'string' && NAME.test(s) && s !== '.' && s !== '..';

// Bidi controls, zero width characters, soft hyphens and C0 and C1 controls.
// Tab and newline survive and later collapse to a space.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g;

/** A path kept on a page: relative, at most 200 characters, no . or .. segment, safe characters only. */
const PATH_CHARS = /^[A-Za-z0-9._\-/@+~$()[\]=, ]+$/;
export function safePath(p) {
  if (typeof p !== 'string' || !p || p.length > 200 || !PATH_CHARS.test(p)) return false;
  return p.split('/').every((seg) => seg && seg !== '.' && seg !== '..' && seg.trim() === seg);
}

/** Text with invisible characters removed, whitespace collapsed and the length capped. */
export function cleanText(s, max) {
  let t = String(s ?? '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '\u2026';
  return t;
}

/**
 * Prose: clean text whose `code` spans hold only characters a path or a
 * command uses, with no word over 200 characters. Template prose never
 * holds < or >, so a paragraph that does is not template prose: it gives
 * null, and the page omits it.
 */
const CODE_CHARS = /^[A-Za-z0-9._\-/@+~$()[\]=,: *'"]{1,200}$/;
export function cleanProse(s, max) {
  const t = String(s ?? '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (/[<>]/.test(t)) return null;
  const spans = t.replace(/`([^`]*)`/g, (m, inner) => (CODE_CHARS.test(inner) ? m : 'a file with an unsafe name'));
  return cleanText(spans.replace(/\S{201,}/g, 'a long name'), max) || null;
}

const count = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1e9) : 0;
};
// A count the map does not give stays unknown, so the page omits it.
const known = (v) => (v === undefined || v === null || v === '' ? undefined : count(v));
const DATE = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const dateOf = (v) => (typeof v === 'string' && DATE.test(v) ? DATE.exec(v)[1] : null);

/** The front matter a page renders, rebuilt field by field from the parsed map. */
export function cleanFront(fm, { shortSha, date, tool }) {
  const prof = fm.profile && typeof fm.profile === 'object' && !Array.isArray(fm.profile) ? fm.profile : {};
  const rows = (list) => (Array.isArray(list) ? list : []).filter((r) => r && typeof r === 'object' && safePath(r.path));
  const hotspots = rows(fm.hotspots).slice(0, LIMITS.hotspots).map((r) => ({
    path: r.path, ...(r.loc === undefined ? {} : { loc: count(r.loc) }),
    churn: count(r.churn), fixes: count(r.fixes), fan_in: count(r.fan_in), tests: count(r.tests), score: count(r.score),
  }));
  const load_bearing = rows(fm.load_bearing).slice(0, LIMITS.load_bearing).map((r) => ({
    path: r.path, ...(r.loc === undefined ? {} : { loc: count(r.loc) }), fan_in: count(r.fan_in), tests: count(r.tests),
  }));
  const pairs = (list, key) => (Array.isArray(list) ? list : [])
    .filter((c) => c && Array.isArray(c[key]) && c[key].length >= 2 && safePath(c[key][0]) && safePath(c[key][1]))
    .map((c) => ({ [key]: [c[key][0], c[key][1]], count: count(c.count), coupling: count(c.coupling) }));
  const blind_spots = (Array.isArray(fm.blind_spots) ? fm.blind_spots : [])
    .filter((b) => typeof b === 'string')
    .map((b) => {
      const match = /^(.*NUL byte[^:]*:\s*)(.+?)(\.\s+Search with[\s\S]*)$/.exec(b);
      if (!match) return cleanText(b, 400);
      const named = grepBlindFiles([b]).filter(safePath);
      const kept = [];
      for (const path of named) {
        const next = [...kept, path].join(', ');
        if (next.length > LIMITS.blindFileList) break;
        kept.push(path);
      }
      if (!kept.length) return null;
      let head = cleanText(match[1], 260);
      if (!head.endsWith(':')) {
        const nulAt = match[1].lastIndexOf('NUL byte');
        const colonAt = match[1].indexOf(':', nulAt);
        const label = colonAt >= 0 ? cleanText(match[1].slice(nulAt, colonAt + 1), 40) : 'NUL byte:';
        const lead = cleanText(match[1].slice(0, nulAt), 260 - label.length - 1);
        head = `${lead}${lead ? ' ' : ''}${label}`;
      }
      const tail = cleanText(match[3], Math.max(0, 399 - head.length));
      return `${head} ${kept.join(', ')}${tail}`;
    })
    .filter(Boolean)
    .filter((b) => b && !/[<>]/.test(b))
    .slice(0, LIMITS.blind_spots);
  const confidence = typeof prof.confidence === 'string' && /^[a-z0-9+, -]{1,60}$/.test(prof.confidence) ? prof.confidence : undefined;
  return {
    commit: shortSha,
    generated: date,
    ...(tool ? { tool } : {}),
    window_commits: known(fm.window_commits),
    files_analyzed: known(fm.files_analyzed),
    profile: {
      commits_analyzed: known(prof.commits_analyzed ?? fm.window_commits),
      ...(dateOf(prof.window_from) && dateOf(prof.window_to) ? { window_from: dateOf(prof.window_from), window_to: dateOf(prof.window_to) } : {}),
      ...(confidence ? { confidence } : {}),
    },
    hotspots,
    load_bearing,
    co_change: pairs(fm.co_change, 'files').slice(0, LIMITS.co_change),
    seams: pairs(fm.seams, 'dirs').slice(0, LIMITS.seams),
    blind_spots,
  };
}

/**
 * Check one maps.json entry. Returns { page } with everything the page needs,
 * or { drop: reason }. reserved: the first path segments a page may not take.
 */
export function checkEntry(e, { reserved = RESERVED, committed = new Set() } = {}) {
  if (!e || typeof e !== 'object') return { drop: 'not an object' };
  const { owner, name } = e;
  if (!validOwner(owner) || !validName(name)) return { drop: 'owner or name breaks GitHub naming rules' };
  const key = `${owner}/${name}`.toLowerCase();
  if (e.repo_key !== key) return { drop: 'repo_key is not the lower case owner/name' };
  if (reserved.has(owner.toLowerCase())) return { drop: `owner "${owner.toLowerCase()}" is reserved in site/reserved.json` };
  if (committed.has(key)) return { drop: 'the repository is committed: it carries its own COMPLEX.md' };
  if (typeof e.commit_sha !== 'string' || !/^[0-9a-f]{40}$/.test(e.commit_sha)) return { drop: 'commit_sha is not 40 hex characters' };
  const date = dateOf(e.generated_at);
  if (!date) return { drop: 'generated_at is not an ISO date' };
  if (typeof e.raw_text !== 'string' || !e.raw_text) return { drop: 'raw_text is empty' };
  if (e.raw_text.length > LIMITS.rawText) return { drop: `raw_text is over ${LIMITS.rawText} characters` };
  let map;
  try {
    map = parseComplexMd(e.raw_text);
  } catch {
    map = null;
  }
  if (!map) return { drop: 'raw_text has no front matter' };
  if (String(map.front.hosted).toLowerCase() === 'false') return { drop: 'the map sets hosted: false' };
  const version = typeof e.tool === 'string' && /^complex-md\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]{1,20})?)$/.exec(e.tool)?.[1];
  return {
    page: {
      owner, name, key, date,
      sha: e.commit_sha,
      version: version || null,
      template: e.prose_source === 'template',
      indexable: e.indexable === true,
      raw: e.raw_text,
      map,
    },
  };
}

/** The map object the report renderer reads, with prose only when a template wrote it. */
function hostedMap(p) {
  const orig = p.map;
  const front = cleanFront(orig.front || {}, { shortSha: p.sha.slice(0, 7), date: p.date, tool: p.version ? `complex-md/${p.version}` : null });
  const prose = (fn, max) => (p.template ? (path) => { const t = fn(path); return t ? cleanProse(t, max) : null; } : () => null);
  return {
    front,
    riskSummary: (p.template && cleanProse(orig.riskSummary, 1500)) || '',
    readFirst: '',
    paragraphFor: prose(orig.paragraphFor, 1500),
    directive: prose(orig.directive, 600),
  };
}

/** The facts the page's Open Graph image shows, from the cleaned front matter: counts, two paths, a short sha and a date. */
function ogFacts(p) {
  const front = hostedMap(p).front;
  const top = front.co_change[0];
  return {
    name: `${p.owner}/${p.name}`,
    hotspots: front.hotspots.length,
    pair: top ? { files: top.files, coupling: Math.round(top.coupling) } : null,
    commit: p.sha.slice(0, 7),
    date: p.date,
  };
}

/** The PNG bytes of one page's Open Graph image, written at <owner>/<repo>/og.png. */
export function renderHostedOgImage(p) {
  return renderOgImage(ogFacts(p));
}

/** One hosted page as an HTML document. site: the origin the canonical links name. */
export function renderHostedPage(p, { site = ORIGIN } = {}) {
  const map = hostedMap(p);
  const parts = reportParts(map, { repo: `${p.owner}/${p.name}` });
  if (!p.template) {
    // The map has paragraphs; this page does not show them. Say where they are.
    parts.lede = '<p class="lede">This page shows the computed numbers. A template did not write this map\'s prose, so its paragraphs stay in the raw file.</p>';
    parts.directives = parts.directives.replaceAll('<p class="do none">The map gives no paragraph for this file.</p>', '<p class="do none">This file\'s paragraph is in the raw file.</p>');
  }
  const display = `${p.owner}/${p.name}`;
  const github = `https://github.com/${p.owner}/${p.name}`;
  const self = `${site}/${p.key}/`;
  const canonical = p.indexable ? self : github;
  const files = map.front.hotspots.length;
  const title = `${display}: COMPLEX.md map | complex.md`;
  const description = `Where edits break things in ${display}: ${files} ${files === 1 ? 'hot file' : 'hot files'}, the tests to run before editing them and the files that change together, computed from public git history.`;
  const imageUrl = `${self}og.png`;
  const imageAlt = `${display}: ${files} ${files === 1 ? 'hotspot' : 'hotspots'} in the COMPLEX.md map of commit ${p.sha.slice(0, 7)} on ${p.date}`;
  const short = p.sha.slice(0, 7);
  const tool = p.version ? `complex-md ${p.version}` : 'complex-md';
  const proseLine = p.template
    ? 'A template wrote the prose from the computed numbers.'
    : 'This page leaves out the map\'s prose, because a template did not write it. The numbers are as computed.';
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${p.indexable ? '' : '\n<meta name="robots" content="noindex">'}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(`${display}: COMPLEX.md map`)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="complex.md">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:width" content="${OG_WIDTH}">
<meta property="og:image:height" content="${OG_HEIGHT}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(imageUrl)}">
<meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="/platform.css">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/report.css">
<script src="/analytics.js" defer></script>
<script src="/site.js" defer></script>
<script src="/report.js" defer></script>
</head>
<body>
${siteHeader()}
<main class="full hosted">
<div class="cxr">
<header class="top">
<div class="inner">
<p class="eyebrow">${mark('mark', 20)}<span>COMPLEX.md map</span></p>
<h1>${esc(display)}</h1>
<p class="src"><a href="${esc(github)}">github.com/${esc(display)}</a></p>
${parts.facts}
${parts.lede}
</div>
</header>
<div class="inner">
${parts.directives}
<section id="commit" class="commit" aria-labelledby="h-commit">
<h2 id="h-commit">Maintain ${esc(display)}? Commit this file.</h2>
<p class="note">A committed COMPLEX.md reaches every coding agent that reads the repository, cloud agents included. Within 24 hours of the commit, this page gives way to a link to your file.</p>
<ol class="commit-steps">
<li><p>In a clone of the repository, run:</p>
<div class="install"><span class="p">$</span><code>npx complex-md</code></div>
<p>It computes the map from the repository's own history, writes COMPLEX.md at the root and adds a section to AGENTS.md.</p></li>
<li><p>Wiring it by hand instead? This line in AGENTS.md is the part agents act on:</p>
<div class="file-card"><div class="bar"><span class="fname">AGENTS.md</span></div><pre>${code(AGENTS_LINE)}</pre></div></li>
<li><p>Commit both files.</p></li>
</ol>
</section>
${parts.hotspots}
${parts.coupling}
${parts.blindSpots}
<footer class="prov">
<p>Generated by ${esc(tool)} from public git history at commit <code>${esc(short)}</code> on ${esc(p.date)}. ${proseLine}</p>
<p><a href="/${esc(p.key)}/COMPLEX.md">Raw COMPLEX.md</a> &middot; <a href="${esc(github)}">Repository on GitHub</a> &middot; <a href="/map/remove/?repo=${esc(p.key)}">Remove this page</a></p>
</footer>
</div>
</div>
</main>
${siteFooter()}
</body>
</html>
`;
}

/** The committed list: entries whose URL is the COMPLEX.md blob of the same repository on GitHub. */
export function checkCommitted(list) {
  const out = {};
  const dropped = [];
  for (const c of Array.isArray(list) ? list : []) {
    const m = c && typeof c.url === 'string' && /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/blob\/([A-Za-z0-9._\-/]{1,200})\/COMPLEX\.md$/.exec(c.url);
    const key = m && `${m[1]}/${m[2]}`.toLowerCase();
    if (!m || !validOwner(m[1]) || !validName(m[2]) || c.repo_key !== key || m[3].split('/').some((s) => !s || s === '.' || s === '..')) {
      dropped.push(String(c?.repo_key ?? '?').slice(0, 80));
      continue;
    }
    if (!(key in out)) out[key] = c.url;
  }
  return { committed: out, dropped };
}

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** sitemap-maps.xml: the indexable pages, sorted by path. */
export function sitemap(pages, site = ORIGIN) {
  const urls = pages.filter((p) => p.indexable).map((p) => `  <url><loc>${xml(`${site}/${p.key}/`)}</loc><lastmod>${xml(p.date)}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}${urls.length ? '\n' : ''}</urlset>\n`;
}

/** maps/index.json: what /map reads to decide where a repository goes. */
export function mapsIndex(pages, committed) {
  const sorted = Object.fromEntries(Object.keys(committed).sort().map((k) => [k, committed[k]]));
  return JSON.stringify({ maps: pages.map((p) => p.key), committed: sorted }) + '\n';
}

/** The origin the canonical links name: the input's site when it is a bare https origin. */
export function siteOf(v) {
  return typeof v === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/.test(v) ? v : ORIGIN;
}
