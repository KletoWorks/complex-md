// check --note: the Markdown merge request note that ci/gitlab/ posts. The
// format is the pull request comment of KletoWorks/complex-md-action, so
// these tests pin its lines, then run the bin in a fixture repository.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseComplexMd } from '../src/complexmd.js';
import { noteFindings, renderNote, renderNoteCleared, NOTE_MARKER, code } from '../src/note.js';

const BIN = join(import.meta.dirname, '..', 'bin', 'complex-md.js');

const MAP = `---
complex_md: "0.3"
generated: 2026-10-01
commit: COMMIT
tool: complex-md/0.11.0
hotspots:
  - path: src/hot.js
    loc: 120
    churn: 17
    fixes: 4
    fan_in: 2
    tests: 2
    score: 1960
load_bearing:
  - path: src/core.js
    fan_in: 9
    tests: 1
co_change:
  - files: [src/hot.js, src/partner.js]
    count: 7
    coupling: 44
  - files: [README.md, docs/guide.md]
    count: 4
    coupling: 80
---

## Where the risk lives

src/hot.js.

## Why these files are hot

src/hot.js parses the input. Before editing this file, run \`npm test\`.

## Change coupling

src/hot.js moves with src/partner.js.

## What to read first

1. src/hot.js
`;

test('the note has the lines of the complex-md-action comment, worded for a merge request', () => {
  const map = parseComplexMd(MAP.replace('COMMIT', 'abc1234'));
  const f = noteFindings(map, ['src/hot.js', 'src/core.js', 'README.md']);
  const body = renderNote(f, { ref: 'origin/main', sha: 'def5678aaaa', front: map.front, behind: 3 });
  assert.equal(body, [
    NOTE_MARKER,
    '**COMPLEX.md**: 1 hotspot touched, 1 load bearing file touched, 2 co-change partners not in this merge request.',
    '',
    '| Hotspot | Score | Churn | Fixes | Fan in | Tests |',
    '|---|--:|--:|--:|--:|--:|',
    '| `src/hot.js` | 1960 | 17 | 4 | 2 | 2 |',
    '',
    '| Load bearing | Fan in | Tests |',
    '|---|--:|--:|',
    '| `src/core.js` | 9 | 1 |',
    '',
    '- `src/hot.js`: Before editing this file, run `npm test`.',
    '',
    '**Co-change partners not in this merge request**',
    '',
    '- `src/hot.js` changed. Unchanged: `src/partner.js` (7 commits together, 44 percent). Say whether each needs a change.',
    '- `README.md` changed. Unchanged: `docs/guide.md` (4 commits together, 80 percent). Say whether each needs a change.',
    '',
    '<sub>Read from `COMPLEX.md` at `origin/main` `def5678`. The map was generated 2026-10-01 at `abc1234`, 3 commits behind `origin/main`. complex-md runs no code from this merge request.</sub>',
  ].join('\n'));
});

/* CI once made a fixture commit 0179008...; the footer named 179008, a
   commit not in the history. This pins that sha instead of a random one. */
test('a map commit with a leading zero keeps it in the footer and in the age check', () => {
  const map = parseComplexMd(MAP.replace('COMMIT', '0179008'));
  assert.equal(map.front.commit, '0179008');
  const body = renderNote(noteFindings(map, ['src/hot.js']), { ref: 'main', sha: 'def5678', front: map.front, behind: 0 });
  assert.match(body, /The map was generated 2026-10-01 at `0179008`, current with `main`\./);
});

test('a pair with both sides touched is no finding, and a clean change gets the cleared note', () => {
  const map = parseComplexMd(MAP.replace('COMMIT', 'abc1234'));
  const f = noteFindings(map, ['README.md', 'docs/guide.md', 'other.txt']);
  assert.equal(f.clean, true);
  const cleared = renderNoteCleared({ ref: 'origin/main', sha: 'def5678' });
  assert.ok(cleared.startsWith(NOTE_MARKER + '\n'));
  assert.match(cleared, /no longer touches a hotspot, a load bearing file or a co-change pair/);
  assert.doesNotMatch(cleared, /behind|generated/, 'the cleared note leaves out the lag, so it stays the same as the target moves');
});

