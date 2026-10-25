// The Open Graph image of a hosted page, as PNG bytes, with no dependency:
// a 5x7 bitmap font, the complex.md mark rasterized from site/mark.path, and
// a PNG writer on node:zlib. Pure: the same facts give the same bytes. Text
// outside the font's character set draws as "?", so a stranger's text cannot
// reach the image as anything but pixels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { ROOT } from './chrome.mjs';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const ROWS = {
  A: '0E 11 11 1F 11 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E', D: '1C 12 11 11 11 12 1C',
  E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10', G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11',
  I: '0E 04 04 04 04 04 0E', J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11', N: '11 11 19 15 13 11 11', O: '0E 11 11 11 11 11 0E', P: '1E 11 11 1E 10 10 10',
  Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11', S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0E', V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
  Y: '11 11 0A 04 04 04 04', Z: '1F 01 02 04 08 10 1F',
  a: '00 00 0E 01 0F 11 0F', b: '10 10 16 19 11 11 1E', c: '00 00 0E 10 10 11 0E', d: '01 01 0D 13 11 11 0F',
  e: '00 00 0E 11 1F 10 0E', f: '06 09 08 1C 08 08 08', g: '00 0F 11 11 0F 01 0E', h: '10 10 16 19 11 11 11',
  i: '04 00 0C 04 04 04 0E', j: '02 00 06 02 02 12 0C', k: '10 10 12 14 18 14 12', l: '0C 04 04 04 04 04 0E',
  m: '00 00 1A 15 15 11 11', n: '00 00 16 19 11 11 11', o: '00 00 0E 11 11 11 0E', p: '00 00 1E 11 1E 10 10',
  q: '00 00 0F 11 0F 01 01', r: '00 00 16 19 10 10 10', s: '00 00 0F 10 0E 01 1E', t: '08 08 1C 08 08 09 06',
  u: '00 00 11 11 11 13 0D', v: '00 00 11 11 11 0A 04', w: '00 00 11 11 15 15 0A', x: '00 00 11 0A 04 0A 11',
  y: '00 11 11 11 0F 01 0E', z: '00 00 1F 02 04 08 1F',
  0: '0E 11 13 15 19 11 0E', 1: '04 0C 04 04 04 04 0E', 2: '0E 11 01 02 04 08 1F', 3: '1F 02 04 02 01 11 0E',
  4: '02 06 0A 12 1F 02 02', 5: '1F 10 1E 01 01 11 0E', 6: '06 08 10 1E 11 11 0E', 7: '1F 01 02 04 08 08 08',
  8: '0E 11 11 0E 11 11 0E', 9: '0E 11 11 0F 01 02 0C',
  '.': '00 00 00 00 00 0C 0C', '-': '00 00 00 1F 00 00 00', _: '00 00 00 00 00 00 1F', '/': '01 01 02 04 08 10 10',
  ':': '00 0C 0C 00 0C 0C 00', '%': '18 19 02 04 08 13 03', ',': '00 00 00 00 0C 04 08', '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08', '[': '0E 08 08 08 08 08 0E', ']': '0E 02 02 02 02 02 0E', '@': '0E 11 17 15 17 10 0E',
  '+': '00 04 04 1F 04 04 00', '~': '00 00 08 15 02 00 00', $: '04 0F 14 0E 05 1E 04', '=': '00 00 1F 00 1F 00 00',
  '?': '0E 11 01 02 04 00 04', ' ': '00 00 00 00 00 00 00',
};
const GLYPHS = Object.fromEntries(Object.entries(ROWS).map(([c, r]) => [c, r.split(' ').map((h) => parseInt(h, 16))]));

const ADVANCE = 6;
const textWidth = (s, scale) => (s.length * ADVANCE - 1) * scale;

/** The text cut to fit maxW at the scale, with an ellipsis of three dots. */
function fit(text, maxW, scale) {
  const cap = Math.floor((maxW / scale + 1) / ADVANCE);
  return text.length <= cap ? text : `${text.slice(0, Math.max(0, cap - 3))}...`;
}

const COLORS = { bg: [255, 255, 255], ink: [23, 23, 23], muted: [102, 102, 102], rule: [229, 229, 229] };

class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) this.px.set(COLORS.bg, i * 3);
  }
  set(x, y, c, a = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    for (let k = 0; k < 3; k++) this.px[i + k] = Math.round(this.px[i + k] * (1 - a) + c[k] * a);
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  text(s, x, y, scale, c) {
    let cx = x;
    for (const ch of s) {
      const g = GLYPHS[ch] || GLYPHS['?'];
      for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (g[r] & (16 >> b)) this.rect(cx + b * scale, y + r * scale, scale, scale, c);
      cx += ADVANCE * scale;
    }
  }
}

const MARK_PATH = readFileSync(join(ROOT, 'site/mark.path'), 'utf8').trim();

