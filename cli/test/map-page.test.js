// The /map page and the removal form: what a visitor types, what the page
// asks the server and what it shows. Runs only inside the repository
// checkout; the published CLI package has no site/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const repoName = () => import(pathToFileURL(join(ROOT, 'site/repo-name.js')).href);

let built;
function site() {
  if (!built) {
    built = mkdtempSync(join(tmpdir(), 'cx-map-'));
    execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', built], { stdio: 'pipe' });
  }
  return built;
}

test('normaliseRepo reads owner/name, GitHub URLs, git URLs and SSH remotes as one lower case key', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { normaliseRepo } = await repoName();
  const cases = {
    'fastify/fastify': 'fastify/fastify',
    '  Fastify/Fastify  ': 'fastify/fastify',
    'github.com/nodejs/undici': 'nodejs/undici',
    'https://github.com/nodejs/undici/pulls': 'nodejs/undici',
    'https://www.github.com/nodejs/undici/tree/main/lib?x=1#top': 'nodejs/undici',
    'http://github.com/a-b/c.d_e': 'a-b/c.d_e',
    'https://github.com/fastify/fastify.git': 'fastify/fastify',
    'git+https://github.com/KletoWorks/complex-md.git': 'kletoworks/complex-md',
    'git://github.com/o/n.git': 'o/n',
    'git@github.com:Fastify/Fastify.git': 'fastify/fastify',
    'ssh://git@github.com/owner/name.git': 'owner/name',
    'ssh://git@github.com:22/owner/name.git': 'owner/name',
    'complex.md/fastify/fastify': 'fastify/fastify',
    'https://complex.md/fastify/fastify/': 'fastify/fastify',
  };
  for (const [input, key] of Object.entries(cases)) assert.deepEqual(normaliseRepo(input), { key }, input);
  assert.deepEqual(normaliseRepo(''), { error: 'empty' });
  assert.deepEqual(normaliseRepo('   '), { error: 'empty' });
  assert.equal(normaliseRepo('https://gitlab.com/a/b').error, 'host');
  assert.equal(normaliseRepo('git@gitlab.com:a/b.git').error, 'host');
  assert.equal(normaliseRepo('gitlab.com/a/b').error, 'host');
  assert.deepEqual(normaliseRepo('www.github.com/a/b'), { key: 'a/b' });
  for (const bad of ['fastify', 'github.com/fastify', 'a/..', '-a/b', 'a--/b', 'o w/n', '<script>/x', 'a/b c', 'x'.repeat(40) + '/y', 'a/' + 'b'.repeat(101)]) {
    assert.equal(normaliseRepo(bad).error, 'shape', bad);
  }
});

test('the /map page works as a plain form, names its parts for screen readers and loads only site files', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const html = readFileSync(join(site(), 'map/index.html'), 'utf8');
  assert.match(html, /<form [^>]*id="map-form"[^>]*action="\/map\/"[^>]*method="get"/);
  assert.match(html, /<label for="repo">/);
  assert.match(html, /<input id="repo" name="repo"/);
  assert.match(html, /id="map-result"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="request-status"[^>]*role="status"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<script type="module" src="\/lookup\.js"><\/script>/);
  assert.match(html, /<code>npx complex-md<\/code>/);
  assert.match(html, /Who writes the prose\?/);
  assert.ok(!/\sstyle=/.test(html), 'no style attribute');
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.ok(/src="\/|type="application\/ld\+json"/.test(m[1]), m[1]);
  assert.ok(readFileSync(join(site(), 'sitemap.xml'), 'utf8').includes('<loc>https://complex.md/map/</loc>'));
});

