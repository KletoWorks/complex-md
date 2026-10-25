// Regeneration writes on the default branch only when CI runs it. A pull
// request or feature branch build that rewrote COMPLEX.md and the wiring
// would put generated changes into every branch and conflict at merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { regenerationBlocked } from '../src/branch.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const GIT_ENV = { GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

function committed() {
  const dir = repo({ 'src/a.js': 'export const a = 1;\n' }, { git: ['-b', 'main'] });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env: { ...process.env, ...GIT_ENV } });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  return { dir, sha };
}

function eventFile(defaultBranch) {
  const p = join(mkdtempSync(join(tmpdir(), 'cx-event-')), 'event.json');
  writeFileSync(p, JSON.stringify({ repository: { default_branch: defaultBranch } }));
  return p;
}

test('outside CI nothing is blocked', () => {
  const { dir } = committed();
  assert.equal(regenerationBlocked(dir, {}), null);
});

test('GitHub Actions: a push to the default branch regenerates; another branch or a pull request does not', () => {
  const { dir, sha } = committed();
  const base = { GITHUB_ACTIONS: 'true', GITHUB_SHA: sha, GITHUB_EVENT_PATH: eventFile('main') };
  assert.equal(regenerationBlocked(dir, { ...base, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REF_NAME: 'main' }), null);
  assert.match(regenerationBlocked(dir, { ...base, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/topic', GITHUB_REF_NAME: 'topic' }), /topic.*default branch main/);
  assert.match(regenerationBlocked(dir, { ...base, GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'topic', GITHUB_REF: 'refs/pull/7/merge' }), /pull request/);
});

test('GitHub Actions on another checkout, such as a test repository, is not this build', () => {
  const { dir } = committed();
  assert.equal(regenerationBlocked(dir, { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'f'.repeat(40), GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'x' }), null);
});

/* A workflow that checks out the pull request's head, as one that commits
   the regenerated files back must, builds a commit other than GITHUB_SHA.
   The checkout still sits in GITHUB_WORKSPACE, so the build is still this
   repository's. */
test('a pull request build that checked out its head branch is still this build', () => {
  const { dir } = committed();
  const other = 'f'.repeat(40);
  assert.match(regenerationBlocked(dir, { GITHUB_ACTIONS: 'true', GITHUB_SHA: other, GITHUB_WORKSPACE: dir, GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'topic' }), /pull request/);
  assert.match(regenerationBlocked(join(dir, 'src'), { GITHUB_ACTIONS: 'true', GITHUB_SHA: other, GITHUB_WORKSPACE: dir, GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'topic' }), /pull request/);
  assert.match(regenerationBlocked(dir, { GITLAB_CI: 'true', CI_COMMIT_SHA: other, CI_PROJECT_DIR: dir, CI_MERGE_REQUEST_IID: '3' }), /merge request/);
  const elsewhere = committed().dir;
  assert.equal(regenerationBlocked(elsewhere, { GITHUB_ACTIONS: 'true', GITHUB_SHA: other, GITHUB_WORKSPACE: dir, GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'topic' }), null);
});

test('GitHub Actions without a known default branch does not regenerate', () => {
  const { dir, sha } = committed();
  const env = { GITHUB_ACTIONS: 'true', GITHUB_SHA: sha, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REF_NAME: 'main' };
  assert.match(regenerationBlocked(dir, env), /COMPLEX_MD_DEFAULT_BRANCH/);
  assert.equal(regenerationBlocked(dir, { ...env, COMPLEX_MD_DEFAULT_BRANCH: 'main' }), null);
});

test('GitLab CI: the default branch regenerates; a merge request pipeline does not', () => {
  const { dir, sha } = committed();
  const base = { GITLAB_CI: 'true', CI_COMMIT_SHA: sha, CI_DEFAULT_BRANCH: 'main' };
  assert.equal(regenerationBlocked(dir, { ...base, CI_COMMIT_BRANCH: 'main' }), null);
  assert.match(regenerationBlocked(dir, { ...base, CI_COMMIT_BRANCH: 'topic' }), /topic/);
  assert.match(regenerationBlocked(dir, { ...base, CI_MERGE_REQUEST_IID: '3' }), /merge request/);
});

test('a pull request build of the bin writes nothing and exits 0', () => {
  const { dir, sha } = committed();
  const before = snapshot(dir);
  const env = { ...process.env, ...GIT_ENV, GIT_CEILING_DIRECTORIES: dirname(dir), GITHUB_ACTIONS: 'true', GITHUB_SHA: sha, GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'topic' };
  for (const k of Object.keys(env)) if (/_API_KEY$|^COMPLEX_MD_/.test(k)) delete env[k];
  for (const args of [['--yes'], ['wire']]) {
    const r = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8', env, input: '' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /default branch only/);
  }
  assert.deepEqual(snapshot(dir), before);
});

/* The edit hooks read the map; they never regenerate it or rewire. */
test('the hook handler imports neither generate nor wire', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hook.js'), 'utf8');
  assert.doesNotMatch(src, /from '\.\/(generate|wire|plan)\.js'/);
  assert.ok(existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hook.js')));
});
