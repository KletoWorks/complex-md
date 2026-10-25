// Read what a visitor pastes as a repository: owner/name, a github.com URL,
// a git URL or an SSH remote. Returns { key } with the lower case
// owner/name that hosted pages live under, or { error } with "empty",
// "host" (not GitHub) or "shape" (not a repository name). The /map page
// and the removal form import it; the tests import it too.

// GitHub's rules: an owner is 1 to 39 letters, digits or single hyphens,
// with no hyphen at either end; a repository name is 1 to 100 letters,
// digits, dots, hyphens or underscores, and never . or ..
const OWNER = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
const NAME = /^[a-z0-9._-]{1,100}$/;

export function normaliseRepo(input) {
  let s = String(input ?? '').trim();
  if (!s) return { error: 'empty' };
  if (s.length > 300) return { error: 'shape' };
  s = s.replace(/^git\+/i, '');
  let host = 'github.com';
  let path = s;
  let m;
  if ((m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.*)$/i.exec(s))) {
    // https://, http://, ssh://, git://
    [, host, path] = m;
  } else if ((m = /^(?:[\w.-]+@)?([a-z0-9-]+(?:\.[a-z0-9-]+)+):(?!\/)(.*)$/i.exec(s))) {
    // An SSH remote: git@github.com:owner/name.git
    [, host, path] = m;
  } else if ((m = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/(.*)$/i.exec(s))) {
    // A host with no scheme: github.com/owner/name, or another host. An
    // owner never holds a dot, so a dotted first segment is a host.
    [, host, path] = m;
  }
  host = host.toLowerCase().replace(/^www\./, '');
  if (host !== 'github.com' && host !== 'complex.md') return { error: 'host', host };
  const segs = path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (segs.length < 2) return { error: 'shape' };
  const owner = segs[0].toLowerCase();
  const name = segs[1].replace(/\.git$/i, '').toLowerCase();
  if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') return { error: 'shape' };
  return { key: `${owner}/${name}` };
}
