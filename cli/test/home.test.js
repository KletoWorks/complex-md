// The home page: what it promises, what it loads and where its repository
// box sends a visitor. Runs only inside the repository checkout; the
// published CLI package has no content/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { computeSignals } from '../src/signals.js';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));

let built;
function home() {
  if (!built) {
    const out = mkdtempSync(join(tmpdir(), 'cx-home-'));
    execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', out], { stdio: 'pipe' });
    built = readFileSync(join(out, 'index.html'), 'utf8');
  }
  return built;
}
const hero = (html) => html.slice(html.indexOf('<section class="hero">'), html.indexOf('</section>'));
const flat = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

test('the repository box is a plain form that opens /map/?repo=', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const h = hero(home());
  assert.match(h, /<form [^>]*action="\/map\/"[^>]*method="get"/);
  assert.match(h, /<input [^>]*name="repo"/);
  assert.match(h, /<label for="repo-in">/);
  assert.match(h, /<code>npx complex-md<\/code>/);
});

test('the hero leads with the tagline and holds the map card', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const h = hero(home());
  assert.match(h, /<p class="pitch">Tell your coding agent what it could break, before it edits\.<\/p>/);
  assert.match(h, /<figure class="map-card" id="demo"/);
  assert.ok(!home().includes('{{'), 'no placeholder is left');
});

test('the home page runs under a strict policy: no inline script or style, nothing from another origin', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const html = home();
  assert.ok(!/\sstyle=/.test(html), 'no style attribute');
  assert.ok(!/<style/.test(html), 'no style element');
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.ok(/src="\/|type="application\/ld\+json"/.test(m[1]), m[1]);
  for (const m of html.matchAll(/<(?:script|img|link|iframe|source)\b[^>]*\s(?:src|href)="([^"]+)"/g)) {
    if (/rel="(canonical|author)"/.test(m[0])) continue;
    assert.ok(m[1].startsWith('/'), `loads only its own origin: ${m[1]}`);
  }
});

test('the proof states the claim verbatim and names the model', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const text = flat(home());
  assert.ok(text.includes('On two repositories with no shared tasks, agents ran the tests the map names on 14 of 15 risky edits, against 3 of 17 without it (11 of 11 discordant pairs, p about 0.001).'));
  assert.match(text, /Claude Opus 5 in Claude Code/);
  const proof = /id="proof">([\s\S]*?)<\/section>/.exec(home())[1];
  for (const [f, n] of [[14, 15], [3, 17]]) {
    const dots = new RegExp(`<span class="dots" data-f="${f}" data-n="${n}"[^>]*>([\\s\\S]*?)</span>`).exec(proof)?.[1] || '';
    assert.equal((dots.match(/<i class="f">/g) || []).length, f);
    assert.equal((dots.match(/<i/g) || []).length, n);
  }
});

/* The page quotes the blind spot that complex-md's own map carried at
   release 0.10.0. The quote must be the sentence the signals write today
   for that one file, so a change to the sentence fails here. */
test('the quoted blind spot is the sentence the signals write for a NUL byte', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  // With LF, as the build reads it: a Windows checkout has the page with CRLF.
  const src = readFileSync(join(ROOT, 'content/index.html'), 'utf8').replace(/\r\n/g, '\n');
  const quoted = /<pre class="blind[^"]*"[^>]*><span class="k">blind_spots:<\/span>\n {2}- "([^"]+)"<\/pre>/.exec(src)?.[1];
  assert.ok(quoted, 'the page quotes one blind spot');
  const dir = mkdtempSync(join(tmpdir(), 'cx-home-nul-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'cli/src'), { recursive: true });
  writeFileSync(join(dir, 'cli/src/resolve.js'), 'export const glob = (s) => s.replace("**", "\0");\n');
  writeFileSync(join(dir, 'cli/src/other.js'), 'export const a = 1;\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  const note = computeSignals(dir).blind_spots.find((b) => /NUL byte/.test(b));
  assert.equal(quoted, note);
});

test('the FAQ answers privacy, prose, removal and other hosts', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const src = readFileSync(join(ROOT, 'content/index.html'), 'utf8');
  const qs = [...src.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary>/g)].map((m) => m[1]);
  for (const re of [/send/i, /prose/i, /remove/i, /GitHub/]) assert.ok(qs.some((q) => re.test(q)), `a question matches ${re}`);
  assert.match(flat(src), /The CLI works on any git repository/);
  assert.match(src, /href="\/map\/remove\/"/);
});
