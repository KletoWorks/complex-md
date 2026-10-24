import { execFileSync, spawnSync } from 'node:child_process';

export function git(args, { cwd, maxBuffer = 512 * 1024 * 1024, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  }
  return r.stdout || '';
}

export function repoRoot(cwd = process.cwd()) {
  try {
    // stderr is dropped: git's own "fatal: not a git repository" line must
    // not print before the caller's message.
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** True when the repository has at least one commit (HEAD resolves). */
export function hasCommits(cwd) {
  const r = spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0;
}

/** True when ref names a commit in this checkout. */
export function resolvesCommit(cwd, ref) {
  const r = spawnSync('git', ['rev-parse', '--verify', '-q', '--end-of-options', `${ref}^{commit}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0;
}

export function shortSha(cwd) {
  return git(['rev-parse', '--short', 'HEAD'], { cwd }).trim();
}

export function trackedFiles(cwd) {
  return git(['ls-files', '-z'], { cwd }).split('\0').filter(Boolean);
}

/** Files changed relative to a base ref, or the working tree (staged + unstaged + untracked) when base is null. */
export function changedFiles(cwd, { base = null, staged = false } = {}) {
  const out = new Set();
  if (base) {
    git(['diff', '--name-only', '-z', `${base}...HEAD`], { cwd, allowFail: true }).split('\0').filter(Boolean).forEach((f) => out.add(f));
    git(['diff', '--name-only', '-z', base], { cwd, allowFail: true }).split('\0').filter(Boolean).forEach((f) => out.add(f));
  } else if (staged) {
    git(['diff', '--name-only', '-z', '--cached'], { cwd }).split('\0').filter(Boolean).forEach((f) => out.add(f));
  } else {
    git(['diff', '--name-only', '-z', 'HEAD'], { cwd, allowFail: true }).split('\0').filter(Boolean).forEach((f) => out.add(f));
    git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd, allowFail: true }).split('\0').filter(Boolean).forEach((f) => out.add(f));
  }
  return [...out];
}

/** The object filter of a partial clone (`blob:none`, `tree:0`), or '' for a full clone or outside a repository. */
export function partialCloneFilter(cwd) {
  return git(['config', '--get-regexp', '^remote\\..*\\.partialclonefilter$'], { cwd, allowFail: true }).trim().split(/\s+/)[1] || '';
}

/* Rename detection compares file contents. A partial clone lacks most old
   blobs and fetches each one from its remote on demand: 155 fetches and
   10.1 s for 2,000 commits of a blobless flask clone. -M100% keeps the
   exact renames, which git pairs by object id without reading a blob:
   0.12 s and the same tracked paths in all 2,000 commits. A full clone
   keeps git's default. */
export function historyRenameArgs(cwd) {
  return partialCloneFilter(cwd) ? ['-M100%'] : [];
}
