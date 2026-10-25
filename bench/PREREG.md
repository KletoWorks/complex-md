# Pre-registration: does the map cut collateral damage?

Registered 2026-10-25, before any agent run of this study. Every choice
below is fixed by this file and by the code it names. A change after this
commit goes in the Deviations section at the end, with its date and its
reason, and the results say which rule was used.

## The question

COMPLEX.md exists to keep a coding agent from breaking tests its task
never touched. The first result shows conduct, not damage: with the map,
agents ran the tests the map names on 14 of 15 risky edits, against 3 of
17 without it (Claude Opus 5, two repositories). No run so far shows that
fewer tests break. This study asks that question directly, on tasks where
damage happens.

Damage was rare in the earlier runs: 0 of 130 runs on the fastify danger
set (Opus 5 and Opus 5.5) and 4 of 55 runs with a verdict on the undici
set. A comparison
needs damage to compare, so the study screens tasks first and compares
arms on a set that holds damaged and clean tasks in equal numbers.

## Hypotheses

- **H1, primary.** With the map wired (`file`), the agent damages fewer
  tasks than without it (`none`).
- **H2.** `stop` (the map plus the check that runs when the agent ends
  its turn) damages fewer tasks than `none`.
- **H3.** `hooks` (the map, the gate on the first edit of a hot file, and
  the same check) damages fewer tasks than `none`.
- **H4.** `stop` damages fewer tasks than `file`: the check after the
  edits adds to the advice alone.

## Agent and model

- Claude Code 2.1.303, headless, through `bench/run.mjs`. Each row records
  the CLI version it ran.
- Model: `claude-sonnet-5-5`, for the agent and for the map prose. Sonnet
  5.5 is closer than Haiku 5.5 to the models people run for repository
  work, and a result on the smaller model would invite the reading that
  only a weak agent breaks things. The cost of the choice: Sonnet 5.5 may
  damage less often, which the kill rule below handles.
- Settings as in the Opus 5.5 replication: `--stop-at none`, `--budget 5`
  (an API equivalent unit on the subscription, not money spent),
  `--timeout 900` with 30 s grace, `--map-cap 8192`, the sandbox of
  `bench/sandbox.mjs` (proxy to `api.anthropic.com` and
  `platform.claude.com` only), `--setting-sources project`, no MCP servers,
  no claude.ai connectors, WebFetch and WebSearch denied.
- The prompt is the issue text and nothing about tests, as in every
  earlier run.

## Repositories

Three repositories, chosen for fix history with high fan-in edits and a
suite the harness can run. The share is of the fix commits in the 48
months before each clone that change a source file, and counts those
that change no test file.

| repository | clone | fixes with no test change |
|---|---|---|
| fastify/fastify | `2a64ae1627` | 20 of 175 (11%) |
| mochajs/mocha | `cb21a4eba5` | 31 of 89 (34%) |
| louislam/uptime-kuma | `c2522806ba` | 408 of 450 (90%) |

uptime-kuma is the weakly tested repository. mocha tests itself with its
own runner, so a break in its core shows across its suite.

Repositories considered and left out: undici, because Node 24.22.1 bundles
undici's fixed code where an agent can read it; eslint, because its
`node_modules/eslint` links back to the repository root; node-red, because
its code lives under `packages/node_modules`, which the map does not read;
nodemon, because none of its 21 fixes in 48 months changed a file with
more than 5 importers.

**Leak checks, done before this commit.** The probe agent
(`bench/leak-probe.mjs`) ran in the sandbox on one task per repository,
with a line of that task's fix that appears nowhere in the history up to
its base, and with the Node install in `CX_PROBE_PATHS`. Every route said
`leaked: false`. `bench/leak-lines.mjs` looked for every line each fix
adds, 30 characters or more, in the clone's `node_modules` and the Node
install. It found no fixed logic. Its hits were generic lines: TypeScript
helper boilerplate (uptime-kuma `1185b259c2`), `const https =
require("https")` and a loop header (`c4b73ce1ce`), a `typeof process`
guard (`f8652c27af`), an ajv usage example in a type comment (fastify
`1d5f8ae199`), `'Content-Length': Buffer.byteLength(body)` (`79ab8e9564`)
and `const contentLength = headers['content-length']` (`bc25b7499a`).

