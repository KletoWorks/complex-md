// The deterministic checks the model matrix scores each map with. Runs only
// inside the repository checkout; the published CLI has no bench/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BENCH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bench');
const load = () => import(pathToFileURL(join(BENCH, 'mapcheck.mjs')).href);

const FM = '---\ncomplex_md: "0.3"\ncommit: abc1234\n---\n';
const FILES = ['src/a.js', 'src/b.js', 'test/a.test.js'];
const HOT = ['src/a.js', 'src/b.js'];
const GOOD = `${FM}
## Where the risk lives

Risk sits in src/a.js and src/b.js. Fixes land in src/a.js, with 3 fixes.

## Why these files are hot

src/a.js holds the value that src/b.js reads. 3 of its 4 commits were fixes. Before editing this file, run \`node --test test/a.test.js\`.

src/b.js reexports the value. Before editing this file, open src/a.js.

## Change coupling

src/a.js and src/b.js moved together in 3 commits. Open both files when one changes.

## What to read first

1. src/a.js: the value.
2. src/b.js: the reader.
`;

const names = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.pass]));

test('a map that follows every rule passes every check', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { scoreMap, CHECKS } = await load();
  const r = scoreMap({ reply: GOOD, fm: FM, files: FILES, hot: HOT });
  assert.deepEqual(Object.keys(r), CHECKS);
  assert.deepEqual(names(r), Object.fromEntries(CHECKS.map((c) => [c, true])), JSON.stringify(r, null, 2));
});

test('an outer fence is not a fault; a changed front matter is', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { scoreMap } = await load();
  assert.equal(scoreMap({ reply: '```markdown\n' + GOOD + '```', fm: FM, files: FILES, hot: HOT }).front_matter.pass, true);
  const r = scoreMap({ reply: GOOD.replace('abc1234', 'abc1235'), fm: FM, files: FILES, hot: HOT });
  assert.equal(r.front_matter.pass, false);
  assert.match(r.front_matter.detail, /line 3/);
  assert.equal(scoreMap({ reply: GOOD.slice(FM.length), fm: FM, files: FILES, hot: HOT }).front_matter.pass, false);
});

test('each rule fails on its own fault and names it', async (t) => {
  if (!existsSync(BENCH)) return t.skip('not a repository checkout');
  const { scoreMap } = await load();
  const score = (reply) => scoreMap({ reply, fm: FM, files: FILES, hot: HOT });

  const dash = score(GOOD.replace('the reader.', 'the reader — it reads.'));
  assert.equal(dash.em_dashes.pass, false);
  assert.equal(names(dash).sentences, true);

  const invented = score(GOOD.replace('open src/a.js.', 'open src/c.js.'));
  assert.equal(invented.paths.pass, false);
  assert.match(invented.paths.detail, /src\/c\.js/);

  const noDirective = score(GOOD.replace(' Before editing this file, open src/a.js.', ''));
  assert.equal(noDirective.directives.pass, false);
  assert.match(noDirective.directives.detail, /src\/b\.js/);

  const two = score(GOOD.replace('open src/a.js.', 'open src/a.js. Before editing this file, run it.'));
  assert.equal(two.directives.pass, false);

  const long = score(GOOD.replace('src/b.js reexports the value.', 'src/b.js reexports the value that src/a.js computes from the configuration that the loader reads at start and passes on to every module that imports it at run time.'));
  assert.equal(long.sentences.pass, false);
  assert.match(long.sentences.detail, /2[6-9] words/);

  const longStep = score(GOOD.replace('Open both files when one changes.', 'Open both files when one changes and read the tests in the test folder that reach either file before you commit.'));
  assert.equal(longStep.sentences.pass, false, 'an instruction has 20 words at most');

  const missing = score(GOOD.replace('## Change coupling', '## Coupling'));
  assert.equal(missing.sections.pass, false);
});
