// The first run, end to end, as a new user meets it: a fixture repository,
// no provider key, no terminal, and `npx complex-md --yes`. It must land a
// wired COMPLEX.md, keep its working files out of git, and print the plan
// first and the fact and URL last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { buildFirstRunRepo } from './fixtures/first-run-repo.mjs';
import { computeSignals } from '../src/signals.js';
import { frontMatter, validateOutput } from '../src/generate.js';
import { parseComplexMd } from '../src/complexmd.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const NO_KEYS = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/_API_KEY$|^COMPLEX_MD_|^OLLAMA_HOST$/.test(k)));
const run = (dir) => spawnSync(process.execPath, [BIN, '--yes'], { cwd: dir, encoding: 'utf8', input: '', env: { ...NO_KEYS, GIT_CEILING_DIRECTORIES: dirname(dir) } });
const status = (dir) => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').sort();

const dir = buildFirstRunRepo();
const first = run(dir);
const map = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
const parsed = parseComplexMd(map);

test('the first run exits 0 and lands COMPLEX.md, AGENTS.md, the wiring manifest and the .gitignore entry, nothing else in git', () => {
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(status(dir), ['?? .complex-md/manifest.json', '?? .gitignore', '?? AGENTS.md', '?? COMPLEX.md']);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.complex-md\/\*$/m);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /## COMPLEX\.md: the structural risk map/);
});

test('the front matter is the computed one, marked as template prose', () => {
  const computed = frontMatter(computeSignals(dir), `complex-md/${pkg.version}`, { prose: 'template' });
  assert.ok(map.startsWith(computed), 'front matter matches the computed one byte for byte');
  assert.equal(parsed.front.prose, 'template');
  assert.deepEqual(validateOutput(map), []);
});

test('a file the package root reaches gets the full suite; a file it does not reach gets its own test', () => {
  assert.equal(parsed.directive('src/price.js'), 'Before editing this file, run the full test suite with `npm test`.');
  assert.equal(parsed.directive('tools/report.js'), 'Before editing this file, run `test/report.test.js`.');
  assert.match(parsed.paragraphFor('src/cart.js'), /1 file depends on it: `src\/index\.js`\./);
  assert.match(parsed.paragraphFor('src/price.js'), /It changed in 5 of the last 7 commits, and 2 of them were fixes\./);
});

test('the plan comes first and lists every file the run wrote; the fact and the URL come last', () => {
  const lines = first.stderr.trim().split('\n');
  const at = lines.indexOf('File plan:');
  assert.ok(at >= 0 && lines.slice(0, at).every((l) => !/^(wrote|created|added)/.test(l)), 'nothing written before the plan');
  const planned = lines.slice(at + 1).filter((l) => /^ {2}(create|change)/.test(l)).map((l) => l.trim().split(/\s+/)[1]);
  assert.deepEqual(planned, ['COMPLEX.md', '.complex-md/prompt.md', '.complex-md/front-matter.yaml', '.gitignore', '.complex-md/manifest.json', 'AGENTS.md']);
  assert.equal(lines.at(-2), 'Fact: src/price.js received 2 of the 3 fix commits in the last 7 commits.');
  assert.equal(lines.at(-1), 'https://complex.md/?utm_source=cli');
});

test('a second run on the same commit writes byte identical files and plans no change', () => {
  const again = run(dir);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), map);
  assert.match(again.stderr, /^File plan: no file changes\.$/m);
  assert.deepEqual(status(dir), ['?? .complex-md/manifest.json', '?? .gitignore', '?? AGENTS.md', '?? COMPLEX.md']);
});

test('the same fixture built twice gives the same COMPLEX.md', () => {
  const other = buildFirstRunRepo();
  assert.equal(run(other).status, 0);
  assert.equal(readFileSync(join(other, 'COMPLEX.md'), 'utf8'), map);
});