## Tasks

**Candidates.** `node bench/make-dataset.mjs <clone> --repo <slug>
--months 48 --min-fan-in 6 --min-tests 1 --max 26`, newest first. A
candidate is a real fix commit: its subject matches the fix pattern and is
not a docs, chore, test or refactor commit, it changes 1 to 3 source
files, and its issue or pull request text has 40 characters or more. At
least one source file it changed has 6 or more importers at the fix's
parent (the two upper bands of `SELECTORS.md`) and at least 1 covering
test there. Result: `bench/data/damage-fastify.json` (26 tasks),
`damage-mocha.json` (18, all that qualify), `damage-uptime-kuma.json` (26).

**Gold pass, no model.** Every candidate first runs the `gold` arm: the
real fix's source change, applied with no agent and judged like a patch.
It records the suite at the base and the tests the fix itself breaks.

**Screen set.** `node bench/damage.mjs screen-set`. A task is usable when
its gold row ran the suite with no error and its base has at least 1
passing test file. Each repository gives its first 20 usable tasks in
dataset order. A repository with fewer gives all it has, and the others
fill the shortfall one task at a time, in name order, to 60. With mocha
at 18 this is 21, 18 and 21. The files are
`bench/data/damage-screen-<repository>.json`, committed before the first
agent run.

## The suite and the damage definition

- The suite is the repository's test files as they stood at the base,
  run file by file. fastify: `node --test`, the files its scripts name.
  mocha: `node bin/mocha.js --reporter tap --timeout 10000 --no-parallel`
  on `test/unit`, `test/node-unit`, `test/reporters` and
  `test/integration`, fixtures left out. uptime-kuma: `node --import=tsx
  --test` on `test/backend-test` and `test/frontend-test`, with
  `TEST_BACKEND=1` and Docker unreachable, so a test that starts a
  container fails at the base and is out of scope. The runners are in
  each dataset's `suite` object.
- **Regression.** A test that passed at the base and fails after the
  patch, on two runs, in a test file the real fix did not change.
  `bench/run.mjs` records these as `regressions`.
- **Damage.** A run is damaged when it has at least one regression that
  the gold patch for the same task did not also cause. A gold regression
  is a test the fix itself breaks, or a flaky one, and counts for no arm.
- A test that fails at the base is out of scope for every arm. A run with
  an error, or with no suite, has no verdict.

## Screen

- One run of `none`, seed 1, on each of the 60 screen tasks: 60 runs.
- Each task is **damaged** (the run is damaged), **clean** (the run has a
  verdict and no damage) or **unusable** (no verdict).
- **Kill.** If damaged tasks are under 15% of usable tasks, the study
  stops after the screen. No arms phase runs. The next step is another
  repository or another model, under a new pre-registration.
- **Selection** (`node bench/damage.mjs select`). With 15 damaged tasks or
  more, keep 15 of them; with fewer, keep all of them. Fill to 30 with
  clean tasks. Within each class, tasks are ordered by the SHA-256 of
  `complex-md damage selection v1:<task id>`, and repositories take turns
  in the order of their GitHub names. The record is `bench/results/damage-screen/selection.json`.
- Screen runs never enter the arm comparison. They chose the tasks, so
  their outcomes would bias `none`.

## Arms phase

30 tasks, 4 arms, 2 seeds: 240 runs.

| arm | what the agent gets |
|---|---|
| `none` | the repository as it was |
| `file` | COMPLEX.md as of the task's month, wired with `--profile full`: the integration block in `CLAUDE.md` and path briefs |
| `stop` | `file`, plus the Stop check (`complex-md hook stop`) that lists hot files and untouched partners in the change when the agent ends its turn |
| `hooks` | `file`, plus the gate that holds the first edit of a hot file until the agent has read its paragraph, plus the same Stop check |

**Why these arms.** For each hot file the map names the tests that cover
it directly. A wider test selector could have been an arm here, but the
selector backtest (`SELECTORS.md`) found no selector that met its bar, so
the advice stays the direct list and no selector arm exists. The four
arms carry the same advice and differ only in delivery: absent, in
context, checked after the edits, and gated before them and checked
after. `front` (front matter alone) is left out because it names no
tests.

