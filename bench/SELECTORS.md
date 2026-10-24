# Test selector backtest: which list names the tests a fix changed

When an agent edits a file, the map tells it which tests to run. Today that
list is the test files that import the file directly. This backtest asks how
often that list, and four wider lists, contain the test files a real bug fix
changed, and what share of the suite each list costs. It uses no model and no
agent: only the import graph and the commit history at each fix's parent.

## Method

**Repositories.** undici and fastify, the two benchmark repositories, and
nodemon, a smaller one with weaker test habits. Of the fix commits that
change a source file, 212 of 277 in nodemon change no test file, against 591
of 1456 in undici and 70 of 474 in fastify. Clones at undici
`046bb4c6fe`, fastify `2a64ae1627` and nodemon `6812a74722`.

**Fixes.** A fix is a commit whose subject matches the map's fix pattern
(`fix`, `bug`, `hotfix`, `regression`). Merges and commits of more than 30
files are left out. A fix is scored when it modifies a source file that
exists at its parent and modifies a test file in the suite. The newest 150
per repository are scored; nodemon has 60. Every fix left out is listed with its reason in
the result file.

**Ground truth.** The suite test files the fix modified. The suite is the
set of test files the repository's own scripts run (`bench/suite.mjs`). A
test file the fix added did not exist at the parent, so no selector can name
it, and a fix whose only test change is a new file is not scored.

**Selectors.** Each is computed at the fix's parent for every source file
the fix changed, and the fix's selection is the union. A covering test of a
file is a test file whose import, path literal or exact name points at it.

| id | selector | what it names |
|---|---|---|
| a | direct | the covering tests of the file: the map's list today |
| b | depth 2 | a, plus the covering tests of every file that imports the file |
| c | roots and barrels | a, plus the covering tests of every package root or barrel file that reaches the file through roots and barrels only |
| d | history | test files modified in an earlier commit that also modified the file |
| e | full closure | the covering tests of the file and of every file that reaches it by any import chain |

A test that imports `..` or a directory such as `../lib/` reaches that
package's entry file or the directory's index file. The map's graph
resolves those edges, so every selector uses them. A barrel is a source file in which at least 80% of the code
lines are imports, re-exports or object keys.

The decision bar is a recall at a suite share, and only a ranked list can be
cut at a share. So four ranked cuts go beside the five selectors:

| id | ranked by | cut at |
|---|---|---|
| e15, e20 | import distance in e, then the d count | 15%, 20% of the suite |
| m15, m20 | the d count, then import distance, over e and d together | 15%, 20% of the suite |

**Scores.** Recall is the truth files a selector names over all truth files
in a band. Suite share is the selection size over the suite size, as a mean
over fixes. A fix's band is the fan-in of its changed file with the most
importers: 1 to 5, 6 to 20 or over 20. Fan-in counts non-test files that
import the file, as in the map. A fix whose changed files have no importers
falls in band 0 (12 fixes). The bar does not use band 0 or the band over 20.

**Decision bar.** A selector passes when it reaches 80% recall at a 15% suite
share or less, in both the 1 to 5 and the 6 to 20 band. When no selector
reaches 60% recall at a 20% share in those bands, the advice is to run the
full suite.

## Results

360 fixes scored: 150 in undici, 150 in fastify, 60 in nodemon. Pooled over
the three repositories, recall at the mean suite share:

| selector | band 1 to 5 (289 fixes) | band 6 to 20 (51 fixes) |
|---|---|---|
| a direct | 35% at 6% | 53% at 22% |
| b depth 2 | 75% at 50% | 92% at 77% |
| c roots and barrels | 78% at 53% | 93% at 76% |
| d history | 87% at 26% | 80% at 35% |
| e full closure | 97% at 80% | 99% at 88% |
| e15 | 70% at 14% | 71% at 15% |
| e20 | 75% at 20% | 74% at 20% |
| m15 | 73% at 14% | 66% at 15% |
| m20 | 76% at 20% | 74% at 20% |

Per repository, the same two bands:

