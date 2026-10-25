// The /map page. Reads what the visitor pasted, then asks /maps/index.json
// where the repository goes: a hosted page opens, a repository that commits
// its own COMPLEX.md links to that file, and any other repository gets the
// npx command and a button that requests a map. Every message is written
// with textContent, so nothing a visitor types becomes markup.
import { normaliseRepo } from './repo-name.js';

const form = document.getElementById('map-form');
const input = document.getElementById('repo');
const result = document.getElementById('map-result');
const unmapped = document.getElementById('map-unmapped');
const unmappedText = document.getElementById('unmapped-text');
const requestBtn = document.getElementById('request-btn');
const requestStatus = document.getElementById('request-status');

const MESSAGES = {
  empty: 'Paste a repository: owner/name or a GitHub URL.',
  host: 'complex.md maps repositories on GitHub. That address points somewhere else.',
  shape: 'That does not read as a GitHub repository. Use owner/name or a github.com URL.',
};

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    const promise = fetch('/maps/index.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && Array.isArray(j.maps) && j.committed && typeof j.committed === 'object' ? { maps: new Set(j.maps), committed: j.committed } : null))
      .catch(() => null)
      .then((index) => {
        if (!index && indexPromise === promise) indexPromise = null;
        return index;
      });
    indexPromise = promise;
  }
  return indexPromise;
}

/** Replace the result with text and, when given, one link. */
function say(text, link) {
  result.textContent = '';
  const p = document.createElement('p');
  p.textContent = text;
  if (link) {
    p.append(' ');
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    p.append(a);
  }
  result.append(p);
}

let current = null;

async function lookup(value) {
  unmapped.hidden = true;
  requestStatus.textContent = '';
  const r = normaliseRepo(value);
  if (r.error) {
    current = null;
    say(MESSAGES[r.error]);
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  current = r.key;
  say(`Looking up ${r.key}.`);
  const index = await loadIndex();
  if (current !== r.key) return;
  const url = index && index.committed[r.key];
  if (typeof url === 'string' && url.startsWith('https://github.com/')) {
    say(`${r.key} commits its own COMPLEX.md.`, { href: url, text: 'Open the file on GitHub' });
    return;
  }
  if (index && index.maps.has(r.key)) {
    say(`Opening the map of ${r.key}.`, { href: `/${r.key}/`, text: 'Open it' });
    location.assign(`/${r.key}/`);
    return;
  }
  result.textContent = '';
  if (!index) say('The list of hosted maps did not load, so this page cannot tell whether a map exists.');
  unmappedText.textContent = `No hosted map of ${r.key} yet. Run the command below in a clone of the repository, or ask for a map.`;
  requestBtn.disabled = false;
  requestBtn.textContent = 'Request a map';
  unmapped.hidden = false;
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

async function request() {
  const key = current;
  if (!key) return;
  const done = (text) => { requestStatus.textContent = text; };
  if (store.get(`cx-requested:${key}`)) {
    requestBtn.disabled = true;
    return done(`Already requested from this browser. Requests decide which repositories get a hosted map next.`);
  }
  requestBtn.disabled = true;
  done('Sending the request.');
  let res;
  let body = null;
  try {
    res = await fetch('/api/complexmd/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: key }),
    });
    body = await res.json().catch(() => null);
  } catch {
    requestBtn.disabled = false;
    return done('The request did not go through. Check the connection and try again.');
  }
  if (res.status === 202 && body && body.ok) {
    store.set(`cx-requested:${key}`, '1');
    requestBtn.textContent = 'Requested';
    return done(body.already
      ? `${key} was already requested. Requests decide which repositories get a hosted map next.`
      : `Request recorded for ${key}. Requests decide which repositories get a hosted map next.`);
  }
  if (res.status === 429 || (body && body.error === 'rate_limited')) {
    requestBtn.disabled = false;
    return done('Too many requests from this network. Try again later.');
  }
  if (res.status === 400) return done('complex.md could not read that repository name.');
  requestBtn.disabled = false;
  return done('The request did not go through. Try again later.');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const r = normaliseRepo(input.value);
  // Keep the address shareable: /map/?repo=owner/name opens the same answer.
  if (r.key) history.replaceState(null, '', `/map/?repo=${r.key}`);
  lookup(input.value);
});
requestBtn.addEventListener('click', request);

// A form sent without this script, or a shared link, carries ?repo=.
const initial = new URLSearchParams(location.search).get('repo');
if (initial) {
  input.value = initial;
  lookup(initial);
}
