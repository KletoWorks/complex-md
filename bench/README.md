# Benchmark

Does COMPLEX.md keep an agent from breaking things it was not asked to
touch? This measures it on a repository's own history instead of asserting
it. Results: [RESULTS.md](RESULTS.md).

## Method

Each task is a real fix commit: the issue (or PR) text is the prompt, the
commit's parent is the starting point, the source files the fix touched are
the answer, and the tests the fix was verified by are the gold tests. The
agent runs from a fresh repository at the parent commit under two or more
arms:

| arm | what the agent gets |
|---|---|
| `none` | the repository as it was |
| `front` | COMPLEX.md front matter only: the computed numbers, no prose |
| `file` | COMPLEX.md computed as of that commit, wired (`CLAUDE.md`, path-scoped rule) |
| `hooks` | `file` plus the PreToolUse gate and Stop check |
| `gold` | no agent: the real fix's source change, judged like a patch |

`gold` is an oracle. It shows which regressions the fix itself causes and
which tests are flaky. The `mcp` arm (`hooks` plus the MCP server) is retired. Its published rows
stay readable, and `run.mjs` refuses the arm name.

An arm gets what this checkout's `wire` writes. The published runs were
wired when `wire` also wrote `.claude/rules/complex-md.md`: the
integration block again, loaded when the agent touched a listed path.
`wire` no longer writes it, so a rerun of the `file` arm is not the arm
those runs measured. Each new row records `cli_version` and `cli_commit`,
the CLI that wired it. Compare a rerun with rows wired the same way.

The harness fetches the parent commit from the dataset clone into a new
repository, so the agent sees the parent's history and nothing after it: no
other branches, no tags, no remote refs and no reflog. The harness checks
the object store and every ref against the base commit, and it refuses a
run if anything else is there.

The map is computed as of the task's month, which is how often a map gets
regenerated in practice. Each calendar month of task dates gets one map,
built at the oldest base commit among that month's tasks. A map serves a
task only when the map's commit is the task's base or an ancestor of it.
The harness refuses the task otherwise, so the fix under test never enters
its own map.

**Isolation.** Each agent runs in its own Linux network, mount and PID
namespaces with all capabilities dropped (`bench/sandbox.mjs`):

- Network: the only way out is a CONNECT proxy that admits
  `api.anthropic.com` and `platform.claude.com`. `--allow-host` adds hosts.
- Files: /tmp, /root, /home, /run and the other mask roots are hidden behind
  empty mounts, and so are the dataset clone, the results and this
  directory. The agent sees its checkout, a copy of the dependencies, the
  Node install, and its own install and credentials. `--mask` hides more
  directories.
- Context and tools: every arm passes `--strict-mcp-config` with an empty
  server list, claude.ai connectors are off, and `--disallowedTools
  WebFetch,WebSearch` keeps web reads out. A web search runs on the model
  provider's side, past the proxy.

The sandbox needs root and util-linux, so campaigns run as root on Linux.
`--no-sandbox` runs without it, and the report lists every run that ran
unisolated, which includes all 246 runs recorded before the sandbox. Before
a campaign, run the probe agent on the real dataset:

```sh
CX_PROBE_MARKER=<a string from a later commit> node bench/run.mjs --agent probe --stop-at none ...
```

Every `probe` event in the transcripts must say `leaked: false`.

Known gaps in the isolation:

- The Node install stays visible, and Node ships its own copy of undici
  (Node 24.22.1 has undici 7.30.1, and npm carries another). An agent with
  `Bash(node:*)` can read that copy, which can hold the real fix of an
  undici task. Treat undici results with this in mind, or run them on a
  Node whose built in undici is older than the earliest task.
- The dependency copy comes from the clone's `node_modules` at HEAD. A newer
  published copy of the package under test could hold the fix.
- The OAuth credentials are readable inside the sandbox, so an agent could
  call the model API itself through the allowed host.
- Paths outside the mask roots stay visible, and masked file names are
  visible with empty contents.

**Caps.** A run that hits the budget, the turn cap or the timeout is judged
like any other run. It is recorded in `stopped` and shown in the report's
`capped` column. A timeout sends SIGINT, then SIGKILL after `--grace`
seconds (30 by default), so the agent's result event and its cost are kept.
Every row records `wall_ms` from the harness clock.

**Task selection.** `make-dataset.mjs --danger` keeps the fixes that touched
a file the map calls risky (a hotspot, a load-bearing file, one side of a
co-change pair) and puts first the ones a later fix had to touch again within
90 days. Those are the edits where collateral damage is plausible. Without
the flag the miner takes every fix, which suits the localization question.

**Primary outcome: collateral damage.** After the agent finishes, the test
suite as it stood at the base commit runs again, file by file. A regression
is a test that passed at the base and fails after the patch, on two runs, in
a file the real fix did not change (those files are judged by the gold tests
instead). Reported as runs with any regression, paired by McNemar, and as the
count of regressed tests, paired by Wilcoxon. The patch that produced every
count is kept in `patches/`.

**Conduct.** Whether the agent did what the map asks: a test run before
finishing an edit to a risky file, and the other side of a co-change pair
opened. Judged against the computed risky set at the base commit, the same
for every arm.

**Alongside:** success on the gold tests (McNemar), wall clock, output
tokens, cost, diff size (Wilcoxon), and tool calls before the agent first
reads a file the real fix touched. The prompt does not tell the agent whether
or how much to test; that is part of what is measured.

## Cost and accounts

