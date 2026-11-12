// The Open Graph image of one hosted map page: a 1200 by 630 PNG that names
// the repository, its number of hotspots, the map's first co-change pair
// with its coupling, the map's commit and date, and the complex.md mark.
// It ranks nothing and compares the repository with no other.
//
// No dependency: the module draws vector shapes with its own scanline
// rasterizer and writes the PNG with node:zlib. Text uses the Inter outlines
// in og-glyphs.json (scripts/og-font.py writes that file), so the image
// needs no font on the machine that builds it. Every step is integer or
// plain float arithmetic with no clock and no randomness, so the same facts
// give the same bytes.
//
// Text from strangers (owner, name, file paths) is drawn glyph by glyph
// from that table. A character outside it becomes "?", so no input reaches
// the image as anything but those shapes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { ROOT } from './chrome.mjs';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT = JSON.parse(readFileSync(join(ROOT, 'scripts/og-glyphs.json'), 'utf8'));
const MARK = readFileSync(join(ROOT, 'site/mark.path'), 'utf8').replace(/\r\n/g, '\n').trim();
const ELLIPSIS = '…';
const DOT = '·';

const COLORS = {
  band: [0xf3, 0xf4, 0xf6],
  ground: [0xff, 0xff, 0xff],
  line: [0xe5, 0xe7, 0xeb],
  ink: [0x17, 0x17, 0x17],
  ink2: [0x37, 0x41, 0x51],
  muted: [0x4b, 0x55, 0x63],
  muted2: [0x6b, 0x72, 0x80],
};

/* --------------------------------------------------------------- paths */

/**
 * SVG path data as closed contours of points, curves cut into straight
 * segments. tf maps a path point to an image point. Takes M L H V C S Q T Z
 * in both cases, with implicit repeats; no arcs (the mark and the font use
 * none).
 */
export function pathContours(d, tf) {
  const tokens = String(d).match(/[MLHVCSQTZmlhvcsqtz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const contours = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  let cmd = '';
  let prev = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  const put = (px, py) => { cur.push(tf(px, py)); };
  const curve = (pts, n) => {
    // pts: control points from the current point on; de Casteljau at n steps.
    const all = [[x, y], ...pts];
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      let row = all;
      while (row.length > 1) {
        const next = [];
        for (let j = 0; j < row.length - 1; j++) next.push([row[j][0] + (row[j + 1][0] - row[j][0]) * t, row[j][1] + (row[j + 1][1] - row[j][1]) * t]);
        row = next;
      }
      put(row[0][0], row[0][1]);
    }
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') {
      if (cur && cur.length) contours.push(cur);
      cur = null;
      x = sx; y = sy;
      prev = 'Z';
      continue;
    }
    if (C === 'M') {
      if (cur && cur.length) contours.push(cur);
      x = num() + ox; y = num() + oy;
      sx = x; sy = y;
      cur = [];
      put(x, y);
      cmd = rel ? 'l' : 'L';
      prev = 'M';
      continue;
    }
    if (!cur) { cur = []; put(x, y); sx = x; sy = y; }
    if (C === 'L') { x = num() + ox; y = num() + oy; put(x, y); }
    else if (C === 'H') { x = num() + ox; put(x, y); }
    else if (C === 'V') { y = num() + oy; put(x, y); }
    else if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') { x1 = num() + ox; y1 = num() + oy; }
      else if (prev === 'C' || prev === 'S') { x1 = 2 * x - cx; y1 = 2 * y - cy; }
      else { x1 = x; y1 = y; }
      const x2 = num() + ox, y2 = num() + oy, ex = num() + ox, ey = num() + oy;
      curve([[x1, y1], [x2, y2], [ex, ey]], 16);
      cx = x2; cy = y2; x = ex; y = ey;
    } else if (C === 'Q' || C === 'T') {
      let x1, y1;
      if (C === 'Q') { x1 = num() + ox; y1 = num() + oy; }
      else if (prev === 'Q' || prev === 'T') { x1 = 2 * x - cx; y1 = 2 * y - cy; }
      else { x1 = x; y1 = y; }
      const ex = num() + ox, ey = num() + oy;
      curve([[x1, y1], [ex, ey]], 10);
      cx = x1; cy = y1; x = ex; y = ey;
    } else {
      i++;
    }
    prev = C;
  }
  if (cur && cur.length) contours.push(cur);
  return contours;
}

/** A rounded rectangle as path data, corners drawn with cubic curves. */
export function roundRect(x, y, w, h, r) {
  const k = r * 0.5523;
  return `M${x + r} ${y}H${x + w - r}C${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}`
    + `V${y + h - r}C${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h}`
    + `H${x + r}C${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r}`
    + `V${y + r}C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}Z`;
}

/* ---------------------------------------------------------- the raster */

const SUB = 5; // samples per pixel row; coverage across a row is exact

/** An RGB canvas of floats, filled with one color. */
function canvas(w, h, color) {
  const px = new Float32Array(w * h * 3);
  for (let o = 0; o < px.length; o += 3) { px[o] = color[0]; px[o + 1] = color[1]; px[o + 2] = color[2]; }
  return { w, h, px };
}

