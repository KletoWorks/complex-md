# Localization benchmark

Does COMPLEX.md get an agent to the right file faster? This measures it on a
repository's own history instead of asserting it.

## Method

Each task is a real fix commit from the last twelve months: the issue (or PR)
text is the prompt, the commit's parent is the starting point, and the source
files the fix touched are the answer. The agent runs from a clean worktree at
the parent commit under two or more arms:

| arm | what the agent gets |
|---|---|
| `none` | the repository as it was |
| `file` | COMPLEX.md computed as of that commit, wired (`CLAUDE.md`, path-scoped rule) |
| `hooks` | `file` plus the PreToolUse gate and Stop check |
| `mcp` | `hooks` plus the MCP server |

The map is computed at the task's base commit with the twelve-month window
anchored there, so the fix being tested never leaks into its own `fixes` count.
One map per calendar month of base dates, which is how often a map gets
regenerated in practice.

Primary metric: tool calls before the agent first reads a file the real fix
touched. Secondary: distinct files read before that (wasted reads), whether the
final diff touches a gold file, gate firings, MCP calls, cost. Tasks whose issue
text already names a gold file are tagged (`names_gold`) and reported separately;
the map should matter most where the text does not say where to look.

`--stop-at edit` ends a run at the agent's first edit. Localization is decided
by then, and it is the cheap way to run the whole set.

## Run

```sh
# 1. tasks from the repo's fix history (GITHUB_TOKEN=$(gh auth token) lifts the 60/hour API limit)
node bench/make-dataset.mjs /tmp/fastify --repo fastify/fastify --max 24 --out bench/data/fastify.json

# 2. dry run, nothing spent
node bench/run.mjs --dataset bench/data/fastify.json --arms none,file,hooks --agent mock --out /tmp/cxbench-out

# 3. the real thing: Claude Code headless, capped per run, resumable
node bench/run.mjs --dataset bench/data/fastify.json --arms none,file,hooks --agent claude \
     --budget 0.60 --timeout 420 --stop-at edit --out bench/results/fastify-1

# 4. tables
node bench/report.mjs bench/results/fastify-1/runs.jsonl
```

Runs use the local `claude` login by default; set `ANTHROPIC_API_KEY` to
bill the API directly instead.
`--setting-sources project` keeps the user's own CLAUDE.md and hooks out of every
arm. The hooks arm points at this checkout's `cli/bin/complex-md.js` because
the package is not on npm yet.

## Results so far

**fastify, pilot, 2026-09-03** (`results/fastify-pilot`): 8 tasks, arms
`none` and `file`, Claude Code headless, stopped at first edit. Both arms
found a gold file in 100% of runs; median tool calls to the first gold read
was 2.0 in both arms (mean 2.1 vs 2.3); paired, the map won 1, tied 5, lost 2.
Wasted reads before the gold file: 0.0 vs 0.1.

Reading: on this repository localization is not the bottleneck. fastify has
62 source files in scope, a flat `lib/` with descriptive names, and the task
text is mostly PR descriptions written by the person who fixed the bug, so
the agent's first or second read is the right file with or without a map.
The SWE-bench numbers the spec cites (half of turns spent locating) come
from repositories one to two orders of magnitude larger, with issue text
written by users. A null here is not evidence the map fails there; it is
evidence this repository cannot show the effect.

What the pilot does not measure: whether the agent also touched the
co-change partners and tests the real fix touched. That is the claim the
hooks and the Stop check make, and it needs full runs (no `--stop-at`) and a
recall metric against the fix's complete file set. Next design, in order:

1. A repository where localization is expensive: 1,000+ source files, deep
   directories, issue-sourced tasks (`source: issue` only).
2. Full runs with `gold_recall` = fraction of the real fix's files (source
   and tests) the agent's diff touched, and `partner_recall` for co-change
   partners specifically. This is where `hooks` is expected to separate from
   `file`.
3. Only then, cost per solved task across arms.

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

Reading: every ordering beats chance by 2 to 3 times, and the plain 0.2
formula is as good or better than the 0.3 score at this job on all five. The
structural term buys blast-radius awareness (a quiet, heavily imported file on
the list), not fix prediction. `complex_where_to_look` therefore orders by
`churn_w * loc`; the hotspot list keeps the score. The `fixes` count, which
`where_to_look` used until 0.3.1, is the weakest of the four on three of five
repositories. This is also why the hotspot cut now caps at a fifth of the
rankable files: before it, express listed 10 of its 13 files.

## Caveats

Same agent, same model, one repository: a result here says what the map does
for this agent on this codebase, not in general. Twenty-four paired tasks give
a sign test, not a confidence interval. Fix commits whose text names the file
are easy in both arms; watch the split.
