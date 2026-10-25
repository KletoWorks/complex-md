// Render a parsed COMPLEX.md (the object parseComplexMd returns) as one self
// contained HTML page: a treemap of the hotspots, the directive for each hot
// file, the co-change partners and the blind spots. reportParts gives the
// same sections one by one, for a page that composes them in its own order.
//
// The function is pure. It reads no file, no clock and no environment, so
// the same map and options give the same bytes, and a server can call it for
// a hosted page as safely as the CLI calls it for a local one. Every string
// that came from the repository is escaped before it reaches the markup: on a
// hosted page a file name is input from a stranger. The page loads nothing
// over the network, and its Content-Security-Policy says so to the browser.
// The markup carries no style attribute: the treemap is SVG placed with
// geometry attributes, so a policy without 'unsafe-inline' can serve it.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const fmt = (n) => num(n).toLocaleString('en-US');
const plural = (n, one, many = one + 's') => `${fmt(n)} ${num(n) === 1 ? one : many}`;
const pct = (n) => Math.round(n * 1000) / 1000;

/** Escape, then turn `code` spans into <code>. The only markup prose gets. */
function inline(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Squarified treemap (Bruls, Huizing and van Wijk, 2000). Lays the values,
 * sorted largest first, into the rectangle (x, y, w, h); returns one
 * rectangle per value in the same order. Rows are filled while adding a
 * value improves the worst aspect ratio in the row.
 */
export function squarify(values, x, y, w, h) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!values.length || total <= 0) return [];
  const areas = values.map((v) => (v / total) * w * h);
  const out = [];
  let row = [];
  let i = 0;
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b, 0);
    const max = Math.max(...r);
    const min = Math.min(...r);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const place = (r) => {
    const s = r.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const cw = s / h;
      let yy = y;
      for (const a of r) { out.push({ x, y: yy, w: cw, h: a / cw }); yy += a / cw; }
      x += cw; w -= cw;
    } else {
      const rh = s / w;
      let xx = x;
      for (const a of r) { out.push({ x: xx, y, w: a / rh, h: rh }); xx += a / rh; }
      y += rh; h -= rh;
    }
  };
  while (i < areas.length) {
    const side = Math.min(w, h);
    const a = areas[i];
    if (!row.length || worst([...row, a], side) <= worst(row, side)) { row.push(a); i++; }
    else { place(row); row = []; }
  }
  if (row.length) place(row);
  return out;
}

// The complex.md mark (site/logo.svg), drawn in the current text color.
const MARK = 'M423.65 88.346c47.55 47.55 47.643 124.649.254 172.036s-124.277 47.087-171.827-.464s-47.851-124.44-.462-171.827s124.484-47.296 172.036.255zm48.457 75.976c36.55 85.672 20.095 188.403-49.603 258.1c-2.305 2.306-4.711 4.485-7.087 6.674l.316.727c-2.3 1.833-4.633 3.579-6.982 5.317c-92.205 78.677-231.182 74.228-318.65-13.24S-1.816 195.456 76.86 103.25c1.74-2.347 3.484-4.682 5.318-6.982l.727.313c2.188-2.375 4.367-4.781 6.673-7.086c69.697-69.698 172.428-86.154 258.1-49.604c-44.279-6.46-91.003 7.355-125.004 41.356c-57.266 57.266-57.136 150.294.325 207.756s150.49 57.592 207.756.326c34.002-34.001 47.817-80.725 41.355-125.005zm-62.842-61.591c-26.153-26.153-68.564-26.113-94.766.089s-26.346 68.717-.193 94.87s68.668 26.008 94.87-.193s26.241-68.614.09-94.766zM452.81 310.55l-.416.417c-19.188 19.188-41.842 32.938-65.959 41.404l17.141 45.493c24.427-25.42 40.567-55.495 49.235-87.314zM201.445 59.188c-31.82 8.667-61.895 24.807-87.314 49.235l45.389 17.036c8.481-24.096 22.33-46.676 41.508-65.855l.415-.416zm136.45 302.81c-13.946.832-27.975.064-41.758-2.357L273.55 459.844c31.412-2.587 62.37-12.41 90.107-29.556zM149.999 174.1l-68.291-25.762c-17.146 27.737-26.968 58.695-29.555 90.107l100.201-22.587c-2.419-13.783-3.188-27.813-2.355-41.758m99.5 170.59c-10.15-4.906-20.008-10.846-29.246-17.78l-89.851 89.85c28.022 22.062 60.212 35.856 93.58 41.256zm-82.192-82.193l-113.43 25.62c5.449 33.294 19.331 65.514 41.358 93.477l89.852-89.85c-6.935-9.24-12.875-19.097-17.78-29.247';