The agent runs on whatever account the `claude` CLI is signed in to. On a
subscription, the benchmark and any interactive session on the same account
share one usage limit; a run that hits it is recorded with the limit message
as its `error` and zero steps, excluded from every paired comparison by the
report, and should be removed from `runs.jsonl` and re-run once the limit
resets. The harness skips rows already present, so a re-run only repeats the
removed ones.

`cost_usd` is the API-equivalent price the `claude` CLI reports for a run.
On a subscription the run is not billed and the figure is a unit of tokens
consumed, comparable across arms because the same pricing is applied to
each. It is never a statement of money spent.

## Run

```sh
# 1. tasks from the repo's fix history (GITHUB_TOKEN=$(gh auth token) lifts the 60/hour API limit)
node bench/make-dataset.mjs /tmp/fastify --repo fastify/fastify --danger --months 18 --max 30 \
     --out bench/data/fastify-danger.json

# 2. dry run, nothing spent
node bench/run.mjs --dataset bench/data/fastify-danger.json --arms none,file,hooks --agent mock --out /tmp/cxbench-out

# 3. the real thing: Claude Code headless, to completion, capped per run, resumable
node bench/run.mjs --dataset bench/data/fastify-danger.json --arms none,file,hooks \
     --stop-at none --budget 2 --timeout 720 --out bench/results/<run>

# 4. tables
node bench/report.mjs bench/results/<run>/runs.jsonl
```

`--stop-at edit` ends a run at the agent's first edit: localization only,
no suite, the cheap way to run a large set. `--no-suite` runs to completion
without the regression suite.

Runs use the local `claude` login by default; set `ANTHROPIC_API_KEY` to
bill the API directly instead. `--setting-sources project` keeps the user's
own CLAUDE.md and hooks out of every arm. The hooks arm points at this
checkout's `cli/bin/complex-md.js`. An unknown `--agent` or `--arms` name
exits 2 before any run. With `CX_BENCH_NO_MODEL=1` the harness refuses every
model call, which is how its own tests run.

## Training the integration block

`skillopt/` makes the text the agent reads about COMPLEX.md a trainable
parameter, scored by this benchmark: [skillopt/README.md](skillopt/README.md).

## Backtest (no model): does the list point at the next fix?

`node bench/backtest.mjs <repo> [N=40]` rebuilds the map at the parent of
each of the last N fix commits and reports how many of the files the fix
touched were on the hotspot list, for four orderings of the same rows, against
chance for a list that size. It runs in a minute or two and spends nothing.

**2026-09-03, five repositories, 40 fixes each:**

| repository | rankable files | hotspot list | chance | `score` (0.3) | `churn_w * loc` (0.2) | by `fixes` | by `churn_w` | in a co-change pair |
|---|---|---|---|---|---|---|---|---|
| a private multi-site monorepo | 127 | 15.0 | 12% | 25% | **35%** | 25% | 34% | 12% |
| fastify | 37 | 7.2 | 20% | 50% | **52%** | 43% | 52% | 59% |
| express | 12 | 3.0 | 25% | 73% | **82%** | 82% | 78% | 24% |
| requests | 18 | 3.7 | 20% | 46% | **56%** | 48% | 43% | 6% |
| cobra | 24 | 4.7 | 20% | **61%** | **61%** | 42% | 53% | 28% |

Every ordering beats chance by 2 to 3 times, and the plain 0.2 formula is as
good or better than the 0.3 score at this job on all five. The structural
term buys blast-radius awareness (a quiet, heavily imported file on the
list), not fix prediction. `complex_where_to_look` therefore orders by
`churn_w * loc`; the hotspot list keeps the score.

## Scores from the recorded runs (no model)

These scripts read committed runs and fix history. They spend nothing.

- `node bench/comply.mjs <results> <dataset>`: for each file an agent
  edited, did it run the tests the map names for that file. Arms pair on
  task and file, with McNemar's exact test per arm.
- `node bench/partners.mjs`: co-change partner misses per arm on the damage
  runs. It writes `bench/results/partners.json`. The primary definition
  counts a Read or an edit of the partner. The wider definition was chosen
  after the primary result was known, so it is exploratory.
- `node bench/selectors.mjs --repo <clone> --name <name>`: a test selector
  backtest on fix history. `--known <results> --dataset <path>` scores the
  selectors on the tests agents broke in recorded runs, and `--summary
  bench/results/selectors` pools the repositories. Method and tables:
  [SELECTORS.md](SELECTORS.md).

## Which models write a usable map

These scripts call models through OpenRouter, so they spend money. Each
prices its run before the first call.

- `node bench/models.mjs`: the model matrix. It writes a map for ky,
  itsdangerous and pflag, each pinned by commit, with each model on
  OpenRouter. It scores each map with `mapcheck.mjs` and writes pass or fail
  per check per model, with no ranking. `--dry-run` prices the run and calls
  nothing, and `--budget` (default 10 USD) refuses a larger run. A model with
  no fixed price is refused. The key comes from
  `OPENROUTER_API_KEY_COMPLEXMD` only. The default matrix of 15 models, 12
  of them open weights, prices at 2.02 USD at most for 45 calls.
- `bench/mapcheck.mjs`: six string checks on one map: the front matter is
  byte identical, the four sections are present, every named path exists,
  there is one directive per hot file, the sentences are within the length
  limit, and there are no em dashes.

## Caveats

Same agent, same model, one repository at a time: a result says what the map
does for this agent on this codebase. Thirty paired tasks resolve a large
effect on a pass/fail outcome, not a small one. A suite that runs green at
the base commit is required; tests failing at the base are out of scope for
every arm.
