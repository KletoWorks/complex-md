// The map card on the home page: one real COMPLEX.md drawn as a treemap,
// the directive the agent reads for each hot file, the file's front matter
// and where the file came from. build.mjs fills {{DEMO_MAP}} with it, so
// every number on the card is read from the map at build time.
//
// The markup carries no style attribute and no script. The treemap is SVG
// placed with geometry attributes, as in cli/src/render.js, so a policy
// without 'unsafe-inline' serves it. The Map and File views switch with two
// radio inputs and CSS. site.js adds the tile selection and the cycle; with
// no script, the first panel of the cycle shows.
import { parseComplexMd } from '../cli/src/complexmd.js';
import { squarify } from '../cli/src/render.js';

/* A 0.3 map names its writer in `tool`; the reader maps it to `generator` {name, version}. */
const toolName = (fm) => fm.tool ?? (fm.generator ? [fm.generator.name, fm.generator.version].filter(Boolean).join('/') : '');

/** The map the card draws: a committed file and the repository it maps. */
export const DEMO = {
  file: 'bench/results/fastify-damage/maps/fastify-fastify-2026-07.md',
  repo: 'fastify/fastify',
  label: 'A map from the fastify benchmark runs',
};

const SOURCE = 'https://github.com/KletoWorks/complex-md/blob/main/';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const code = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (n) => num(n).toLocaleString('en-US');
const r1 = (n) => Math.round(n * 10) / 10;

/** Heat step 0 to 4 by fixes, relative to the most fixed file; the same steps as the report page. */
const heat = (fixes, max) => (fixes <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((fixes / max) * 4)));

/** The fix counts each heat step covers, as [low, high] pairs; a step no count reaches is left out. */
export function heatSteps(max) {
  const steps = [];
  for (let k = 1; k <= 4; k++) {
    const lo = Math.floor(((k - 1) * max) / 4) + 1;
    const hi = Math.floor((k * max) / 4);
    if (lo <= hi) steps.push([lo, hi]);
  }
  return steps;
}

// Two view boxes, sized near the pixels they are drawn at, so 12 units of
// type land near 12 pixels: 16:10 beside the copy, 1:1 on a phone.
const VIEWS = { wide: { w: 560, h: 350, lbl: 13, sub: 12 }, tall: { w: 340, h: 340, lbl: 12.5, sub: 12 } };

function treemap(kind, order, maxFix) {
  const v = VIEWS[kind];
  const rects = squarify(order.map((o) => Math.max(1, num(o.h.loc))), 0, 0, v.w, v.h);
  const tiles = order.map(({ h, i }, k) => {
    const q = rects[k];
    const x = r1(q.x + 1.5), y = r1(q.y + 1.5), w = r1(Math.max(0.5, q.w - 3)), ht = r1(Math.max(0.5, q.h - 3));
    const base = h.path.split('/').pop() || h.path;
    // A mono character is about 0.6 of the font size wide, a sans one 0.55.
    const fit = Math.floor((w - 16) / (v.lbl * 0.6));
    let label = '';
    if (ht >= v.lbl + 14 && fit >= 3) {
      const text = base.length > fit ? base.slice(0, fit - 1) + '…' : base;
      label += `<text class="lbl" x="${r1(x + 8)}" y="${r1(y + 8 + v.lbl)}">${esc(text)}</text>`;
      const sub = `${fmt(h.fixes)} fixes`;
      if (ht >= v.lbl + v.sub + 22 && sub.length * v.sub * 0.55 <= w - 16) label += `<text class="sub" x="${r1(x + 8)}" y="${r1(y + 14 + v.lbl + v.sub)}">${esc(sub)}</text>`;
    }
    const title = `${h.path}: ${fmt(h.loc)} lines, ${fmt(h.churn)} commits, ${fmt(h.fixes)} fixes, ${fmt(h.fan_in)} importers, ${fmt(h.tests)} tests`;
    return `<g class="tile h${heat(num(h.fixes), maxFix)}" data-i="${i}"><title>${esc(title)}</title><rect x="${x}" y="${y}" width="${w}" height="${ht}" rx="5"/>${label}</g>`;
  }).join('');
  return `<svg class="tm-svg ${kind}" viewBox="0 0 ${v.w} ${v.h}" role="group" aria-label="Treemap of ${order.length} hot files">${tiles}</svg>`;
}

/** The front matter, line for line, with each key marked for color. */
function frontMatterView(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
  return ['---', ...fm.split('\n'), '---'].map((line) => {
    const m = /^(\s*(?:- )?)([A-Za-z_][\w]*):(.*)$/.exec(line);
    return m ? `${esc(m[1])}<span class="k">${esc(m[2])}:</span>${esc(m[3])}` : esc(line);
  }).join('\n');
}

