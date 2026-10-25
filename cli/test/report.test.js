// `complex-md report`, run as a real process: it reads COMPLEX.md at the
// repository root, writes .complex-md/report.html and prints the path. With
// no map it says how to make one and exits 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { repoName } from '../src/report.js';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'complex-md.js');

// The ceiling stops the repository search at the temporary folder, so a
// stray repository above it can never answer for the test.
function run(cwd, args, ceiling = dirname(cwd)) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: ceiling } });
}

function repo(name = 'cx-report-') {
  const dir = mkdtempSync(join(tmpdir(), name));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

test('report writes .complex-md/report.html from COMPLEX.md and prints its path', () => {
  const dir = repo();
  spawnSync('git', ['remote', 'add', 'origin', 'git@github.com:acme/widgets.git'], { cwd: dir });
  copyFileSync(join(here, 'fixtures', 'render-map.md'), join(dir, 'COMPLEX.md'));
  const r = run(dir, ['report']);
  assert.equal(r.status, 0, r.stderr);
  /* The path is printed under the root git reports, with links and, on
     Windows, short names resolved: /private/var for /var on macOS. */
  const out = join(realpathSync.native(dir), '.complex-md', 'report.html');
  assert.equal(r.stdout.trim(), out);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /<title>acme\/widgets: COMPLEX\.md report<\/title>/);
  assert.match(html, /Before editing this file, run <code>npm test -- engine<\/code>/);
});

test('report keeps its page out of git and leaves bounds.json committable', () => {
  const dir = repo();
  copyFileSync(join(here, 'fixtures', 'render-map.md'), join(dir, 'COMPLEX.md'));
  mkdirSync(join(dir, '.complex-md'));
  writeFileSync(join(dir, '.complex-md', 'bounds.json'), '{ "reach": 40 }\n');
  const r = run(dir, ['report']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.complex-md\/\*\n!\.complex-md\/bounds\.json$/m);
  const untracked = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(untracked, /\.complex-md\/bounds\.json/);
  assert.doesNotMatch(untracked, /report\.html/);
  assert.equal(run(dir, ['report']).status, 0);
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8').match(/^\.complex-md\/\*$/gm).length, 1, 'added once');
});

test('report runs from a subdirectory and still reads the map at the root', () => {
  const dir = repo();
  copyFileSync(join(here, 'fixtures', 'render-map.md'), join(dir, 'COMPLEX.md'));
  mkdirSync(join(dir, 'src'));
  const r = run(join(dir, 'src'), ['report'], dirname(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, '.complex-md', 'report.html')));
});

test('report without a COMPLEX.md explains how to make one and exits 2', () => {
  const dir = repo();
  const r = run(dir, ['report']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no COMPLEX\.md/);
  assert.match(r.stderr, /npx complex-md/);
  assert.ok(!existsSync(join(dir, '.complex-md', 'report.html')));
});

test('report works in a repository with no commits: it reads the map, not the history', () => {
  const dir = repo();
  copyFileSync(join(here, 'fixtures', 'render-map.md'), join(dir, 'COMPLEX.md'));
  assert.equal(run(dir, ['report']).status, 0);
});

test('help lists the report command', () => {
  const r = run(repo(), ['help']);
  assert.match(r.stdout, /npx complex-md report\s+/);
});

test('repoName reads OWNER/REPO from the origin remote and falls back to the folder name', () => {
  const a = repo();
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/KletoWorks/complex-md.git'], { cwd: a });
  assert.equal(repoName(a), 'KletoWorks/complex-md');
  const b = repo('cx-folder-');
  assert.equal(repoName(b), b.split(/[\\/]/).pop());
  const c = repo();
  spawnSync('git', ['remote', 'add', 'origin', 'ssh://git@gitlab.example.com:2222/group/sub/proj'], { cwd: c });
  assert.equal(repoName(c), 'group/sub/proj');
});