test('partners: 3 per changed file, then a count of the rest', () => {
  const pairs = Array.from({ length: 5 }, (_, i) => `  - files: [a.js, p${i}.js]\n    count: ${10 - i}\n    coupling: 50`).join('\n');
  const map = parseComplexMd(`---\ncomplex_md: "0.3"\nco_change:\n${pairs}\n---\n\n## Why these files are hot\n\nnone.\n`);
  const body = renderNote(noteFindings(map, ['a.js']), {});
  assert.match(body, /- `a\.js` changed\. Unchanged: `p0\.js` \(10 commits together, 50 percent\), `p1\.js` \(9 commits together, 50 percent\), `p2\.js` \(8 commits together, 50 percent\), and 2 more in COMPLEX\.md\./);
  assert.match(body, /Read from `COMPLEX\.md` in the working tree\./);
});

test('a path cannot break the table or the code span', () => {
  assert.equal(code('a|b.js'), '`a\\|b.js`');
  assert.equal(code('a`b.js'), '`` a`b.js ``');
  assert.equal(code('a\nb'), '`a b`');
});

const made = [];
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });

/* A repository with a target branch whose map differs from the one the
   merge request branch commits. */
function fixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-note-'));
  made.push(dir);
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir), GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  const g = (...a) => {
    const r = spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const put = (p, s) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
  g('init', '-q', '-b', 'main');
  for (const p of ['src/hot.js', 'src/partner.js', 'src/core.js', 'README.md', 'docs/guide.md']) put(p, `// ${p}\n`);
  g('add', '.');
  g('commit', '-qm', 'init');
  const first = g('rev-parse', 'HEAD');
  put('COMPLEX.md', MAP.replace('COMMIT', first.slice(0, 7)));
  g('add', '.');
  g('commit', '-qm', 'map');
  g('checkout', '-qb', 'feature');
  return { dir, env, g, put };
}

const run = (r, args) => spawnSync(process.execPath, [BIN, 'check', ...args], { cwd: r.dir, env: r.env, encoding: 'utf8' });

test('--note --map-ref reads the target map, not the copy the branch edits', () => {
  const r = fixtureRepo();
  r.put('src/hot.js', '// changed\n');
  r.put('COMPLEX.md', '---\ncomplex_md: "0.3"\n---\n\n## Why these files are hot\n\nnothing.\n');
  r.g('commit', '-qam', 'edit the hotspot and empty the map');
  const out = run(r, ['--base', 'main', '--map-ref', 'main', '--note', '--strict']);
  assert.equal(out.status, 1, out.stderr);
  assert.ok(out.stdout.startsWith(NOTE_MARKER + '\n'));
  assert.match(out.stdout, /\| `src\/hot\.js` \| 1960 \|/);
  assert.match(out.stdout, /Unchanged: `src\/partner\.js` \(7 commits together, 44 percent\)/);
  assert.match(out.stdout, /, 1 commit behind `main`\./);
  const plain = run(r, ['--base', 'main', '--map-ref', 'main', '--strict']);
  assert.equal(plain.status, 1, 'plain check reads the --map-ref map as well');
  assert.match(plain.stdout, /src\/hot\.js/);
});

test('--note counts a renamed file under its old path', () => {
  const r = fixtureRepo();
  renameSync(join(r.dir, 'src/hot.js'), join(r.dir, 'src/renamed.js'));
  r.g('add', '-A');
  r.g('commit', '-qm', 'rename');
  const out = run(r, ['--base', 'main', '--map-ref', 'main', '--note']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /1 hotspot touched/);
});

test('--note on a clean change prints the cleared note and exits 0 under --strict', () => {
  const r = fixtureRepo();
  r.put('other.txt', 'x\n');
  r.g('add', '.');
  r.g('commit', '-qm', 'other');
  const out = run(r, ['--base', 'main', '--map-ref', 'main', '--note', '--strict']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /no longer touches/);
});

test('--note with no map at the ref prints nothing and exits 0; a ref that does not resolve exits 2', () => {
  const r = fixtureRepo();
  const first = r.g('rev-list', '--max-parents=0', 'HEAD');
  const none = run(r, ['--base', 'main', '--map-ref', first, '--note', '--strict']);
  assert.equal(none.status, 0, none.stderr);
  assert.equal(none.stdout, '');
  assert.match(none.stderr, /no COMPLEX\.md with front matter at /);
  const bad = run(r, ['--base', 'main', '--map-ref', 'no-such-ref', '--note']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--map-ref needs a commit ref/);
});
