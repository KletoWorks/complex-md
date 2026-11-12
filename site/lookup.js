// The /map page. Reads what the visitor pasted, then asks /maps/index.json
// where the repository goes: a hosted page opens, a repository that commits
// its own COMPLEX.md links to that file, and any other repository gets the
// npx command and a button that requests a map. Hosted pages cover GitHub
// first, so a GitLab, Codeberg or Bitbucket repository skips the index and
// goes straight to the command and the request, which names its host. Every
// message is written with textContent, so nothing a visitor types becomes
// markup.
import { normaliseRepo, repoAddress, HOST_NAMES } from './repo-name.js';

const form = document.getElementById('map-form');
const input = document.getElementById('repo');
const result = document.getElementById('map-result');
const unmapped = document.getElementById('map-unmapped');
const unmappedText = document.getElementById('unmapped-text');
const requestBtn = document.getElementById('request-btn');
const requestStatus = document.getElementById('request-status');

const MESSAGES = {
  empty: 'Paste a repository: owner/name or a repository URL.',
  host: 'complex.md reads repositories on GitHub, GitLab, Codeberg and Bitbucket. That address points somewhere else.',
  shape: 'That does not read as a repository. Use owner/name or a repository URL.',
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

// The repository on screen: { host, key, id, label }. id is what a late
// response checks against, label is how messages name the repository.
let current = null;
const isGithub = (r) => r.host === 'github';

/** Show the command and the request button for a repository with no page. */
function offer(text) {
  unmappedText.textContent = text;
  requestBtn.disabled = false;
  requestBtn.textContent = 'Request a map';
  unmapped.hidden = false;
}

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
  const id = `${r.host}:${r.key}`;
  if (!isGithub(r)) {
    const label = repoAddress(r);
    current = { ...r, id, label };
    result.textContent = '';
    offer(`Hosted pages cover GitHub repositories first, so ${label} on ${HOST_NAMES[r.host]} has no hosted page yet. Run the command below in a clone of the repository, or ask for a map.`);
    return;
  }
  current = { ...r, id, label: r.key };
  say(`Looking up ${r.key}.`);
  const index = await loadIndex();
  if (!current || current.id !== id) return;
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
  offer(`No hosted map of ${r.key} yet. Run the command below in a clone of the repository, or ask for a map.`);
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

async function request() {
  const repo = current;
  if (!repo) return;
  const { key, host, label } = repo;
  const isCurrent = () => current !== null && current.id === repo.id;
  const done = (text) => { if (isCurrent()) requestStatus.textContent = text; };
  // GitHub keeps the key it always had, so earlier requests still count.
  const stored = isGithub(repo) ? `cx-requested:${key}` : `cx-requested:${host}:${key}`;
  const why = isGithub(repo)
    ? 'Requests decide which repositories get a hosted map next.'
    : `Hosted pages cover GitHub first. Requests for ${HOST_NAMES[host]} repositories are counted.`;
  if (store.get(stored)) {
    requestBtn.disabled = true;
    return done(`Already requested from this browser. ${why}`);
  }
  requestBtn.disabled = true;
  done('Sending the request.');
  let res;
  let body = null;
  try {
    res = await fetch('/api/complexmd/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: key, host }),
    });
    body = await res.json().catch(() => null);
  } catch {
    if (!isCurrent()) return;
    requestBtn.disabled = false;
    return done('The request did not go through. Check the connection and try again.');
  }
  if (res.status === 202 && body && body.ok) {
    store.set(stored, '1');
    if (!isCurrent()) return;
    requestBtn.textContent = 'Requested';
    return done(body.already
      ? `${label} was already requested. ${why}`
      : `Request recorded for ${label}. ${why}`);
  }
  if (res.status === 429 || (body && body.error === 'rate_limited')) {
    if (!isCurrent()) return;
    requestBtn.disabled = false;
    return done('Too many requests from this network. Try again later.');
  }
  if (res.status === 400) return done('complex.md could not read that repository name.');
  if (!isCurrent()) return;
  requestBtn.disabled = false;
  return done('The request did not go through. Try again later.');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const r = normaliseRepo(input.value);
  // Keep the address shareable: /map/?repo=owner/name opens the same answer.
  if (r.key) history.replaceState(null, '', `/map/?repo=${isGithub(r) ? r.key : repoAddress(r)}`);
  lookup(input.value);
});
requestBtn.addEventListener('click', request);

// A form sent without this script, or a shared link, carries ?repo=.
const initial = new URLSearchParams(location.search).get('repo');
if (initial) {
  input.value = initial;
  lookup(initial);
}
