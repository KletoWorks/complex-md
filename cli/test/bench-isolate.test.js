/* Isolation: a task's checkout must not reach any commit after its base.
   The fixture plants a marker in every later commit, on a tag, a branch, a
   remote tracking ref, a note and a stash. The leak probe tries each git
   route an agent has used to find a future fix. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildBenchRepo, git, MARKER, runHarness } from './fixtures/bench-repo.mjs';
import { isolatedCheckout, assertNoFuture, fileAt } from '../../bench/isolate.mjs';

const PROBE = join(import.meta.dirname, '..', '..', 'bench', 'leak-probe.mjs');

export function probe(cwd, env = {}) {
  const r = spawnSync(process.execPath, [PROBE], { cwd, encoding: 'utf8', env: { ...process.env, CX_PROBE_MARKER: MARKER, ...env } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === 'probe');
}
const gitRoutes = (events) => events.filter((e) => /^(git|\.git)/.test(e.route));
const leaks = (events) => events.filter((e) => e.leaked).map((e) => e.route);

test('control: a git worktree of the clone, as the harness used, reaches the future', () => {
  const fx = buildBenchRepo();
  try {
    const wt = join(fx.dir, 'wt');
    git(fx.repo, ['worktree', 'add', '-q', '--detach', wt, fx.base]);
    const found = leaks(gitRoutes(probe(wt)));
    for (const r of ['git log --all', 'git tag', 'git stash list', 'git cat-file --batch-all-objects']) assert.ok(found.includes(r), `${r} should leak in a shared worktree; leaked: ${found}`);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('an isolated checkout sits at the base with no git route to the future', () => {
  const fx = buildBenchRepo();
  try {
    const wt = isolatedCheckout(fx.repo, fx.base, join(fx.dir, 'iso'));
    assert.equal(git(wt, ['rev-parse', 'HEAD']), fx.base);
    /* The status is read with the git config isolatedCheckout used. git()
       leaves the global config out; with core.autocrlf=true in it the
       checkout has CRLF files, which git without it reads as edits. */
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: wt, encoding: 'utf8' }).stdout, '');
    assert.equal(git(wt, ['for-each-ref', '--format=%(refname)']), 'refs/heads/main');
    assert.doesNotMatch(readFileSync(join(wt, 'lib', 'a.js'), 'utf8'), new RegExp(MARKER));
    const events = gitRoutes(probe(wt));
    assert.ok(events.length >= 8);
    assert.deepEqual(leaks(events), []);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('the isolation check refuses a store that holds an object past the base', () => {
  const fx = buildBenchRepo();
  try {
    const wt = isolatedCheckout(fx.repo, fx.base, join(fx.dir, 'iso'));
    // Bring the fix in, then drop the ref: the objects stay in the store.
    git(wt, ['fetch', '-q', '--no-tags', '--upload-pack=git -c uploadpack.allowAnySHA1InWant=true upload-pack', fx.repo, `${fx.fix}:refs/heads/tmp`]);
    git(wt, ['update-ref', '-d', 'refs/heads/tmp']);
    assert.throws(() => assertNoFuture(wt, fx.base), /isolation: \d+ objects not reachable/);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('gold test files come from the clone at the fix commit, not from the checkout', () => {
  const fx = buildBenchRepo();
  try {
    assert.match(String(fileAt(fx.repo, fx.fix, 'test/fix.test.js')), /a string/);
    assert.equal(fileAt(fx.repo, fx.base, 'test/fix.test.js'), null);
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});

test('seeded leak test: no arm reaches the future through git or the checkout\'s links', () => {
  const fx = buildBenchRepo();
  try {
    const { status, stderr, rows, out } = runHarness(fx, ['--agent', 'probe', '--arms', 'none,front,file,hooks', '--stop-at', 'none', '--no-sandbox'], { env: { CX_PROBE_MARKER: MARKER } });
    assert.equal(status, 0, stderr);
    assert.deepEqual(rows.map((r) => r.arm), ['none', 'front', 'file', 'hooks']);
    for (const r of rows) assert.equal(r.error, null, `${r.arm}: ${r.error}`);
    const transcripts = readdirSync(join(out, 'transcripts'));
    assert.equal(transcripts.length, 4);
    for (const t of transcripts) {
      const events = readFileSync(join(out, 'transcripts', t), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === 'probe');
      assert.ok(events.length >= 9, t);
      assert.ok(events.some((e) => e.route.startsWith('read ')), 'the probe followed node_modules');
      assert.deepEqual(leaks(events), [], `${t} leaked`);
    }
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
});