/** Subpaths of the mark as polylines. Handles M m L l c s S z, the commands the mark uses. */
function markPolygons(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const polys = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null, lcx = 0, lcy = 0, prevCubic = false;
  const num = () => Number(toks[i++]);
  const start = (nx, ny) => { x = nx; y = ny; sx = nx; sy = ny; cur = [[x, y]]; polys.push(cur); };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let t = 1; t <= 16; t++) {
      const u = t / 16, v = 1 - u;
      cur.push([v ** 3 * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * x3, v ** 3 * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * y3]);
    }
    lcx = x2; lcy = y2; x = x3; y = y3;
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const o = (a, b) => [rel ? x + a : a, rel ? y + b : b];
    const wasCubic = prevCubic;
    prevCubic = false;
    switch (cmd.toLowerCase()) {
      case 'm': { const [nx, ny] = o(num(), num()); start(nx, ny); cmd = rel ? 'l' : 'L'; break; }
      case 'l': { const [nx, ny] = o(num(), num()); cur.push([nx, ny]); x = nx; y = ny; break; }
      case 'c': { const [a, b] = o(num(), num()); const [c, e] = o(num(), num()); const [f, g] = o(num(), num()); cubic(a, b, c, e, f, g); prevCubic = true; break; }
      case 's': {
        const [c, e] = o(num(), num()); const [f, g] = o(num(), num());
        cubic(wasCubic ? 2 * x - lcx : x, wasCubic ? 2 * y - lcy : y, c, e, f, g); prevCubic = true; break;
      }
      case 'z': x = sx; y = sy; cur = [[x, y]]; polys.push(cur); break;
      default: throw new Error(`og-image: unsupported path command ${cmd}`);
    }
  }
  return polys.filter((p) => p.length > 2);
}

/** Alpha coverage of the mark, size x size, by 4x4 supersampling and the nonzero rule. */
function markAlpha(size) {
  const SS = 4, n = size * SS, k = n / 512;
  const edges = [];
  for (const p of markPolygons(MARK_PATH)) {
    for (let j = 0; j < p.length; j++) {
      const [x0, y0] = p[j], [x1, y1] = p[(j + 1) % p.length];
      if (y0 !== y1) edges.push([x0 * k, y0 * k, x1 * k, y1 * k]);
    }
  }
  const cov = new Uint16Array(size * size);
  for (let row = 0; row < n; row++) {
    const yc = row + 0.5, hits = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) hits.push([x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let h = 0; h < hits.length - 1; h++) {
      wind += hits[h][1];
      if (!wind) continue;
      const from = Math.max(0, Math.round(hits[h][0])), to = Math.min(n, Math.round(hits[h + 1][0]));
      for (let col = from; col < to; col++) cov[Math.floor(row / SS) * size + Math.floor(col / SS)]++;
    }
  }
  return { cov, max: SS * SS };
}

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * The image for one page. facts: { name, hotspots, pair: { files, coupling } | null, commit, date },
 * all already cleaned. It names the repository, counts the hotspots, gives the
 * top co-change pair, the commit and the date, and draws the mark.
 */
export function renderOgImage(facts) {
  const cv = new Canvas(OG_WIDTH, OG_HEIGHT);
  const PAD = 72, INNER = OG_WIDTH - 2 * PAD;
  const { cov, max } = markAlpha(88);
  for (let y = 0; y < 88; y++) for (let x = 0; x < 88; x++) if (cov[y * 88 + x]) cv.set(PAD + x, PAD + y, COLORS.ink, cov[y * 88 + x] / max);
  cv.text('complex.md', PAD + 88 + 28, PAD + 24, 5, COLORS.ink);
  cv.text('COMPLEX.md map', PAD + 88 + 28, PAD + 66, 3, COLORS.muted);
  cv.rect(PAD, 200, INNER, 2, COLORS.rule);

  let scale = 10;
  while (scale > 2 && textWidth(facts.name, scale) > INNER) scale--;
  cv.text(fit(facts.name, INNER, scale), PAD, 236, scale, COLORS.ink);

  const n = facts.hotspots;
  cv.text(`${n} ${n === 1 ? 'hotspot' : 'hotspots'}`, PAD, 340, 6, COLORS.ink);
  if (facts.pair) {
    cv.text(`Top co-change pair: ${facts.pair.coupling}% coupling`, PAD, 410, 4, COLORS.muted);
    cv.text(fit(facts.pair.files[0], INNER, 4), PAD, 450, 4, COLORS.ink);
    cv.text(fit(facts.pair.files[1], INNER, 4), PAD, 490, 4, COLORS.ink);
  } else {
    cv.text('No co-change pair found', PAD, 410, 4, COLORS.muted);
  }
  cv.text(`Commit ${facts.commit} on ${facts.date}`, PAD, 560, 4, COLORS.muted);
  return png(OG_WIDTH, OG_HEIGHT, cv.px);
}
