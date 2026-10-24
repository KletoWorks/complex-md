// verify: the drift check. Each band edge is pinned on hand built states,
// then synthetic histories show the two properties that matter: small
// churn at a list boundary never flips the result, and real drift turns it
// on once and keeps it on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { diffMap, moved, verifyMap, formatVerify } from '../src/verify.js';
import { computeSignals } from '../src/signals.js';
import { frontMatter } from '../src/generate.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

/* ---------- pure comparisons on hand built states ---------- */

const row = (path, score, extra = {}) => ({ path, kind: 'source', loc: 100, churn: 4, churn_w: 4, fixes: 2, authors: 1, owner_share: 1, fan_in: 3, tests: 1, score, ...extra });
const pair = (a, b, count, coupling = 80) => ({ files: [a, b], count, coupling });

function state({ hotspots, rows = hotspots, co = [], pairs = co, lb = [], fanIn = {}, gone = [], profile = {}, cuts = {} }) {
  return {
    spec: '0.3',
    hotspots,
    rows: Object.fromEntries(rows.map((r) => [r.path, r])),
    load_bearing: lb,
    fanInOf: (p) => fanIn[p] ?? lb.find((h) => h.path === p)?.fan_in ?? 0,
    exists: (p) => !gone.includes(p),
    co_change: co,
    pairs: Object.fromEntries(pairs.map((c) => [[...c.files].sort().join('\t'), c])),
    seams: [],
    seamPairs: {},
    profile: { files_in_scope: 40, dependency_edges: 80, commits_analyzed: 200, ...profile },
    cuts: { hotspots: hotspots[hotspots.length - 1]?.score || 0, load_bearing: 5, co_change: 3, seams: 3, coupling: 34, ...cuts },
  };
}

const front = (hotspots, extra = {}) => ({ complex_md: '0.3', hotspots, load_bearing: [], co_change: [], seams: [], profile: { files_in_scope: 40, dependency_edges: 80, commits_analyzed: 200 }, ...extra });
const brief = (drift) => drift.map((d) => [d.list, d.change, d.path || d.field || (d.files || d.dirs).join('+')]);

test('moved needs both the relative share and the absolute step', () => {
  assert.equal(moved(2, 3, 0.5, 3), false, '+50% but one unit');
  assert.equal(moved(2, 6, 0.5, 3), true);
  assert.equal(moved(100, 140, 0.5, 3), false, '40 units but +40%');
  assert.equal(moved(100, 150, 0.5, 3), true);
  assert.equal(moved(null, 5, 0.5, 3), false, 'a missing old value is not drift');
});

test('a newcomer enters the hotspots only at 125% of the cut score or more', () => {
  const committed = front([row('a', 1000), row('b', 800), row('c', 400)]);
  const rest = [row('c', 400), row('b', 390)];
  const near = state({ hotspots: [row('a', 1000), row('d', 499), row('c', 400)], rows: [row('a', 1000), row('d', 499), ...rest] });
  assert.deepEqual(diffMap(committed, near), [], 'd at 1.2475 times the cut is churn');
  const far = state({ hotspots: [row('a', 1000), row('d', 500), row('c', 400)], rows: [row('a', 1000), row('d', 500), ...rest] });
  assert.deepEqual(brief(diffMap(committed, far)), [['hotspots', 'entered', 'd']]);
});

test('a listed hotspot leaves only under 75% of the cut score, or when its file is gone', () => {
  const committed = front([row('a', 1000), row('b', 800), row('c', 400)]);
  const hot = [row('a', 1000), row('d', 450), row('e', 400)];
  const edge = state({ hotspots: hot, rows: [...hot, row('b', 300), row('c', 299)] });
  assert.deepEqual(brief(diffMap(committed, edge)), [['hotspots', 'left', 'c']], 'b at exactly 75% of the cut stays listed');
  const deleted = state({ hotspots: hot, rows: [...hot, row('b', 390)], gone: ['c'] });
  const d = diffMap(committed, deleted);
  assert.deepEqual(brief(d), [['hotspots', 'left', 'c']]);
  assert.equal(d[0].gone, true);
  assert.match(formatVerify({ status: 'drift', map_commit: 'abc1234', head: 'def5678', commits_behind: 3, drift: d }), /- hotspots: c left \(the file is gone\)/);
});

test('numbers on a kept hotspot row drift only past both the share and the step', () => {
  const committed = front([row('a', 1000, { fixes: 2, fan_in: 5, loc: 200 })]);
  const small = state({ hotspots: [row('a', 1100, { fixes: 4, fan_in: 7, loc: 290 })] });
  assert.deepEqual(diffMap(committed, small), []);
  const big = state({ hotspots: [row('a', 1100, { fixes: 5, fan_in: 5, loc: 320 })] });
  assert.deepEqual(brief(diffMap(committed, big)), [['hotspots', 'moved', 'a'], ['hotspots', 'moved', 'a']]);
  assert.deepEqual(diffMap(committed, big).map((x) => x.field), ['fixes', 'loc']);
});

