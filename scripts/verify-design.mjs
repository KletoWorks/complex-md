#!/usr/bin/env node
// Design gate: the built home page must carry the measured agents.md
// grammar. Serves dist/, opens it headless at desktop and phone widths in
// light and dark, fails on any console error or on any token drift.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const PW = process.env.PLAYWRIGHT_PATH || 'playwright';

const { chromium } = await import(PW);
const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/platform.css' || url === '/analytics.js') { res.writeHead(200, { 'content-type': url.endsWith('css') ? 'text/css' : 'text/javascript' }); return res.end(''); }
  let p = join(DIST, decodeURIComponent(url));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// Measured on agents.md, 2026-09-04. Pixel values are exact; colors are the
// nearest sRGB of the reference's lab() values.
const EXPECT = {
  desktop: {
    'h1.wordmark': { fontSize: '60px', fontWeight: '700', lineHeight: '60px', letterSpacing: '-1.5px' },
    '.hero .pitch': { fontSize: '22px' },
    '.section h2': { fontSize: '30px', fontWeight: '600', lineHeight: '36px', letterSpacing: '-0.75px', textAlign: 'center' },
    '.btn.solid': { fontSize: '14px', fontWeight: '500', paddingTop: '12px', paddingLeft: '20px', borderRadius: '4px' },
    '.file-card pre': { fontSize: '12px', lineHeight: '24px' },
    '.faq-item summary': { fontSize: '18px', lineHeight: '26px' },
    '.site-footer': { textAlign: 'center', fontSize: '14px' },
    body: { fontSize: '16px', lineHeight: '24px' },
  },
  phone: {
    'h1.wordmark': { fontSize: '48px', lineHeight: '48px', letterSpacing: '-1.2px' },
  },
};
const WIDTHS = {
  '.hero .inner': 1152, '#why .inner.narrow': 744, '#examples .inner': 1152,
};

const browser = await chromium.launch();
const problems = [];
for (const [name, width, dark] of [['desktop-light', 1280, false], ['desktop-dark', 1280, true], ['phone-light', 390, false], ['phone-dark', 390, true]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: console ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  const expect = width >= 1024 ? EXPECT.desktop : EXPECT.phone;
  const got = await page.evaluate((expect) => {
    const out = {};
    for (const sel of Object.keys(expect)) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      const cs = getComputedStyle(el);
      out[sel] = Object.fromEntries(Object.keys(expect[sel]).map((k) => [k, cs[k]]));
    }
    out._widths = {};
    for (const sel of ['.hero .inner', '#why .inner.narrow', '#examples .inner']) out._widths[sel] = Math.round(document.querySelector(sel)?.getBoundingClientRect().width || 0);
    out._bg = getComputedStyle(document.body).backgroundColor;
    out._hero = getComputedStyle(document.querySelector('.hero')).backgroundColor;
    out._why = getComputedStyle(document.querySelector('#why')).backgroundColor;
    out._overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    out._order = [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim());
    return out;
  }, expect);
  for (const [sel, props] of Object.entries(expect)) {
    if (!got[sel]) { problems.push(`${name}: ${sel} missing`); continue; }
    for (const [k, v] of Object.entries(props)) if (got[sel][k] !== v) problems.push(`${name}: ${sel} ${k} is ${got[sel][k]}, expected ${v}`);
  }
  if (width >= 1024) for (const [sel, w] of Object.entries(WIDTHS)) if (Math.abs(got._widths[sel] - w) > 1) problems.push(`${name}: ${sel} width ${got._widths[sel]}, expected ${w}`);
  const light = !dark;
  if (light && got._bg !== 'rgb(255, 255, 255)') problems.push(`${name}: body background ${got._bg}`);
  if (dark && got._bg !== 'rgb(10, 10, 10)') problems.push(`${name}: dark body background ${got._bg}`);
  if (got._hero === got._why) problems.push(`${name}: hero band must differ from the first section (${got._hero})`);
  if (got._why !== got._bg && got._why !== 'rgba(0, 0, 0, 0)') problems.push(`${name}: sections below the hero must sit on the page ground, not a band`);
  if (got._overflow) problems.push(`${name}: horizontal overflow`);
  const order = ['Why COMPLEX.md?', 'Works with the agents you already use.', 'Examples', 'How to use it', 'Why this exists', 'FAQ'];
  if (JSON.stringify(got._order) !== JSON.stringify(order)) problems.push(`${name}: section order ${JSON.stringify(got._order)}`);
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.error('design gate FAILED'); for (const p of problems) console.error('  ' + p); process.exit(1); }
console.log('design gate passed: tokens, widths, bands, order, dark mode, no overflow, no console errors');
