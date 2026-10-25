// Regeneration on the default branch only. When CI builds this repository
// and the build is a pull request or a branch other than the default one,
// generate and wire write nothing. Generated files that change on every
// branch conflict at every merge, and a pull request that rewrites the
// briefs changes what review bots read about its own files.
//
// A build counts as one of this repository when the commit it builds is
// the repository's HEAD, or when the repository is the CI checkout
// (GITHUB_WORKSPACE, CI_PROJECT_DIR). A workflow that checks out a pull
// request's head branch builds a commit other than GITHUB_SHA, and the
// second test still finds it. A CI job that creates other repositories
// outside the checkout, such as this package's own tests, is not
// affected. Only environment variables and local files are read; no
// network call is made.
import { readFileSync, realpathSync } from 'node:fs';
import { sep } from 'node:path';
import { git } from './git.js';

const head = (root) => git(['rev-parse', 'HEAD'], { cwd: root, allowFail: true }).trim();
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};
/* `root` is the checkout `dir`, or a folder inside it. */
const within = (root, dir) => {
  const [r, d] = [real(root), dir && real(dir)];
  return !!(r && d && (r === d || r.startsWith(d.endsWith(sep) ? d : d + sep)));
};
const thisBuild = (root, sha, dir) => (!!sha && head(root) === sha) || within(root, dir);

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
  if (env.GITHUB_ACTIONS === 'true' && thisBuild(root, env.GITHUB_SHA, env.GITHUB_WORKSPACE)) {
    if (env.GITHUB_HEAD_REF || /^pull_request/.test(env.GITHUB_EVENT_NAME || '')) return `complex-md: this is a pull request build; ${tail}`;
    const branch = (env.GITHUB_REF || '').startsWith('refs/heads/') ? env.GITHUB_REF_NAME || env.GITHUB_REF.slice(11) : null;
    const main = githubDefault(env);
    if (!main) return `complex-md: the default branch of this build is unknown; set COMPLEX_MD_DEFAULT_BRANCH. ${tail[0].toUpperCase()}${tail.slice(1)}`;
    if (branch !== main) return `complex-md: this build is of ${branch || env.GITHUB_REF || 'a detached commit'}, not the default branch ${main}; ${tail}`;
    return null;
  }
  if (env.GITLAB_CI === 'true' && thisBuild(root, env.CI_COMMIT_SHA, env.CI_PROJECT_DIR)) {
    if (env.CI_MERGE_REQUEST_IID) return `complex-md: this is a merge request pipeline; ${tail}`;
    const main = env.COMPLEX_MD_DEFAULT_BRANCH || env.CI_DEFAULT_BRANCH;
    if (!main || env.CI_COMMIT_BRANCH !== main) return `complex-md: this pipeline is of ${env.CI_COMMIT_BRANCH || env.CI_COMMIT_REF_NAME || 'a tag or commit'}, not the default branch ${main || '(unknown)'}; ${tail}`;
  }
  return null;
}