test('co_change pairs use the band on shared commits and 10 points on coupling', () => {
  const hot = [row('a', 1000)];
  const committed = front(hot, { co_change: [pair('a', 'b', 6), pair('c', 'd', 5)] });
  // cut 4 (a full list ends at 4): enter at 5, leave under 3.
  const quiet = state({ hotspots: hot, co: [pair('a', 'b', 7), pair('c', 'd', 4), pair('e', 'f', 4, 90)], cuts: { co_change: 4 } });
  assert.deepEqual(diffMap(committed, quiet), [], 'e+f at the cut has not cleared the band');
  const moving = state({ hotspots: hot, co: [pair('a', 'b', 8), pair('e', 'f', 5, 90), pair('g', 'h', 6, 40)], pairs: [pair('a', 'b', 8), pair('e', 'f', 5, 90), pair('g', 'h', 6, 40), pair('c', 'd', 2)], cuts: { co_change: 4 } });
  assert.deepEqual(brief(diffMap(committed, moving)), [['co_change', 'entered', 'e+f'], ['co_change', 'left', 'c+d']], 'g+h has the commits but coupling 40 is within 10 points of 34');
  const weak = state({ hotspots: hot, co: [pair('a', 'b', 8, 23)], pairs: [pair('a', 'b', 8, 23), pair('c', 'd', 5, 30)], cuts: { co_change: 4 } });
  assert.deepEqual(brief(diffMap(committed, weak)), [['co_change', 'left', 'a+b']], 'a+b fell 11 points under the floor; c+d only 4');
});

test('load_bearing uses the band on fan_in; profile counts on share and step', () => {
  const lbRow = (path, fan_in) => ({ path, kind: 'source', loc: 50, fan_in, tests: 0 });
  const committed = front([row('a', 1000)], { load_bearing: [lbRow('x', 8), lbRow('y', 6)] });
  const fresh = state({ hotspots: [row('a', 1000)], lb: [lbRow('x', 8), lbRow('z', 7), lbRow('w', 6)], fanIn: { y: 3 }, cuts: { load_bearing: 5 } });
  assert.deepEqual(brief(diffMap(committed, fresh)), [['load_bearing', 'entered', 'z'], ['load_bearing', 'left', 'y']], 'w at 6 is under 6.25; y at 3 is under 3.75');
  const counts = state({ hotspots: [row('a', 1000)], profile: { files_in_scope: 49, dependency_edges: 101, commits_analyzed: 290 } });
  assert.deepEqual(brief(diffMap(front([row('a', 1000)]), counts)), [['profile', 'moved', 'dependency_edges']]);
});

test('a map written in another spec version is drift', () => {
  assert.deepEqual(brief(diffMap(front([row('a', 1000)], { complex_md: '0.2' }), state({ hotspots: [row('a', 1000)] }))), [['spec', 'changed', 'complex_md']]);
});

/* ---------- synthetic histories ---------- */

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-verify-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, env: ENV });
  mkdirSync(join(dir, 'src'));
  return dir;
}

const lines = (n, tag) => Array.from({ length: n }, (_, i) => `export const v${i} = '${tag}';`).join('\n') + '\n';
let bump = 0;
/** Commit a change to each named file: its content changes, its size stays put. */
function touch(dir, files, msg = 'feat: change') {
  bump++;
  for (const [f, n] of Object.entries(files)) {
    const imp = f === 'src/core.js' ? '' : "import { v0 } from './core.js';\n";
    writeFileSync(join(dir, f), imp + lines(n, `${f}${bump}`));
  }
  execFileSync('git', ['add', '-A'], { cwd: dir, env: ENV });
  execFileSync('git', ['commit', '-q', '-m', `${msg} ${bump}`], { cwd: dir, env: ENV });
}

const SIZES = { 'src/core.js': 20, 'src/big.js': 80, 'src/x.js': 12, 'src/y.js': 12, 'src/z.js': 12, 'src/q.js': 12 };

/** core and big are clearly hot; x and y are twins competing for the third place, y one edit ahead. */
function boundaryRepo() {
  const dir = repo();
  touch(dir, SIZES, 'feat: initial');
  /* Notes commits keep core.js under a quarter of the history. Above that
     share it becomes a convention file and leaves co-change, which is a
     real change to the map and not the churn this repository is for. */
  mkdirSync(join(dir, 'docs'));
  for (let i = 0; i < 20; i++) {
    writeFileSync(join(dir, 'docs/notes.md'), `note ${i}\n`);
    execFileSync('git', ['add', '-A'], { cwd: dir, env: ENV });
    execFileSync('git', ['commit', '-q', '-m', `docs: note ${i}`], { cwd: dir, env: ENV });
  }
  for (let i = 0; i < 4; i++) touch(dir, { 'src/core.js': 20, 'src/big.js': 80 });
  for (let i = 0; i < 3; i++) touch(dir, { 'src/core.js': 20 });
  for (let i = 0; i < 2; i++) touch(dir, { 'src/big.js': 80 });
  touch(dir, { 'src/x.js': 12 });
  for (let i = 0; i < 2; i++) touch(dir, { 'src/y.js': 12 });
  return dir;
}

