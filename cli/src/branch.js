// Regeneration on the default branch only. When CI builds this repository
// and the build is a pull request or a branch other than the default one,
// generate and wire write nothing. Generated files that change on every
// branch conflict at every merge, and a pull request that rewrites the
// briefs changes what review bots read about its own files.
//
// A build counts as one of this repository only when the commit it builds
// is the repository's HEAD, so a CI job that creates other repositories,
// such as this package's own tests, is not affected. Only environment
// variables and local files are read; no network call is made.
import { readFileSync } from 'node:fs';
import { git } from './git.js';

const head = (root) => git(['rev-parse', 'HEAD'], { cwd: root, allowFail: true }).trim();

function githubDefault(env) {
  if (env.COMPLEX_MD_DEFAULT_BRANCH) return env.COMPLEX_MD_DEFAULT_BRANCH;
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.repository?.default_branch || null;
  } catch {
    return null;
  }
}

/**
 * Why this run must not regenerate, or null when it may. `env` is
 * process.env in the CLI and a plain object in tests.
 */
export function regenerationBlocked(root, env = process.env) {
  const tail = 'regeneration runs on the default branch only, so nothing was written.';
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_SHA && head(root) === env.GITHUB_SHA) {
    if (env.GITHUB_HEAD_REF || /^pull_request/.test(env.GITHUB_EVENT_NAME || '')) return `complex-md: this is a pull request build; ${tail}`;
    const branch = (env.GITHUB_REF || '').startsWith('refs/heads/') ? env.GITHUB_REF_NAME || env.GITHUB_REF.slice(11) : null;
    const main = githubDefault(env);
    if (!main) return `complex-md: the default branch of this build is unknown; set COMPLEX_MD_DEFAULT_BRANCH. ${tail[0].toUpperCase()}${tail.slice(1)}`;
    if (branch !== main) return `complex-md: this build is of ${branch || env.GITHUB_REF || 'a detached commit'}, not the default branch ${main}; ${tail}`;
    return null;
  }
  if (env.GITLAB_CI === 'true' && env.CI_COMMIT_SHA && head(root) === env.CI_COMMIT_SHA) {
    if (env.CI_MERGE_REQUEST_IID) return `complex-md: this is a merge request pipeline; ${tail}`;
    const main = env.COMPLEX_MD_DEFAULT_BRANCH || env.CI_DEFAULT_BRANCH;
    if (!main || env.CI_COMMIT_BRANCH !== main) return `complex-md: this pipeline is of ${env.CI_COMMIT_BRANCH || env.CI_COMMIT_REF_NAME || 'a tag or commit'}, not the default branch ${main || '(unknown)'}; ${tail}`;
  }
  return null;
}
