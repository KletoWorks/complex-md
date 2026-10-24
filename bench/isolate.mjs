// A task's checkout holds the history up to its base commit and nothing
// after it.
//
// The harness used to give each run a `git worktree` of the dataset clone.
// A worktree shares the clone's object store and refs, so `git log --all`,
// `git log HEAD..origin/main`, tags, the stash and the reflog all reached
// commits after the task's base, the real fix among them. Agents found it.
// A fresh repository fetched from the clone at the base commit has only
// the objects that commit reaches: no other refs, no tags, no reflog of the
// clone, and no pointer back to it.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

function git(cwd, args, { input } = {}) {
  const r = spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/** A new repository at `dest` with branch main at `base` checked out. Throws if anything after `base` is in it. */
export function isolatedCheckout(src, base, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  git(dest, ['init', '-q', '-b', 'main']);
  /* Fetch by object id. upload-pack refuses an id no ref advertises unless
     told otherwise; the setting goes on the server side of the fetch. */
  git(dest, ['fetch', '-q', '--no-tags', '--no-write-fetch-head', '--update-head-ok',
    '--upload-pack=git -c uploadpack.allowAnySHA1InWant=true upload-pack', src, `+${base}:refs/heads/main`]);
  git(dest, ['reset', '-q', '--hard', 'main']);
  git(dest, ['reflog', 'expire', '--expire=now', '--all']);
  assertNoFuture(dest, base);
  return dest;
}

/** Throws when the repository holds a ref or an object that `base` does not reach. */
export function assertNoFuture(repo, base) {
  const reach = new Set(git(repo, ['rev-list', '--objects', base]).split('\n').map((l) => l.split(' ')[0]).filter(Boolean));
  const all = git(repo, ['cat-file', '--batch-all-objects', '--batch-check=%(objectname)']).split('\n').filter(Boolean);
  const extra = all.filter((o) => !reach.has(o));
  if (extra.length) throw new Error(`isolation: ${extra.length} objects not reachable from ${base.slice(0, 10)}, e.g. ${extra.slice(0, 3).join(' ')}`);
  for (const line of git(repo, ['for-each-ref', '--format=%(objectname) %(refname)']).split('\n').filter(Boolean)) {
    const [sha, ref] = line.split(' ');
    if (!reach.has(sha)) throw new Error(`isolation: ref ${ref} points outside the history of ${base.slice(0, 10)}`);
  }
}

/** The bytes of `path` at `rev` in `src`, or null when the path does not exist there. */
export function fileAt(src, rev, path) {
  const r = spawnSync('git', ['show', `${rev}:${path}`], { cwd: src, maxBuffer: 1 << 30 });
  return r.status === 0 ? r.stdout : null;
}