const PROSE = '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nx\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/core.js\n';
function writeMap(dir) {
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(computeSignals(dir), 'test') + PROSE);
}

const hotSet = (dir) => computeSignals(dir).hotspots.map((h) => h.path).sort().join(',');

test('twins trading the last hotspot place flip a plain list comparison but never verify', () => {
  const dir = boundaryRepo();
  writeMap(dir);
  const committed = hotSet(dir);
  assert.equal(verifyMap(dir).status, 'fresh', 'a map written at HEAD is fresh');
  const naive = [];
  const verdicts = [];
  for (let i = 0; i < 10; i++) {
    touch(dir, { [i % 2 ? 'src/y.js' : 'src/x.js']: 12 });
    naive.push(hotSet(dir) === committed ? 'same' : 'changed');
    verdicts.push(verifyMap(dir).status);
  }
  const flips = naive.filter((v, i) => i && v !== naive[i - 1]).length;
  assert.ok(flips >= 4, `the plain comparison flaps (${naive.join(' ')})`);
  assert.deepEqual(verdicts, Array(10).fill('fresh'));
});

test('real drift turns verify on once and keeps it on', () => {
  const dir = boundaryRepo();
  writeMap(dir);
  const verdicts = [];
  for (let i = 0; i < 12; i++) {
    touch(dir, { 'src/w.js': 120 });
    verdicts.push(verifyMap(dir).status);
  }
  const first = verdicts.indexOf('drift');
  assert.ok(first > 0, `a few edits to a new file are not drift yet (${verdicts.join(' ')})`);
  assert.deepEqual(verdicts.slice(first), Array(verdicts.length - first).fill('drift'), 'no flapping back to fresh');
  const r = verifyMap(dir);
  assert.ok(r.drift.some((d) => d.list === 'hotspots' && d.change === 'entered' && d.path === 'src/w.js'));
  assert.equal(r.commits_behind, 12);
  writeMap(dir);
  assert.equal(verifyMap(dir).status, 'fresh', 'regenerating resets the latch');
});

test('deleting a hotspot and a new strong pair are drift', () => {
  const dir = boundaryRepo();
  writeMap(dir);
  rmSync(join(dir, 'src/big.js'));
  touch(dir, {}, 'refactor: drop big');
  for (let i = 0; i < 5; i++) touch(dir, { 'src/z.js': 12, 'src/q.js': 12 });
  const r = verifyMap(dir);
  assert.equal(r.status, 'drift');
  assert.ok(r.drift.some((d) => d.list === 'hotspots' && d.change === 'left' && d.path === 'src/big.js' && d.gone));
  assert.ok(r.drift.some((d) => d.list === 'co_change' && d.change === 'entered' && d.files.join('+') === 'src/q.js+src/z.js'));
  assert.ok(r.drift.some((d) => d.list === 'co_change' && d.change === 'left' && d.files.includes('src/big.js') && d.gone));
  assert.match(formatVerify(r), /- co_change: src\/big\.js \+ src\/core\.js left \(a file of the pair is gone\)/);
});

/* ---------- the command ---------- */

function run(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...ENV, GIT_CEILING_DIRECTORIES: dirname(cwd) } });
}

test('complex-md verify exits 0 when fresh and 1 on drift, with a summary and --json', () => {
  const dir = boundaryRepo();
  const none = run(dir, ['verify']);
  assert.equal(none.status, 2, 'no map: nothing to verify');
  assert.match(none.stderr, /No readable COMPLEX\.md/);
  writeMap(dir);
  const ok = run(dir, ['verify']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^complex-md verify: COMPLEX\.md is fresh\.\nMap at [0-9a-f]+, HEAD at [0-9a-f]+, 0 commits later\. No list or count moved past its tolerance\.\n$/);
  for (let i = 0; i < 12; i++) touch(dir, { 'src/w.js': 120 });
  const bad = run(dir, ['verify']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /COMPLEX\.md has drifted \(\d+ changes? past tolerance\)/);
  assert.match(bad.stdout, /- hotspots: src\/w\.js entered \(score \d+; a newcomer needs \d+\)/);
  assert.match(bad.stdout, /Regenerate the map: npx complex-md\n$/);
  const js = run(dir, ['verify', '--json']);
  assert.equal(js.status, 1);
  const j = JSON.parse(js.stdout);
  assert.equal(j.status, 'drift');
  assert.equal(j.commits_behind, 12);
  assert.equal(j.tolerance.scoreBand, 0.25);
});

test('verify refuses a shallow clone instead of reporting its truncated history as drift', () => {
  const src = boundaryRepo();
  writeMap(src);
  const dst = mkdtempSync(join(tmpdir(), 'cx-verify-shallow-'));
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${src}`, dst], { env: ENV });
  writeMap(src);
  writeFileSync(join(dst, 'COMPLEX.md'), frontMatter(computeSignals(src), 'test') + PROSE);
  const r = run(dst, ['verify']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /shallow clone/);
  assert.match(r.stderr, /fetch-depth: 0/);
});
