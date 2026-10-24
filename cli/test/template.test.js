// Template prose: the four sections written from computed data alone, for a
// run with no model. Every sentence comes from a number or a path the
// analysis found, so the same commit gives the same bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { computeSignals, graphFor } from '../src/signals.js';
import { validateOutput, frontMatter } from '../src/generate.js';
import { parseComplexMd } from '../src/complexmd.js';
import { templateProse, packageRoots, reachableFrom, repositoryFact } from '../src/template.js';
import { buildRegressionRepo, REGRESSION_OPTS } from './fixtures/regression-repo.mjs';

const fixture = buildRegressionRepo();
const sig = computeSignals(fixture, REGRESSION_OPTS);
const prose = templateProse(sig);
const map = parseComplexMd(frontMatter(sig, 'complex-md/test') + '\n' + prose);

test('template prose carries the four required sections in order', () => {
  assert.deepEqual(validateOutput(prose), []);
  const at = ['## Where the risk lives', '## Why these files are hot', '## Change coupling', '## What to read first'].map((h) => prose.indexOf(h));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test('the same signals give byte identical prose', () => {
  assert.equal(templateProse(computeSignals(fixture, REGRESSION_OPTS)), prose);
});

test('each hotspot gets its own paragraph that ends with a directive', () => {
  for (const h of sig.hotspots) {
    const para = map.paragraphFor(h.path);
    assert.ok(para, `a paragraph for ${h.path}`);
    assert.ok(para.startsWith(`\`${h.path}\``), `the paragraph for ${h.path} opens with its path: ${para}`);
    assert.match(map.directive(h.path), /^Before editing this file, /);
  }
});

test('a hotspot paragraph names no other mapped path, so a reader cannot pick the wrong one', () => {
  const mapped = new Set([...sig.hotspots.map((h) => h.path), ...sig.load_bearing.map((h) => h.path), ...sig.co_change.flatMap((c) => c.files)]);
  for (const h of sig.hotspots) {
    const para = map.paragraphFor(h.path);
    for (const other of mapped) if (other !== h.path) assert.ok(!para.includes(other), `${h.path} paragraph names ${other}`);
  }
});

test('the directive names the covering tests when the file is not reachable from a package root', () => {
  assert.equal(map.directive('src/core.js'), 'Before editing this file, run `test/core.test.js`.');
  assert.match(map.paragraphFor('src/core.js'), /It changed in 3 of the last 7 commits, and 1 of them was a fix\./);
  assert.match(map.paragraphFor('src/core.js'), /5 files depend on it, for example `src\/a\.js`, `src\/b\.js` and `src\/c\.js`\./);
});

test('importers are named in full when all of them fit, and as examples otherwise', () => {
  const s = { ...sig, hotspots: [{ ...sig.hotspots[0], fan_in: 2 }], importers: { 'src/core.js': ['src/a.js', 'src/b.js'] } };
  assert.match(templateProse(s), /2 files depend on it: `src\/a\.js` and `src\/b\.js`\./);
});

test('a hotspot with no tests and no importers gets a directive to plan the verification', () => {
  assert.match(map.directive('src/render.css'), /^Before editing this file, .*no test covers it\.$/);
});

test('the coupling section names each pair, and what to read first lists load bearing files first', () => {
  assert.equal(map.couplingFor('src/render.js').length, 1);
  assert.match(map.couplingFor('src/render.js')[0], /3 commits/);
  assert.match(map.readFirst, /^1\. `src\/legacy\.js`: 5 files depend on it/);
});

test('the prose says a template wrote it, stays under 700 words and uses no dash as punctuation', () => {
  assert.match(map.riskSummary, /A template wrote this prose from the computed numbers\./);
  assert.ok(prose.split(/\s+/).filter(Boolean).length < 700);
  assert.ok(!/[–—]| -- | - /.test(prose), 'no dash as punctuation');
});

test('a sentence in the prose has 25 words at most', () => {
  const text = prose.replace(/^#.*$/gm, '').replace(/^\d+\. /gm, '');
  for (const s of text.split(/(?<=\.)\s+/)) assert.ok(s.split(/\s+/).filter(Boolean).length <= 25, s);
});

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-tpl-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' };
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env });
  g('init', '-q', '-b', 'main');
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return dir;
}