/**
 * The card for one map. `text` is the COMPLEX.md file; `repo` names the
 * repository it maps and `file` its path in this repository.
 */
export function demoCard(text, { repo, file, label = DEMO.label }) {
  text = String(text).replace(/\r\n/g, '\n');
  const map = parseComplexMd(text);
  const fm = map.front;
  const hot = (fm.hotspots || []).filter((h) => typeof h.path === 'string');
  const pairs = (fm.co_change || []).filter((c) => Array.isArray(c.files) && c.files.length >= 2);
  const maxFix = Math.max(0, ...hot.map((h) => num(h.fixes)));
  const partners = (path) => pairs.filter((c) => c.files.includes(path))
    .sort((a, b) => num(b.coupling) - num(a.coupling)).slice(0, 2)
    .map((c) => ({ path: c.files.find((f) => f !== path), coupling: num(c.coupling) }));

  // The cycle visits each file that has a directive. It opens on the file
  // whose closest partner moves with it most, and then follows map order.
  const withDirective = hot.map((h, i) => i).filter((i) => map.directive(hot[i].path));
  const top = (i) => partners(hot[i].path)[0]?.coupling ?? 0;
  const first = withDirective.reduce((best, i) => (best === -1 || top(i) > top(best) ? i : best), -1);
  const cycle = first === -1 ? [] : [first, ...withDirective.filter((i) => i !== first)];
  const shown = cycle[0] ?? 0;

  const order = hot.map((h, i) => ({ h, i })).sort((a, b) => num(b.h.loc) - num(a.h.loc));
  const panels = hot.map((h, i) => {
    const d = map.directive(h.path);
    const ps = partners(h.path);
    return `<div class="panel" id="hot-${i}" data-i="${i}"${i === shown ? '' : ' hidden'}>`
      + `<p class="pf"><code>${esc(h.path)}</code></p>`
      + `<p class="pt"><span>${fmt(h.fixes)} fixes</span><span>${fmt(h.churn)} commits</span><span>${fmt(h.fan_in)} importers</span><span>${fmt(h.tests)} tests</span></p>`
      + (d ? `<p class="pd">${code(d)}</p>` : '<p class="pd none">The map gives this file no paragraph of its own.</p>')
      + (ps.length ? `<p class="pm">Moves with ${ps.map((p) => `<code>${esc(p.path)}</code> <span>${p.coupling}%</span>`).join(', ')}</p>` : '')
      + '</div>';
  }).join('\n');

  const steps = heatSteps(maxFix);
  const legend = steps.map(([lo, hi], k) => `<li><span class="sw h${heat(hi, maxFix)}"></span>${lo === hi ? lo : `${lo} to ${hi}`}${k === 0 ? ' fixes' : ''}</li>`).join('');
  const short = String(fm.commit ?? '').slice(0, 8);
  const commits = fmt(fm.profile?.commits_analyzed);

  return `<figure class="map-card" id="demo" data-cycle="${cycle.join(' ')}">
<div class="bar">
<span class="fname">COMPLEX.md</span>
<span class="ftag">${esc(repo)} at ${esc(short)}</span>
<div class="tabs" role="radiogroup" aria-label="View">
<input type="radio" name="cx-view" id="vw-map" value="map" checked><label for="vw-map">Map</label>
<input type="radio" name="cx-view" id="vw-file" value="file"><label for="vw-file">File</label>
</div>
</div>
<div class="view v-map">
<div class="tm" id="tm">${treemap('wide', order, maxFix)}${treemap('tall', order, maxFix)}</div>
<ul class="legend" aria-label="Color: bug fixes">${legend}<li class="area">Area: lines of code</li></ul>
</div>
<div class="view v-file"><pre class="yaml" tabindex="0" aria-label="The front matter of this COMPLEX.md">${frontMatterView(text)}</pre></div>
<div class="reads" id="reads">
<p class="lead"><span class="dot" aria-hidden="true"></span>Before it edits this file, the agent reads</p>
<div class="panels">
${panels}
</div>
<div class="prog" aria-hidden="true"><i></i></div>
</div>
<figcaption class="cap"><p>${esc(label)}: ${commits} commits read, ${fmt(fm.files_analyzed)} files ranked. Select a tile.</p>
<p class="prov"><a href="${SOURCE}${esc(file)}">${esc(repo)} at commit ${esc(short)}</a>, generated ${esc(fm.generated)} by ${esc(toolName(fm))}, spec ${esc(fm.complex_md)}.</p></figcaption>
</figure>`;
}
