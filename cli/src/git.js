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
