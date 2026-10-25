// Read what a visitor pastes as a repository: owner/name, a repository URL,
// a git URL or an SSH remote. Returns { host, key } on success: host is
// github, gitlab, codeberg or bitbucket, and key is the lower case path that
// names the repository on that host (owner/name; on GitLab, 1 to 3 group
// segments and the project). A bare owner/name is a GitHub repository.
// Returns { error } with "empty", "host" (none of the four hosts) or "shape"
// (not a repository path). The /map page and the removal form import it; the
// tests import it too. The name rules match the ones the request route
// checks, so a key this function accepts is a key the route accepts.

// GitHub: an owner is 1 to 39 letters, digits or single hyphens, with no
// hyphen at either end; a repository name is 1 to 100 letters, digits, dots,
// hyphens or underscores, and never . or ..
const OWNER = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
const NAME = /^[a-z0-9._-]{1,100}$/;
// GitLab: a group or project segment starts with a letter, digit, _ or .,
// holds letters, digits, _ . -, and never ends in .git or .atom. A group
// segment never ends in a dot.
const GITLAB_GROUP = /^(?:[a-z0-9_.][a-z0-9_.-]{0,253}[a-z0-9_-]|[a-z0-9_])$/;
const GITLAB_PROJECT = /^[a-z0-9_.][a-z0-9_.-]{0,254}$/;
// Codeberg: an owner of at most 40 letters and digits with single - _ .
// between them; a name like GitHub's.
const CODEBERG_OWNER = /^[a-z0-9](?:[a-z0-9]|[-_.](?=[a-z0-9])){0,39}$/;
// Bitbucket: a workspace of letters, digits, - and _; a slug of letters,
// digits, . _ -; both at most 62 characters.
const BITBUCKET_WORKSPACE = /^[a-z0-9_-]{1,62}$/;
const BITBUCKET_SLUG = /^[a-z0-9._-]{1,62}$/;

/** The address of each host, as a visitor types it. */
export const HOST_DOMAINS = { github: 'github.com', gitlab: 'gitlab.com', codeberg: 'codeberg.org', bitbucket: 'bitbucket.org' };
/** The name of each host in a sentence. */
export const HOST_NAMES = { github: 'GitHub', gitlab: 'GitLab', codeberg: 'Codeberg', bitbucket: 'Bitbucket' };

const BY_DOMAIN = { 'github.com': 'github', 'complex.md': 'github', 'gitlab.com': 'gitlab', 'codeberg.org': 'codeberg', 'bitbucket.org': 'bitbucket' };
const dots = (s) => s === '.' || s === '..';

function keyOf(host, segs) {
  if (host === 'gitlab') {
    // GitLab puts "-" between the project and its subpages: /group/project/-/tree/main.
    const cut = segs.indexOf('-');
    const path = cut === -1 ? segs : segs.slice(0, cut);
    if (path.length < 2 || path.length > 4) return null;
    path[path.length - 1] = path[path.length - 1].replace(/\.git$/, '');
    const project = path[path.length - 1];
    const groups = path.slice(0, -1);
    const suffix = (s) => /\.(git|atom)$/.test(s) || dots(s);
    if (!groups.every((g) => GITLAB_GROUP.test(g) && !suffix(g)) || !GITLAB_PROJECT.test(project) || suffix(project)) return null;
    return path.join('/');
  }
  if (segs.length < 2) return null;
  const owner = segs[0];
  const name = segs[1].replace(/\.git$/, '');
  if (dots(name)) return null;
  if (host === 'github' && OWNER.test(owner) && NAME.test(name)) return `${owner}/${name}`;
  if (host === 'codeberg' && CODEBERG_OWNER.test(owner) && NAME.test(name)) return `${owner}/${name}`;
  if (host === 'bitbucket' && BITBUCKET_WORKSPACE.test(owner) && BITBUCKET_SLUG.test(name)) return `${owner}/${name}`;
  return null;
}

export function normaliseRepo(input) {
  let s = String(input ?? '').trim();
  if (!s) return { error: 'empty' };
  if (s.length > 300) return { error: 'shape' };
  s = s.replace(/^git\+/i, '');
  let domain = 'github.com';
  let path = s;
  let m;
  if ((m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.*)$/i.exec(s))) {
    // https://, http://, ssh://, git://
    [, domain, path] = m;
  } else if ((m = /^(?:[\w.-]+@)?([a-z0-9-]+(?:\.[a-z0-9-]+)+):(?!\/)(.*)$/i.exec(s))) {
    // An SSH remote: git@github.com:owner/name.git
    [, domain, path] = m;
  } else if ((m = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/(.*)$/i.exec(s))) {
    // A host with no scheme: github.com/owner/name, or another host. An
    // owner never holds a dot, so a dotted first segment is a host.
    [, domain, path] = m;
  }
  domain = domain.toLowerCase().replace(/^www\./, '');
  const host = BY_DOMAIN[domain];
  if (!host) return { error: 'host', host: domain };
  const segs = path.split(/[?#]/)[0].toLowerCase().split('/').filter(Boolean);
  const key = keyOf(host, segs);
  return key ? { host, key } : { error: 'shape' };
}

/** The address that names a repository on its host, without a scheme: gitlab.com/group/project. */
export const repoAddress = (r) => `${HOST_DOMAINS[r.host]}/${r.key}`;