test('the lookup script asks /maps/index.json, posts requests as JSON and writes no markup from data', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const f of ['lookup.js', 'remove.js', 'repo-name.js']) assert.ok(existsSync(join(site(), f)), `the build ships ${f}`);
  const js = readFileSync(join(ROOT, 'site/lookup.js'), 'utf8');
  assert.match(js, /from '\.\/repo-name\.js'/);
  assert.match(js, /'\/maps\/index\.json'/);
  assert.match(js, /'\/api\/complexmd\/requests'/);
  assert.match(js, /'content-type': 'application\/json'/);
  for (const s of ['rate_limited', '429', 'already']) assert.ok(js.includes(s), s);
  for (const f of ['lookup.js', 'remove.js']) {
    const src = readFileSync(join(ROOT, 'site', f), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), `${f} builds the DOM with textContent`);
  }
});

async function lookupApp(fetch) {
  const { normaliseRepo } = await repoName();
  const makeElement = () => ({
    textContent: '',
    hidden: false,
    disabled: false,
    value: '',
    children: [],
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    append(...nodes) { this.children.push(...nodes); },
    setAttribute() {},
    removeAttribute() {},
    focus() {},
  });
  const ids = ['map-form', 'repo', 'map-result', 'map-unmapped', 'unmapped-text', 'request-btn', 'request-status'];
  const elements = Object.fromEntries(ids.map((id) => [id, makeElement()]));
  const storage = new Map();
  const location = { search: '', assigned: null, assign(path) { this.assigned = path; } };
  const source = readFileSync(join(ROOT, 'site/lookup.js'), 'utf8')
    .replace("import { normaliseRepo } from './repo-name.js';", 'const normaliseRepo = globalThis.__normaliseRepo;');
  runInNewContext(source, {
    __normaliseRepo: normaliseRepo,
    document: {
      getElementById(id) { return elements[id]; },
      createElement() { return makeElement(); },
    },
    fetch,
    history: { replaceState() {} },
    location,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    URLSearchParams,
  });
  return {
    elements,
    location,
    storage,
    submit(value) {
      elements.repo.value = value;
      elements['map-form'].listeners.submit({ preventDefault() {} });
    },
    request() {
      return elements['request-btn'].listeners.click();
    },
  };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test('a failed or invalid index load is retried on the next lookup', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  let calls = 0;
  const app = await lookupApp(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    if (calls === 2) return { ok: false };
    if (calls === 3) return { ok: true, json: async () => ({ maps: 'invalid', committed: {} }) };
    return { ok: true, json: async () => ({ maps: ['org/repo'], committed: {} }) };
  });
  for (let expected = 1; expected <= 3; expected++) {
    app.submit('org/repo');
    await nextTurn();
    assert.equal(calls, expected);
  }
  app.submit('org/repo');
  await nextTurn();
  assert.equal(calls, 4);
  assert.equal(app.location.assigned, '/org/repo/');
});

test('the removal page names the three ways, the 24 hours, and posts to the removals route', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const html = readFileSync(join(site(), 'map/remove/index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /within 24 hours/);
  assert.match(html, /Commit COMPLEX\.md/);
  assert.match(html, /<code>hosted: false<\/code>/);
  assert.match(html, /<textarea id="remove-note" name="note"[^>]*maxlength="2000"/);
  assert.match(html, /<label for="remove-repo">/);
  assert.match(html, /id="remove-status"[^>]*role="status"/);
  assert.match(html, /<script type="module" src="\/remove\.js"><\/script>/);
  const js = readFileSync(join(ROOT, 'site/remove.js'), 'utf8');
  assert.match(js, /'\/api\/complexmd\/removals'/);
  assert.match(js, /2000/);
});

test('the header and the home page hero link the /map page', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const f of ['index.html', 'spec/index.html', 'map/index.html', '404.html']) {
    const html = readFileSync(join(site(), f), 'utf8');
    const header = html.slice(html.indexOf('<header class="site-header">'), html.indexOf('</header>'));
    assert.match(header, /<a class="nav" href="\/map\/">Map<\/a>/, f);
  }
  const home = readFileSync(join(site(), 'index.html'), 'utf8');
  const hero = home.slice(home.indexOf('<section class="hero">'), home.indexOf('</section>'));
  assert.match(hero, /href="\/map\/"/);
});