test('packageRoots reads main, bin and exports, and falls back to an index file', () => {
  const dir = repo({
    'package.json': JSON.stringify({ name: 'x', main: './lib/main.js', bin: { x: 'bin/x.js' }, exports: { '.': { import: './lib/esm.mjs', require: './lib/main.js' }, './dist': './dist/gone.js' } }),
    'lib/main.js': '', 'lib/esm.mjs': '', 'bin/x.js': '',
    'packages/p/package.json': JSON.stringify({ name: 'p', main: './dist/index.js' }),
    'packages/p/src/index.ts': '',
    'test/fixtures/f/package.json': JSON.stringify({ name: 'f', main: 'index.js' }),
    'test/fixtures/f/index.js': '',
  });
  assert.deepEqual(packageRoots(dir, graphFor(dir).kinds), ['bin/x.js', 'lib/esm.mjs', 'lib/main.js', 'packages/p/src/index.ts']);
});

test('packageRoots finds a Python package initializer at the top or under src', () => {
  const dir = repo({ 'pyproject.toml': '[project]\nname = "p"\n', 'src/p/__init__.py': '', 'src/p/core.py': '', 'tests/__init__.py': '' });
  assert.deepEqual(packageRoots(dir, graphFor(dir).kinds), ['src/p/__init__.py']);
});

test('reachableFrom walks the import edges from each root', () => {
  const edges = new Map([['a', new Set(['b'])], ['b', new Set(['c'])], ['d', new Set(['a'])]]);
  assert.deepEqual([...reachableFrom(['a'], edges)].sort(), ['a', 'b', 'c']);
});

test('a hotspot reachable from the package root gets the full test suite directive', () => {
  const dir = repo({
    'package.json': JSON.stringify({ name: 'r', main: 'src/index.js', scripts: { test: 'node --test' } }),
    'src/index.js': "import { core } from './core.js';\nexport { core };\n",
    'src/core.js': 'export const core = 1;\n',
    'src/other.js': "import { core } from './core.js';\nexport const o = core;\n",
  });
  const s = computeSignals(dir);
  const g = graphFor(dir);
  const reachable = reachableFrom(packageRoots(dir, g.kinds), g.edges);
  const m = parseComplexMd(frontMatter(s, 't') + '\n' + templateProse(s, { reachable, testCommand: 'npm test' }));
  assert.ok(s.hotspots.some((h) => h.path === 'src/core.js'));
  assert.equal(m.directive('src/core.js'), 'Before editing this file, run the full test suite with `npm test`.');
  assert.match(m.paragraphFor('src/core.js'), /The package root reaches it through imports, so a break here can surface in any test\./);
  const none = parseComplexMd(frontMatter(s, 't') + '\n' + templateProse(s, { reachable }));
  assert.equal(none.directive('src/core.js'), 'Before editing this file, run the full test suite.');
});

test('repositoryFact states one computed fact, preferring where fixes landed', () => {
  assert.equal(repositoryFact(sig), 'src/render.js received 2 of the 3 fix commits in the last 7 commits.');
  assert.equal(repositoryFact({ ...sig, hotspots: [], table: [], fix_commits: 0 }), 'src/render.css and src/render.js changed together in 3 commits.');
  assert.equal(repositoryFact({ ...sig, hotspots: [], table: [], fix_commits: 0, co_change: [] }), 'src/legacy.js has 5 dependents, the most of any file in the map.');
  assert.equal(repositoryFact({ ...sig, hotspots: [], table: [], fix_commits: 0, co_change: [], load_bearing: [] }), `complex-md read ${sig.files_analyzed} rankable files and 7 commits.`);
});
