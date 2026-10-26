// Partial clones: a blobless or treeless clone has commits but not every
// blob or tree. Any git command that needs a missing object fetches it from
// the promisor remote, one object at a time. Each clone here points its
// remote at a path that does not exist, so a fetch fails instead of
// succeeding in silence. No network: the source repository is local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { computeSignals } from '../src/signals.js';
import { stopAdvice } from '../src/hook.js';
import { runExposure } from '../src/exposure.js';

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x', GIT_TERMINAL_PROMPT: '0' };
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe', env: ENV, encoding: 'utf8' });

// Three commits: add src/a.js, edit it, then rename it to src/b.js with an
// edit. The last one is an inexact rename, so detecting it reads the old
// blob of src/a.js, which a blobless clone does not have.
function sourceRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-src-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'uploadpack.allowFilter', 'true');
  mkdirSync(join(dir, 'src'));
  const body = (n) => Array.from({ length: 40 }, (_, i) => `export const v${i} = ${i};`).join('\n') + `\n// rev ${n}\n`;
  writeFileSync(join(dir, 'src/a.js'), body(1));
  writeFileSync(join(dir, 'src/main.js'), "import './b.js';\n");
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'add a');
  writeFileSync(join(dir, 'src/a.js'), body(2));
  git(dir, 'commit', '-q', '-am', 'fix: edit a');
  git(dir, 'mv', 'src/a.js', 'src/b.js');
  writeFileSync(join(dir, 'src/b.js'), body(3));
  git(dir, 'commit', '-q', '-am', 'rename a to b');
  return dir;
}

function partialClone(filter, { refetch = false } = {}) {
  const src = sourceRepo();
  const dir = join(mkdtempSync(join(tmpdir(), 'cx-partial-')), 'clone');
  execFileSync('git', ['clone', '-q', '--no-local', `--filter=${filter}`, `file://${src}`, dir], { stdio: 'pipe', env: ENV });
  git(dir, 'config', 'gc.auto', '0');
  if (refetch) git(dir, 'fetch', '-q', '--refetch', '--filter=blob:none', 'origin');
  git(dir, 'remote', 'set-url', 'origin', `file://${src}-gone`);
  return dir;
}

test('blobless clone: reading history fetches no blobs', () => {
  const dir = partialClone('blob:none');
  const s = computeSignals(dir);
  assert.equal(s.window_commits, 3);
  assert.ok(s.table.some((r) => r.path === 'src/b.js' && r.churn === 1), JSON.stringify(s.table));
});

test('blobless clone: the Stop hook lists session commits without fetching blobs', () => {
  const dir = partialClone('blob:none');
  const map = '---\ncomplex_md: "0.3"\nhotspots:\n  - path: src/b.js\n    kind: source\n    loc: 41\n    churn: 1\n    churn_w: 1.00\n    fixes: 1\n    authors: 1\n    owner_share: 1.00\n    fan_in: 1\n    tests: 0\n    score: 100\n---\n\n## Where the risk lives\n\nsrc/b.js.\n\n## Why these files are hot\n\nsrc/b.js is hot. Before editing this file, run npm test.\n\n## Change coupling\n\nnone\n\n## What to read first\n\n1. src/b.js\n';
  writeFileSync(join(dir, 'COMPLEX.md'), map);
  const advice = stopAdvice(dir, { started: new Date(Date.now() - 3600 * 1000).toISOString(), acknowledged: [] });
  assert.match(advice || '', /src\/b\.js/, 'the commits made since the session started name src/b.js');
});

test('blobless clone: the exposure history walk is skipped and declared, and fetches nothing', async () => {
  const dir = partialClone('blob:none');
  const objects = () => git(dir, 'count-objects', '-v');
  const before = objects();
  const r = await runExposure(dir, { version: 'test' });
  assert.equal(r.scope.history.mode, 'skipped');
  assert.ok(r.blind_spots.some((b) => /partial clone \(filter blob:none\)/.test(b) && /fetch each missing blob/.test(b)), JSON.stringify(r.blind_spots));
  assert.equal(r.scope.files.read, 2, 'the checked out tree is still scanned');
  assert.equal(objects(), before, 'no object was fetched');
});

test('treeless clone: history is skipped and declared, not fetched one tree at a time', () => {
  const dir = partialClone('tree:0');
  const s = computeSignals(dir);
  assert.equal(s.window_commits, 0);
  assert.ok(s.blind_spots.some((b) => /treeless clone/.test(b) && /git fetch --refetch --filter=blob:none/.test(b)), JSON.stringify(s.blind_spots));
  assert.equal(s.files_analyzed, 2, 'the working tree is still analyzed');
  assert.equal(s.profile.dependency_edges, 1);
});

test('treeless clone after the advised refetch: history is read again', () => {
  const dir = partialClone('tree:0', { refetch: true });
  const s = computeSignals(dir);
  assert.equal(s.window_commits, 3);
  assert.ok(!s.blind_spots.some((b) => /treeless/.test(b)), JSON.stringify(s.blind_spots));
});
