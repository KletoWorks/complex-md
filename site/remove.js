// The removal form at /map/remove. Fills the repository from ?repo=, reads
// it the same way /map does, and posts the request as JSON to the removals
// route. Every message is written with textContent.
import { normaliseRepo } from './repo-name.js';

const form = document.getElementById('remove-form');
const repo = document.getElementById('remove-repo');
const note = document.getElementById('remove-note');
const status = document.getElementById('remove-status');
const button = form.querySelector('button[type=submit]');

const MAX_NOTE = 2000;
const say = (text) => { status.textContent = text; };

const initial = new URLSearchParams(location.search).get('repo');
if (initial) {
  const r = normaliseRepo(initial);
  repo.value = r.key || initial;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = normaliseRepo(repo.value);
  if (r.error) {
    repo.setAttribute('aria-invalid', 'true');
    repo.focus();
    return say(r.error === 'host'
      ? 'complex.md hosts pages for repositories on GitHub only. That address points somewhere else.'
      : 'Enter the repository as owner/name or a GitHub URL.');
  }
  repo.removeAttribute('aria-invalid');
  const text = note.value.trim().slice(0, MAX_NOTE);
  button.disabled = true;
  say('Sending the request.');
  let res;
  try {
    res = await fetch('/api/complexmd/removals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(text ? { repo: r.key, note: text } : { repo: r.key }),
    });
  } catch {
    button.disabled = false;
    return say('The request did not go through. Check the connection and try again.');
  }
  button.disabled = false;
  if (res.status === 202) return say(`Request recorded. The page of ${r.key} goes away within 24 hours.`);
  if (res.status === 429) return say('Too many requests from this network. Try again later.');
  if (res.status === 400) return say('complex.md could not read that repository name. Enter it as owner/name.');
  return say('The request did not go through. Try again later.');
});