**Seeds.** Claude Code takes no seed, so a seed is an independent repeat
(`--seeds 1,2`). Within a task, all four arms run seed 1, then seed 2, in
the order `none`, `file`, `stop`, `hooks`.

**Errors.** A row that hit the subscription usage limit is removed and
runs again. A row with any other error runs again once. A task with no
verdict for an arm after that leaves every comparison that uses that arm.
Timeouts and budget caps are judged like any other run.

## Analysis

`node bench/damage.mjs analyze`.

- For each task and arm, the score is the number of seeds whose run was
  damaged: 0, 1 or 2.
- **Primary: `file` against `none`.** A task favours `file` when `file`
  damaged fewer seeds, and goes against it when it damaged more. The test
  is the exact two sided sign test on the tasks that differ, at 0.05.
- **Success** needs all three: 6 tasks or more favour `file`, 1 at most
  goes against it, and p is under 0.05. 6 for and 0 against gives p =
  0.031. 6 for and 1 against gives p = 0.125, which is not a success.
- **Why `file` is primary.** It is the arm the first result measured, so
  the first step of the chain (agents run the named tests) is shown for
  it. It is what `wire --profile full` writes without hooks, and hooks
  stay out of committed wiring until a separate study reports on them.
  Naming it now keeps the best arm from being picked after the data.
- **Secondary:** `stop` against `none`, `hooks` against `none`, `stop`
  against `file`, with the same test. Their p values are Holm adjusted
  across the three. A secondary result is exploratory unless its Holm p is
  under 0.05.
- **Descriptive, no test:** damaged runs per arm; regressed tests per run;
  the damaged and clean strata apart; conduct (named tests run before an
  edit to a risky file); success on the fix's own tests; cost units; wall
  clock.
- **Advice replay, no model.** For each damaging patch, from the screen
  and from every arm, check whether the broken test's file is among the
  tests the map names, at the base, for a file the patch edited. This
  says how many real breaks the advice would have caught if the agent had
  followed it. The script is written before the arms phase ends and makes
  no choice that depends on the outcome.

## What gets published either way

- Success: the claim "the map cut collateral damage" with the numbers in
  the form "damage in A of 30 tasks without the map, B of 30 with it",
  the p value, and the secondary table.
- No success: one Limitations line in `RESULTS.md` that the study found no
  damage effect, with the counts. No damage claim is made.
- Kill: one line with the screen damage rate, and no damage claim.
- In every case, all rows, patches, transcripts, maps, baselines, the
  selection record and the analysis go in `bench/results/damage-screen/`
  and `bench/results/damage-arms/`.

## Schedule

Nights only, 22:00 to 08:00 Montevideo time, 2 workers, at most 40 agent
runs a night, counted together with the other benchmark study that runs
that night. Gold runs and map generation are not agent runs and are not
counted.
The screen starts when the Opus 5.5 replication's night ends. 300 agent
runs in all: 60 for the screen and 240 for the arms.

## Limits

- One agent and one model. A result says what the map does for Claude Code
  on Sonnet 5.5 on these three repositories.
- Damage is seen only where a test exists. uptime-kuma's suite is small,
  so damage there is undercounted in every arm.
- The map names the tests that import a file directly. `SELECTORS.md`
  found that list holds 35% of the fix tests for files with 1 to 5
  importers and 53% for files with 6 to 20.
- The selection rests on one `none` run a task. Damaged tasks will look
  less damaged in the arms phase for every arm alike.
- The dependency copy is the clone's `node_modules` at its HEAD, newer than
  every task. The OAuth credentials are readable in the sandbox.
- Some uptime-kuma tests reach the network. A flaky one is confirmed on a
  second run and filtered by the gold patch, not removed.
- The `file` arm follows this checkout's `wire`, which writes no
  `.claude/rules/complex-md.md`. Its rows compare with rows wired the same
  way, not with the published runs.
- The schedule lives in transient systemd units, and a reboot drops them.

## Deviations

None yet.