| selector | undici 1 to 5 (124) | undici 6 to 20 (17) | fastify 1 to 5 (109) | fastify 6 to 20 (32) | nodemon 1 to 5 (56) |
|---|---|---|---|---|---|
| a | 32% at 1% | 27% at 1% | 34% at 12% | 64% at 34% | 40% at 8% |
| d | 85% at 5% | 59% at 9% | 87% at 33% | 88% at 45% | 89% at 58% |
| e | 98% at 85% | 100% at 87% | 99% at 87% | 100% at 90% | 91% at 51% |
| e15 | 87% at 15% | 68% at 15% | 69% at 15% | 74% at 15% | 46% at 13% |
| m15 | 89% at 15% | 59% at 15% | 68% at 15% | 72% at 15% | 54% at 13% |
| m20 | 89% at 20% | 64% at 20% | 73% at 20% | 80% at 20% | 60% at 18% |

nodemon has 2 fixes in the 6 to 20 band, too few to read. Only undici has
fixes over 20 (8 fixes).

**Known breaks.** In the undici damage run, agent patches broke 3 tests on 2
tasks. At each task's base, for the source file the agents edited:

| task | edited | broken test | a | c | d | e | e15, e20, m15, m20 |
|---|---|---|---|---|---|---|---|
| c8d50b4a82 | lib/core/request.js | test/fetch/issue-2021.js | no | no | no | yes, at 88% | no |
| f0497300fa | lib/core/util.js | test/issue-4880.js, test/issue-803.js | 0 of 2 | 2 of 2, at 79% | 1 of 2 | 2 of 2, at 89% | 1 of 2 |

## What the numbers say

- No selector passes the bar in both lower bands, in any repository or
  pooled. At a 15% share, the best pooled cut names 73% of the fix tests in
  the 1 to 5 band (m15) and 71% in the 6 to 20 band (e15).
- Pooled, the full suite rule does not apply: the 20% cuts reach 74% to 76%
  recall in both bands. undici and fastify each clear it too. nodemon alone
  does not: its best 20% cut names 59.6% in the 1 to 5 band.
- The map's list today names 35% of the fix tests in the 1 to 5 band and 53%
  in the 6 to 20 band. It costs 6% to 22% of the suite. In fastify, 24 of
  the 150 fixes change fastify.js, the package root that most tests import,
  and for each of them the direct list is 81% of the suite or more.
- Depth 2 names 75% and 92%, at 50% and 77% of the suite: a test that
  imports the package root is two steps from every file the root imports.
- The full closure finds almost every fix test, but at 80% to 88% of the
  suite. Most tests import the package root, and the root reaches most
  files.
- History is the strongest cheap signal in undici: 85% recall at 5% of the
  suite in the 1 to 5 band. That band alone passes the bar for d, e15 and
  m15, but undici's 6 to 20 band does not. In fastify and nodemon, history
  costs 33% and 58% of the suite in the 1 to 5 band.
- Of the 3 tests agent patches broke, the map's list names none. The roots
  and barrels closure names 2, the full closure all 3, each at most of the
  suite.

## Limits

- The truth is the test a fix's author changed, not every test that could
  catch the bug. Fixes that only add a test file are not scored: 143 such
  commits in undici, 20 in fastify and 4 in nodemon.
- The fix pattern matches subjects, so some scored commits are not bug fixes.
- The graph is today's code applied to old commits.

## Reproduce

```sh
git clone --filter=blob:none https://github.com/nodejs/undici.git
git -C undici checkout -q 046bb4c6fe
node bench/selectors.mjs --repo undici --name undici --max 150
node bench/selectors.mjs --repo undici --name undici --known bench/results/undici-damage --dataset bench/data/undici-danger.json
node bench/selectors.mjs --summary bench/results/selectors
```

The backtest reads the history from the checked out commit, so check out
the commit named under Method to get the same numbers. Results:
`bench/results/selectors/<repository>.json` per repository, with every
fix row and every dropped fix; `summary.json` pooled; `undici-known.json`
for the known breaks. Each repository takes under two minutes from a cold
blobless clone and under one minute from a warm one.