/**
 * The file names inside the NUL byte blind spot: the files search tools skip.
 * The sentence explains what each tool does, and that part changes, so the
 * match keys on the NUL byte, the colon before the list and the advice after.
 */
export function grepBlindFiles(blindSpots) {
  for (const b of blindSpots) {
    const m = /NUL byte[^:]*:\s+(.+?)\.\s+Search with/.exec(String(b));
    if (m) return m[1].split(', ').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function areaMeasure(rows) {
  if (rows.length && rows.every((r) => num(r.loc) > 0)) return { key: 'loc', label: 'lines', one: 'line' };
  if (rows.length && rows.every((r) => num(r.churn) > 0)) return { key: 'churn', label: 'commits', one: 'commit' };
  return { key: 'score', label: 'score', one: 'score' };
}

/** Heat step 0 to 4 by fixes, relative to the most fixed file in the map. */
const heat = (fixes, max) => (fixes <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((fixes / max) * 4)));

// The two view boxes: 2:1 for a wide screen, 4:5 for a phone. CSS shows one.
const VIEWS = { wide: [1000, 500], tall: [400, 500] };
const r1 = (n) => Math.round(n * 10) / 10;
// Font sizes in view box units. The phone layout is drawn about 0.9 times
// its size, so its type is set larger to land near 12 pixels.
const FONT = { wide: { lbl: 13, sub: 12 }, tall: { lbl: 14, sub: 13 } };

/** One layout of the treemap as SVG. Labels are cut to fit the tile here,
 *  because SVG text does not wrap or clip by itself. */
function treemapSvg(kind, order, rects, { measure, maxFix, grepBlind }) {
  const [W, H] = VIEWS[kind];
  const tiles = order.map((o, k) => {
    const { r, i } = o;
    const fixes = num(r.fixes);
    const q = rects[k];
    const x = r1(q.x + 1), y = r1(q.y + 1), w = r1(Math.max(0.5, q.w - 2)), h = r1(Math.max(0.5, q.h - 2));
    const path = String(r.path ?? '');
    const base = path.split('/').pop() || path;
    const isBlind = grepBlind.has(path);
    const lines = [
      plural(r[measure.key], measure.one, measure.label),
      `${plural(r.churn, 'commit')}, ${plural(fixes, 'fix', 'fixes')}`,
      `${plural(r.fan_in, 'importer')}, ${plural(r.tests, 'test')}`,
    ];
    if (isBlind) lines.push('search tools skip this file');
    // A mono character is about 0.6 of the font size wide, a sans one 0.55.
    const { lbl: fl, sub: fs } = FONT[kind];
    const fit = Math.floor((w - 14) / (fl * 0.6));
    let label = '';
    if (h >= fl + 9 && fit >= 3) {
      const text = base.length > fit ? base.slice(0, fit - 1) + '\u2026' : base;
      label += `<text class="lbl" x="${r1(x + 7)}" y="${r1(y + fl + 4)}">${esc(text)}</text>`;
      const sub = plural(fixes, 'fix', 'fixes');
      if (h >= fl + fs + 16 && sub.length * fs * 0.55 <= w - 14) label += `<text class="sub" x="${r1(x + 7)}" y="${r1(y + fl + fs + 8)}">${esc(sub)}</text>`;
    }
    const hatch = isBlind ? `<rect class="hatch" x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#hatch-${kind})"/>` : '';
    return `<a class="tile h${heat(fixes, maxFix)}${isBlind ? ' blind' : ''}" href="#f-${i}" data-path="${esc(path)}" data-fixes="${fixes}" data-tip="${esc(lines.join('\n'))}" aria-label="${esc(`${path}: ${lines.join('; ')}`)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${hatch}${label}</a>`;
  }).join('\n');
  const defs = grepBlind.size ? `<defs><pattern id="hatch-${kind}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch-line" width="2" height="8"/></pattern></defs>` : '';
  return `<svg class="tm-svg ${kind}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Treemap of ${esc(plural(order.length, 'hotspot'))}">${defs}\n${tiles}\n</svg>`;
}

/**
 * The sections of a report, each an HTML fragment, for a page that composes
 * them itself. Wrap them in an element with the class cxr and load
 * REPORT_CSS; REPORT_JS adds the treemap tooltip.
 *
 * @param {ReturnType<import('./complexmd.js').parseComplexMd>} map
 * @param {{ repo?: string }} [opts] repo: the name shown in headings, such as OWNER/REPO.
 * @returns {{ repo: string, facts: string, lede: string, hotspots: string, directives: string, coupling: string, blindSpots: string, readFirst: string }}
 */
export function reportParts(map, opts = {}) {
  const fm = map.front || {};
  const prof = fm.profile && typeof fm.profile === 'object' && !Array.isArray(fm.profile) ? fm.profile : {};
  const repo = String(opts.repo || 'this repository');
  const hot = Array.isArray(fm.hotspots) ? fm.hotspots : [];
  const lb = Array.isArray(fm.load_bearing) ? fm.load_bearing : [];
  const pairs = Array.isArray(fm.co_change) ? fm.co_change.filter((c) => Array.isArray(c.files) && c.files.length >= 2) : [];
  const seams = Array.isArray(fm.seams) ? fm.seams.filter((c) => Array.isArray(c.dirs) && c.dirs.length >= 2) : [];
  const blind = Array.isArray(fm.blind_spots) ? fm.blind_spots.map(String) : [];
  const grepBlind = new Set(grepBlindFiles(blind));
  const measure = areaMeasure(hot);
  const maxFix = Math.max(0, ...hot.map((r) => num(r.fixes)));

  const order = hot.map((r, i) => ({ r, i, v: num(r[measure.key]) > 0 ? num(r[measure.key]) : 1 })).sort((a, b) => b.v - a.v);
  const ctx = { measure, maxFix, grepBlind };
  const svgs = Object.entries(VIEWS).map(([kind, [W, H]]) => treemapSvg(kind, order, squarify(order.map((o) => o.v), 0, 0, W, H), ctx)).join('\n');
  const legend = [0, 1, 2, 3, 4].map((s) => {
    let label;
    if (s === 0) label = '0 fixes';
    else {
      const lo = Math.floor(((s - 1) / 4) * maxFix) + 1;
      const hi = Math.floor((s / 4) * maxFix);
      if (hi < lo) return '';
      label = lo === hi ? plural(lo, 'fix', 'fixes') : `${lo} to ${hi} fixes`;
    }
    return `<li><span class="sw h${s}" aria-hidden="true"></span>${esc(label)}</li>`;
  }).join('') + (hot.some((r) => grepBlind.has(String(r.path))) ? '<li><span class="sw h0 blind" aria-hidden="true"></span>hatched: search tools skip the file</li>' : '');

  const table = `<table>
<caption>Hotspots, ranked as in the map</caption>
<thead><tr><th scope="col">File</th><th scope="col">Lines</th><th scope="col">Commits</th><th scope="col">Fixes</th><th scope="col">Importers</th><th scope="col">Tests</th><th scope="col">Score</th></tr></thead>
<tbody>
${hot.map((r, i) => `<tr><th scope="row"><a href="#f-${i}"><code>${esc(r.path)}</code></a></th><td>${r.loc === undefined ? '' : fmt(r.loc)}</td><td>${fmt(r.churn)}</td><td>${fmt(r.fixes)}</td><td>${fmt(r.fan_in)}</td><td>${fmt(r.tests)}</td><td>${fmt(r.score)}</td></tr>`).join('\n')}
</tbody>
</table>`;

  const card = (r, id, isLb) => {
    const path = String(r.path ?? '');
    const para = typeof map.paragraphFor === 'function' ? map.paragraphFor(path) : null;
    const directive = typeof map.directive === 'function' ? map.directive(path) : null;
    const context = para && directive && para.endsWith(directive) ? para.slice(0, para.length - directive.length).trim() : para;
    const partners = pairs
      .filter((c) => c.files.includes(path))
      .map((c) => `<li><code>${esc(c.files.find((f) => f !== path))}</code> <span class="n">${esc(plural(c.count, 'commit'))}, ${esc(num(c.coupling))}%</span></li>`);
    const tags = isLb
      ? [`load bearing`, plural(r.fan_in, 'importer'), plural(r.tests, 'test')]
      : [plural(r.fixes, 'fix', 'fixes'), plural(r.churn, 'commit'), plural(r.fan_in, 'importer'), plural(r.tests, 'test')];
    if (grepBlind.has(path)) tags.push('search tools skip it');
    return `<article class="card${isLb ? ' lb' : ''}" id="f-${id}">
<h3><code>${esc(path)}</code></h3>
<p class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
${directive ? `<p class="do">${inline(directive)}</p>` : '<p class="do none">The map gives no paragraph for this file.</p>'}
${partners.length ? `<div class="moves"><p>Moves with</p><ul>${partners.join('')}</ul></div>` : ''}
${context ? `<details><summary>Why this file is hot</summary><p>${inline(context)}</p></details>` : ''}
</article>`;
  };
  const cards = [...hot.map((r, i) => card(r, i, false)), ...lb.map((r, j) => card(r, hot.length + j, true))].join('\n');

  const pairList = pairs.length
    ? `<ul class="pairs">${pairs.map((c) => `<li><span class="files"><code>${esc(c.files[0])}</code><span class="plus" aria-hidden="true">+</span><code>${esc(c.files[1])}</code></span><span class="n">${esc(plural(c.count, 'commit'))}, ${esc(num(c.coupling))}%</span></li>`).join('')}</ul>`
    : '<p class="empty">No co-change pairs in this map.</p>';
  const seamList = seams.length
    ? `<h3>Directories that move together</h3><ul class="pairs">${seams.map((c) => `<li><span class="files"><code>${esc(c.dirs[0])}</code><span class="plus" aria-hidden="true">+</span><code>${esc(c.dirs[1])}</code></span><span class="n">${esc(plural(c.count, 'commit'))}, ${esc(num(c.coupling))}%</span></li>`).join('')}</ul>`
    : '';

  const blindList = blind.length
    ? `<ul class="blind-list">${blind.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`
    : '<p class="empty">No blind spots recorded in this map.</p>';
  const grepList = grepBlind.size
    ? `<h3>Files search tools skip</h3><p>These files hold a NUL byte. Text search tools treat them as binary, so a search shows no matching line from them. Search them with <code>git grep -I --text</code>.</p><ul class="grep">${[...grepBlind].map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>`
    : '';

  const readFirst = String(map.readFirst || '')
    .split('\n')
    .map((l) => /^\s*\d+\.\s+(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => `<li>${inline(m[1])}</li>`);

  const facts = [
    ['Commit', fm.commit],
    ['Generated', fm.generated],
    ['Commits read', prof.commits_analyzed ?? fm.window_commits],
    ['Window', prof.window_from && prof.window_to ? `${prof.window_from} to ${prof.window_to}` : null],
    ['Files ranked', fm.files_analyzed],
    ['Confidence', prof.confidence],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');


  const factsHtml = `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === 'Commit' ? `<code>${esc(v)}</code>` : esc(v)}</dd></div>`).join('')}</dl>`;
  return {
    repo,
    tool: fm.tool ? String(fm.tool) : '',
    facts: factsHtml,
    lede: map.riskSummary ? `<p class="lede">${inline(map.riskSummary.replace(/\s*\n\s*/g, ' '))}</p>` : '',
    hotspots: `<section id="hotspots" aria-labelledby="h-hot">
<h2 id="h-hot">Hotspots</h2>
<p class="note">${esc(plural(hot.length, 'file'))}. Area: ${esc(measure.label)}. Color: bug fixes in the window. Select a tile for its directive.</p>
${hot.length ? `<div class="tm" id="tm">
${svgs}
<div class="tip" id="tm-tip" role="tooltip" hidden></div>
</div>
<ul class="legend" aria-label="Color scale">${legend}</ul>
<details class="tv"><summary>Table view</summary><div class="tw">${table}</div></details>` : '<p class="empty">No hotspots in this map.</p>'}
</section>`,
    directives: `<section id="directives" aria-labelledby="h-do">
<h2 id="h-do">Before you edit</h2>
<p class="note">Each hot file and what its paragraph says to do before you change it.</p>
${cards || '<p class="empty">No hot files in this map.</p>'}
</section>`,
    coupling: `<section id="co-change" aria-labelledby="h-co">
<h2 id="h-co">Change coupling</h2>
<p class="note">Files that change in the same commits. When you edit one, open the other.</p>
${pairList}
${seamList}
</section>`,
    blindSpots: `<section id="blind-spots" aria-labelledby="h-blind">
<h2 id="h-blind">Blind spots</h2>
<p class="note">What the analysis could not see.</p>
${blindList}
${grepList}
</section>`,
    readFirst: readFirst.length ? `<section id="read-first" aria-labelledby="h-read"><h2 id="h-read">What to read first</h2><ol class="read">${readFirst.join('')}</ol></section>` : '',
  };
}

/**
 * @param {ReturnType<import('./complexmd.js').parseComplexMd>} map
 * @param {{ repo?: string, version?: string }} [opts]
 *   repo: the name shown in the header and title, such as OWNER/REPO.
 *   version: the complex-md version that rendered the page, for the footer.
 * @returns {string} one HTML document
 */
export function renderReport(map, opts = {}) {
  const p = reportParts(map, opts);
  const title = `${p.repo}: COMPLEX.md report`;
  const footer = `Rendered from COMPLEX.md${p.tool ? ` (${esc(p.tool)})` : ''}${opts.version ? ` by complex-md ${esc(opts.version)}` : ''}. Learn the format at <a href="https://complex.md">complex.md</a>.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${BASE_CSS}${REPORT_CSS}</style>
</head>
<body class="cxr">
<header class="top">
<div class="inner">
<p class="eyebrow"><svg class="mark" viewBox="0 0 512 512" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${MARK}"/></svg><span>COMPLEX.md report</span></p>
<h1>${esc(p.repo)}</h1>
${p.facts}
${p.lede}
</div>
</header>
<main class="inner">
${p.hotspots}
${p.directives}
${p.coupling}
${p.blindSpots}
${p.readFirst}
</main>
<footer class="foot"><div class="inner"><p>${footer}</p></div></footer>
<script>${REPORT_JS}</script>
</body>
</html>
`;
}

// The standalone page's document rules. The report rules sit under .cxr,
// the body's class here and a wrapper's class on a hosted page.
const BASE_CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0}`;

/** The report's styles, every rule under .cxr. No rule fetches anything. */
export const REPORT_CSS = `
.cxr{--ink:#171717;--ink-2:#374151;--muted:#4b5563;--ground:#fff;--band:#f9fafb;--line:#e5e7eb;--line-2:#d1d5db;--heat:#c24e14;
--h0:#f3f4f6;--h1:#fde4d3;--h2:#f8b48c;--h3:#e07a3e;--h4:#c24e14;--f0:#171717;--f1:#171717;--f2:#171717;--f3:#171717;--f4:#fff;
--sans:Inter,-apple-system,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;color-scheme:light dark;
background:var(--ground);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:24px}
@media (prefers-color-scheme:dark){.cxr{--ink:#ededed;--ink-2:#d1d5db;--muted:#9ca3af;--ground:#0a0a0a;--band:#111318;--line:#1f2937;--line-2:#374151;--heat:#e07a3e;
--h0:#1f2937;--h1:#3a2418;--h2:#6e3416;--h3:#a8481a;--h4:#e07a3e;--f0:#ededed;--f1:#ededed;--f2:#ededed;--f3:#fff;--f4:#0a0a0a}}
.cxr a{color:inherit;text-underline-offset:3px}
.cxr code{font-family:var(--mono);font-size:.875em;overflow-wrap:break-word}
.cxr h3 code,.cxr .files code,.cxr .moves code,.cxr .grep code,.cxr th code{overflow-wrap:anywhere}
.cxr .inner{max-width:1152px;margin:0 auto;padding:0 24px}
.cxr h1,.cxr h2,.cxr h3{font-weight:600;margin:0}
.cxr p{margin:0}
.cxr .top{background:var(--band);border-bottom:1px solid var(--line);padding:40px 0 32px}
.cxr .eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-family:var(--mono);font-size:13px;font-weight:700}
.cxr .mark{display:block;flex:none}
.cxr h1{font-size:36px;line-height:40px;letter-spacing:-.75px;overflow-wrap:anywhere}
.cxr .facts{display:flex;flex-wrap:wrap;gap:12px 28px;margin:20px 0 0;padding:0}
.cxr .facts div{min-width:0}
.cxr .facts dt{font-size:12px;line-height:16px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.cxr .facts dd{margin:2px 0 0;font-size:14px;line-height:20px;font-weight:500;overflow-wrap:anywhere}
.cxr .lede{margin:20px 0 0;max-width:72ch;font-size:17px;line-height:27px;color:var(--ink-2)}
.cxr section{padding:40px 0 8px}
.cxr h2{font-size:24px;line-height:32px;letter-spacing:-.5px}
.cxr h3{font-size:16px;line-height:24px}
.cxr .note{margin:4px 0 16px;color:var(--muted);font-size:14px;line-height:20px}
.cxr .empty{color:var(--muted)}
.cxr .tm{position:relative;width:100%}
.cxr .tm-svg{display:block;width:100%;height:auto}
.cxr .tm-svg.tall{display:none}
.cxr .tile{outline:none;cursor:pointer}
.cxr .tile rect{stroke:none}
.cxr .tile .lbl{font-family:var(--mono);font-size:13px;font-weight:700}
.cxr .tile .sub{font-family:var(--sans);font-size:12px;opacity:.85}
.cxr .tall .tile .lbl{font-size:14px}
.cxr .tall .tile .sub{font-size:13px}
.cxr .tile:hover rect:first-child,.cxr .tile:focus-visible rect:first-child{stroke:var(--ink);stroke-width:3}
.cxr .hatch{pointer-events:none}
.cxr .hatch-line{fill:rgba(127,127,127,.35)}
.cxr .h0 rect:first-child{fill:var(--h0)}.cxr .h1 rect:first-child{fill:var(--h1)}.cxr .h2 rect:first-child{fill:var(--h2)}.cxr .h3 rect:first-child{fill:var(--h3)}.cxr .h4 rect:first-child{fill:var(--h4)}
.cxr .h0 text{fill:var(--f0)}.cxr .h1 text{fill:var(--f1)}.cxr .h2 text{fill:var(--f2)}.cxr .h3 text{fill:var(--f3)}.cxr .h4 text{fill:var(--f4)}
.cxr .sw.h0{background-color:var(--h0)}.cxr .sw.h1{background-color:var(--h1)}.cxr .sw.h2{background-color:var(--h2)}.cxr .sw.h3{background-color:var(--h3)}.cxr .sw.h4{background-color:var(--h4)}
.cxr .sw.blind{background-image:repeating-linear-gradient(135deg,transparent 0 6px,rgba(127,127,127,.28) 6px 8px)}
.cxr .tip{position:absolute;z-index:5;max-width:min(280px,100%);background:var(--ink);color:var(--ground);border-radius:6px;padding:8px 10px;font-size:13px;line-height:18px;pointer-events:none;white-space:pre-line;box-shadow:0 4px 12px rgba(0,0,0,.18)}
.cxr .tip strong{display:block;font-family:var(--mono);font-size:12px;overflow-wrap:anywhere;margin-bottom:2px}
.cxr .legend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px;margin:12px 0 0;padding:0;font-size:13px;line-height:18px;color:var(--muted)}
.cxr .legend li{display:flex;align-items:center;gap:6px}
.cxr .sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--line-2)}
.cxr .tv{margin-top:16px}
.cxr summary{cursor:pointer;font-size:14px;font-weight:500}
.cxr .tw{overflow-x:auto;margin-top:8px;border:1px solid var(--line);border-radius:8px}
.cxr table{display:table;border-collapse:collapse;width:100%;margin:0;font-size:14px;line-height:20px}
.cxr caption{text-align:left;padding:8px 12px;color:var(--muted);font-size:13px}
.cxr th,.cxr td{padding:8px 12px;border-top:1px solid var(--line);border-bottom:0;text-align:right;white-space:nowrap;vertical-align:baseline}
.cxr th[scope=row],.cxr thead th:first-child{text-align:left;white-space:normal;min-width:12ch}
.cxr thead th{font-family:var(--sans);font-weight:600;font-size:13px;letter-spacing:0;text-transform:none;color:var(--muted)}
.cxr .card{border:1px solid var(--line);border-radius:8px;padding:16px;margin:0 0 12px;background:var(--ground);scroll-margin-top:72px}
.cxr .card:target{border-color:var(--heat);box-shadow:0 0 0 1px var(--heat)}
.cxr .card h3 code{font-size:14px;font-weight:700}
.cxr .tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;padding:0}
.cxr .tags span{font-size:12px;line-height:18px;padding:1px 8px;border:1px solid var(--line-2);border-radius:4px;color:var(--ink-2)}
.cxr .card.lb .tags span:first-child{border-color:var(--heat);color:var(--heat)}
.cxr .do{margin:12px 0 0;padding-left:12px;border-left:3px solid var(--heat);font-weight:500}
.cxr .do.none{border-left-color:var(--line-2);color:var(--muted);font-weight:400}
.cxr .moves{margin-top:12px;font-size:14px;line-height:20px}
.cxr .moves p{margin:0;color:var(--muted)}
.cxr .moves ul{margin:4px 0 0;padding-left:18px}
.cxr .card details{margin-top:12px}
.cxr .card details p{margin:8px 0 0;color:var(--ink-2);font-size:15px;line-height:23px}
.cxr .n{color:var(--muted);font-size:13px;white-space:nowrap}
.cxr .pairs{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.cxr .pairs li{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 16px;padding:10px 0;border-bottom:1px solid var(--line)}
.cxr .files{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;min-width:0}
.cxr .plus{color:var(--muted)}
.cxr #co-change h3,.cxr #blind-spots h3{margin:24px 0 8px}
.cxr .blind-list,.cxr .grep,.cxr .read{margin:0;padding-left:20px}
.cxr .blind-list li,.cxr .read li{margin:0 0 8px;max-width:80ch}
.cxr .grep li{margin:0 0 4px}
.cxr .foot{margin-top:56px;padding:32px 0;background:var(--band);border-top:1px solid var(--line);color:var(--muted);font-size:14px;line-height:20px}
.cxr .foot p{margin:0}
@media (max-width:640px){
.cxr .inner{padding:0 16px}
.cxr .top{padding:28px 0 24px}
.cxr h1{font-size:28px;line-height:34px}
.cxr .tm-svg.wide{display:none}
.cxr .tm-svg.tall{display:block}
}
@media (forced-colors:active){.cxr .tile rect:first-child{stroke:CanvasText;stroke-width:1}}
@media print{.cxr .tip{display:none}}
`;

// The tooltip: one element, filled with textContent (never markup) from the
// tile's data attributes, placed beside the tile and kept inside the map.
export const REPORT_JS = `
(function(){
var box=document.getElementById('tm'),tip=document.getElementById('tm-tip');
if(!box||!tip)return;
function show(t){
tip.textContent='';
var s=document.createElement('strong');s.textContent=t.getAttribute('data-path');tip.appendChild(s);
tip.appendChild(document.createTextNode(t.getAttribute('data-tip')));
tip.hidden=false;
var b=box.getBoundingClientRect(),r=t.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
var x=Math.max(0,Math.min(r.left-b.left,b.width-w));
var y=r.bottom-b.top+6;
if(y+h>b.height){y=r.top-b.top-h-6;}
if(y<0){y=Math.max(0,r.top-b.top+6);}
tip.style.left=x+'px';tip.style.top=y+'px';
}
function hide(){tip.hidden=true;}
var tiles=box.querySelectorAll('.tile');
for(var i=0;i<tiles.length;i++){
tiles[i].addEventListener('mouseenter',function(e){show(e.currentTarget);});
tiles[i].addEventListener('focus',function(e){show(e.currentTarget);});
tiles[i].addEventListener('mouseleave',hide);
tiles[i].addEventListener('blur',hide);
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
})();
`;
