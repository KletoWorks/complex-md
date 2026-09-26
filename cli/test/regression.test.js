/* Analysis regression: the engine's output on a fixed repository is a fixed
   point, and any change to it has to be deliberate.

   The practice is borrowed from Dempsey and Wrage (CMU SEI,
   DOI 10.58012/4c2e-xd64), who record known analysis results for a reference
   model so that "those models can detect changes in parser behavior,
   instantiation, property interpretation, and analysis output".

   What this protects that the other tests do not: every other test asserts a
   property (this file is hot, that pair couples). This one asserts the WHOLE
   computed answer, field by field, including the numbers nobody thought to
   write an assertion for. A scoring tweak that quietly reorders hotspots on
   every user's repository fails here and nowhere else.

   When a change is intentional, rerecord and read the diff before committing:

     UPDATE_GOLDEN=1 node --test test/regression.test.js

   The diff IS the review. A rerecord with an unread diff defeats the file. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeSignals, DEFAULTS } from '../src/signals.js';
import { buildRegressionRepo, stableSignals, REGRESSION_OPTS } from './fixtures/regression-repo.mjs';

const GOLDEN = join(import.meta.dirname, 'fixtures', 'signals.golden.json');
/* The engine has two ranking regimes and they produce different files. Under
   thinHistory the ranking leans on structure, minCommits relaxes to 1 and
   load_bearing is suppressed entirely. REGRESSION_OPTS pins thinHistory to 0
   to reach the normal regime, which left the thin one with no coverage at
   all: a change to the thin path passed the golden untouched. Both regimes
   are recorded. */
const GOLDEN_THIN = join(import.meta.dirname, 'fixtures', 'signals.thin.golden.json');
const GOLDEN_DEFAULTS = join(import.meta.dirname, 'fixtures', 'defaults.golden.json');

function compare(file, opts, label) {
  const got = stableSignals(computeSignals(buildRegressionRepo(), opts));
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    writeFileSync(file, `${JSON.stringify(got, null, 2)}\n`);
    console.log(`recorded ${file}; read the diff before committing it`);
    return;
  }
  assert.deepEqual(
    got,
    JSON.parse(readFileSync(file, 'utf8')),
    `${label} signals changed against the recorded golden. If intended, rerun with UPDATE_GOLDEN=1 and review the diff.`,
  );
}

test('the fixture repository is byte identical on every build', () => {
  const a = stableSignals(computeSignals(buildRegressionRepo(), REGRESSION_OPTS));
  const b = stableSignals(computeSignals(buildRegressionRepo(), REGRESSION_OPTS));
  assert.deepEqual(a, b, 'two builds of the fixture must compute the same signals');
  assert.match(a.commit, /^[0-9a-f]{7,}$/, 'the commit sha is pinned by the fixture clock');
});

test('computed signals match the recorded golden', () => {
  compare(GOLDEN, REGRESSION_OPTS, 'ranked');
});

test('the thin history regime matches its own golden', () => {
  /* Default options: the fixture's 9 commits are under thinHistory, so this
     exercises the other regime on the same repository. */
  compare(GOLDEN_THIN, { windowCommitsMax: REGRESSION_OPTS.windowCommitsMax }, 'thin');
});

/* The golden is only worth having if it actually covers the signal families.
   A fixture that silently stopped producing co-change pairs would keep
   passing the comparison above while testing nothing. */
test('the golden covers every signal family', () => {
  const s = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.ok(s.hotspots.length >= 3, 'hotspots');
  assert.ok(s.load_bearing.length >= 1, 'load_bearing: a file with dependents and no commits in the window');
  assert.ok(s.co_change.length >= 1, 'co_change');
  assert.ok(s.blind_spots.some((b) => /NUL byte/.test(b)), 'blind_spots: the grep-invisible file');
  assert.ok(s.hotspots.some((h) => h.fixes > 0), 'fixes are attributed');
  assert.ok(s.hotspots.some((h) => h.fan_in >= 5), 'fan_in is resolved');
  assert.ok(s.profile.dependency_edges > 0, 'the dependency graph resolved');

  /* The thin regime is a different answer, not a copy of the same one. If
     these ever match, the pinning in REGRESSION_OPTS has stopped working and
     both goldens are recording one path. */
  const thin = JSON.parse(readFileSync(GOLDEN_THIN, 'utf8'));
  assert.notDeepEqual(thin, s, 'the two regimes must produce different files');
  assert.equal(thin.load_bearing.length, 0, 'thin history suppresses load_bearing');
  assert.ok(
    thin.blind_spots.some((b) => /usable history/.test(b)),
    'thin history declares itself in blind_spots',
  );
});

/* The tuning constants are part of the engine's contract: every user's map is
   cut by them. A fixture can only catch a threshold change when one of its
   files sits on that threshold, which is not a property any fixture can have
   for all of them at once. thinHistory proved it: its default could be moved
   from 50 to 9999 with both regime goldens passing, because the fixture's
   seven commits are thin either side of that value. Recording the constants
   catches the rest by construction, for the cost of one file. */
test('the tuning defaults match the recorded golden', () => {
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN_DEFAULTS)) {
    writeFileSync(GOLDEN_DEFAULTS, `${JSON.stringify(DEFAULTS, null, 2)}\n`);
    return;
  }
  assert.deepEqual(
    DEFAULTS,
    JSON.parse(readFileSync(GOLDEN_DEFAULTS, 'utf8')),
    'a tuning default changed. Every map every user regenerates is cut by these. If intended, rerun with UPDATE_GOLDEN=1, review the diff, and say why in CHANGELOG.md.',
  );
});