/** Fill contours with the non-zero rule and blend the color in by coverage. */
function fill(img, contours, color) {
  const edges = [];
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
  for (const c of contours) {
    for (let j = 0; j < c.length; j++) {
      const [x0, y0] = c[j];
      const [x1, y1] = c[(j + 1) % c.length];
      if (x0 < xmin) xmin = x0; if (x0 > xmax) xmax = x0;
      if (y0 === y1) continue;
      const down = y1 > y0;
      edges.push(down ? { x0, y0, x1, y1, dir: 1 } : { x0: x1, y0: y1, x1: x0, y1: y0, dir: -1 });
      if (y0 < ymin) ymin = y0; if (y0 > ymax) ymax = y0;
      if (y1 < ymin) ymin = y1; if (y1 > ymax) ymax = y1;
    }
  }
  if (!edges.length) return;
  const { w, h, px } = img;
  const top = Math.max(0, Math.floor(ymin));
  const bottom = Math.min(h, Math.ceil(ymax));
  const left = Math.max(0, Math.floor(xmin));
  const right = Math.min(w, Math.ceil(xmax) + 1);
  if (left >= right) return;
  const cov = new Float32Array(w + 1);
  const weight = 1 / SUB;
  const span = (a, b) => {
    a = Math.max(a, 0); b = Math.min(b, w);
    if (b <= a) return;
    const ia = Math.floor(a), ib = Math.floor(b);
    if (ia === ib) { cov[ia] += (b - a) * weight; return; }
    cov[ia] += (ia + 1 - a) * weight;
    for (let k = ia + 1; k < ib; k++) cov[k] += weight;
    if (ib < w) cov[ib] += (b - ib) * weight;
  };
  // Each pixel row lists the edges that cross it, so a row reads only those.
  const rows = Array.from({ length: Math.max(0, bottom - top) }, () => []);
  for (const e of edges) {
    const r0 = Math.max(top, Math.floor(e.y0));
    const r1 = Math.min(bottom, Math.ceil(e.y1));
    for (let r = r0; r < r1; r++) rows[r - top].push(e);
  }
  for (let py = top; py < bottom; py++) {
    cov.fill(0, left, right);
    const active = rows[py - top];
    if (!active.length) continue;
    for (let s = 0; s < SUB; s++) {
      const y = py + (s + 0.5) / SUB;
      const xs = [];
      for (const e of active) {
        if (y < e.y0 || y >= e.y1) continue;
        xs.push({ x: e.x0 + ((y - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0), dir: e.dir });
      }
      xs.sort((p, q) => p.x - q.x);
      let wind = 0;
      let start = 0;
      for (const c of xs) {
        const before = wind;
        wind += c.dir;
        if (before === 0 && wind !== 0) start = c.x;
        else if (before !== 0 && wind === 0) span(start, c.x);
      }
    }
    for (let x = left; x < right; x++) {
      const a = cov[x] > 1 ? 1 : cov[x];
      if (a <= 0) continue;
      const o = (py * w + x) * 3;
      px[o] += (color[0] - px[o]) * a;
      px[o + 1] += (color[1] - px[o + 1]) * a;
      px[o + 2] += (color[2] - px[o + 2]) * a;
    }
  }
}

/* --------------------------------------------------------------- text */

/** Text with every character the glyph table lacks replaced by "?". */
export function glyphSafe(text) {
  return Array.from(String(text ?? '')).map((ch) => (FONT.bold[ch] && FONT.regular[ch] ? ch : '?')).join('');
}

/** The width of a run at a size, in pixels. */
export function textWidth(text, weight, size) {
  const g = FONT[weight];
  let units = 0;
  for (const ch of glyphSafe(text)) units += g[ch].a;
  return (units * size) / FONT.unitsPerEm;
}

/** Draw runs [{ text, weight, color }] from x on a baseline; returns the end x. */
function drawRuns(img, runs, x, baseline, size) {
  const scale = size / FONT.unitsPerEm;
  for (const run of runs) {
    const g = FONT[run.weight];
    const contours = [];
    for (const ch of glyphSafe(run.text)) {
      const glyph = g[ch];
      if (glyph.d) {
        const ox = x;
        contours.push(...pathContours(glyph.d, (gx, gy) => [ox + gx * scale, baseline - gy * scale]));
      }
      x += glyph.a * scale;
    }
    fill(img, contours, run.color);
  }
  return x;
}

const runsWidth = (runs, size) => runs.reduce((sum, r) => sum + textWidth(r.text, r.weight, size), 0);

/** Text cut in the middle with an ellipsis until it fits maxWidth. */
export function fitMiddle(text, weight, size, maxWidth) {
  const chars = Array.from(glyphSafe(text));
  if (textWidth(chars.join(''), weight, size) <= maxWidth) return chars.join('');
  let keep = chars.length - 1;
  while (keep > 1) {
    const head = Math.ceil(keep / 2);
    const tail = keep - head;
    const t = chars.slice(0, head).join('') + ELLIPSIS + (tail ? chars.slice(chars.length - tail).join('') : '');
    if (textWidth(t, weight, size) <= maxWidth) return t;
    keep--;
  }
  return ELLIPSIS;
}

/** A path cut from the front, whole segments first, until it fits maxWidth. */
export function fitPath(path, weight, size, maxWidth) {
  const p = glyphSafe(path);
  if (textWidth(p, weight, size) <= maxWidth) return p;
  const segs = p.split('/');
  for (let k = 1; k < segs.length; k++) {
    const t = `${ELLIPSIS}/${segs.slice(k).join('/')}`;
    if (textWidth(t, weight, size) <= maxWidth) return t;
  }
  return fitMiddle(segs[segs.length - 1], weight, size, maxWidth);
}

/* ---------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An 8 bit RGB PNG of the canvas, each row with the Sub filter. */
export function encodePng(img) {
  const { w, h, px } = img;
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  const row = new Uint8Array(w * 3);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 1; // Sub: each byte minus the same channel one pixel left
    for (let x = 0; x < w * 3; x++) {
      const v = px[y * w * 3 + x];
      row[x] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
      raw[y * stride + 1 + x] = (row[x] - (x >= 3 ? row[x - 3] : 0)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- card */

/**
 * The PNG for one page. facts: { display, hotspots, pair: { files: [a, b],
 * coupling } or null, commit (7 hex), date (YYYY-MM-DD) }. Every string is
 * drawn through the glyph table.
 */
export function renderOgImage(facts) {
  const W = OG_WIDTH, H = OG_HEIGHT;
  const img = canvas(W, H, COLORS.band);
  const card = { x: 40, y: 40, w: W - 80, h: H - 80 };
  const pad = 64;
  const inner = card.w - 2 * pad;
  const left = card.x + pad;
  fill(img, pathContours(roundRect(card.x, card.y, card.w, card.h, 24), (x, y) => [x, y]), COLORS.ground);

  // The mark and the eyebrow.
  const markSize = 52;
  const markTop = card.y + 56;
  const s = markSize / 512;
  fill(img, pathContours(MARK, (x, y) => [left + x * s, markTop + y * s]), COLORS.ink);
  drawRuns(img, [{ text: 'COMPLEX.md map', weight: 'bold', color: COLORS.ink }], left + markSize + 18, markTop + 37, 30);

  // The repository: as large as fits, cut in the middle below 44 px.
  let size = 80;
  while (size > 44 && textWidth(facts.display, 'bold', size) > inner) size -= 2;
  const repo = fitMiddle(facts.display, 'bold', size, inner);
  drawRuns(img, [{ text: repo, weight: 'bold', color: COLORS.ink }], left, card.y + 222, size);

  // The numbers.
  const n = Math.max(0, Math.floor(Number(facts.hotspots) || 0));
  drawRuns(img, [
    { text: String(n), weight: 'bold', color: COLORS.ink },
    { text: n === 1 ? ' hotspot' : ' hotspots', weight: 'regular', color: COLORS.ink2 },
  ], left, card.y + 300, 36);

  const lineSize = 30;
  if (facts.pair) {
    const pct = `${Math.max(0, Math.min(100, Math.round(Number(facts.pair.coupling) || 0)))}%`;
    drawRuns(img, [
      { text: 'Top co-change pair, ', weight: 'regular', color: COLORS.ink2 },
      { text: pct, weight: 'bold', color: COLORS.ink },
      { text: ' coupling:', weight: 'regular', color: COLORS.ink2 },
    ], left, card.y + 358, lineSize);
    const plus = { text: '  +  ', weight: 'regular', color: COLORS.muted2 };
    const room = inner - runsWidth([plus], lineSize);
    const [a, b] = facts.pair.files.map(String);
    // Each path gets half the room; a short path hands its spare room to the other.
    const half = room / 2;
    const wa = textWidth(a, 'bold', lineSize), wb = textWidth(b, 'bold', lineSize);
    const roomA = wb < half ? room - wb : wa < half ? wa : half;
    const fa = fitPath(a, 'bold', lineSize, roomA);
    const fb = fitPath(b, 'bold', lineSize, room - textWidth(fa, 'bold', lineSize));
    drawRuns(img, [{ text: fa, weight: 'bold', color: COLORS.ink }, plus, { text: fb, weight: 'bold', color: COLORS.ink }], left, card.y + 404, lineSize);
  } else {
    drawRuns(img, [{ text: 'No co-change pair in this map', weight: 'regular', color: COLORS.muted }], left, card.y + 358, lineSize);
  }

  // The rule and the provenance line.
  const ruleY = card.y + card.h - 112;
  fill(img, [[[left, ruleY], [left + inner, ruleY], [left + inner, ruleY + 2], [left, ruleY + 2]]], COLORS.line);
  const foot = card.y + card.h - 58;
  drawRuns(img, [{ text: `Commit ${facts.commit} ${DOT} ${facts.date} ${DOT} computed from public git history`, weight: 'regular', color: COLORS.muted2 }], left, foot, 26);
  const site = [{ text: 'complex.md', weight: 'bold', color: COLORS.ink }];
  drawRuns(img, site, left + inner - runsWidth(site, 26), foot, 26);
  return encodePng(img);
}
