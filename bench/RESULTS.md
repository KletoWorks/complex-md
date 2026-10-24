# Benchmark results

Method: [README.md](README.md). Statistics: [stats.mjs](stats.mjs). Raw runs,
transcripts, maps and patches: `bench/results/`.

Every run below used Claude Code 2.1.260 headless with Claude Opus 5, read
from each transcript's init event.

## Summary

**Agents follow it.** On two repositories with no shared tasks, agents ran
the tests the map names on 14 of 15 risky edits, against 3 of 17 without it
(11 of 11 discordant pairs, p about 0.001).

**It does not cost correctness.** On the real fix's own tests, every arm with
the map passed within one task of the arm without it, in every run. On undici
the two arms passed the same 20 of 26 judged tasks.

## Finished runs

| run | repository | tasks | arms | runs |
|---|---|---|---|---|
| `fastify-complete` | fastify | 24 | none, front, file, hooks | 96 |
| `fastify-damage` | fastify | 30 | none, file, hooks | 90 |
| `undici-damage` | undici | 30 | none, file | 60 |

Each run goes to completion: the agent finishes the task, then the judge runs
the real fix's tests and, in the two damage runs, the whole suite as it stood
at the base commit. `fastify-complete` and `fastify-damage` share 13 tasks;
`undici-damage` shares none with either.

## Agents run the tests the map names

A risky edit is an edit to a file whose paragraph in the map says "Before
editing this file, run" and names test files or a test directory. The edit
counts as followed when the agent's shell commands named every test file and
directory that sentence names. The same map judges every arm of a task,
including the arm that never saw it.

| run | none | front | file | hooks | discordant pairs, arm only : none only |
|---|---|---|---|---|---|
| `undici-damage` | 1 of 5 | | 3 of 3 | | file 2 : 0 |
| `fastify-damage` | 2 of 12 | | 11 of 12 | 12 of 12 | file 9 : 0, hooks 10 : 0 |
| `fastify-complete` | 0 of 11 | 0 of 12 | 4 of 11 | 10 of 11 | file 4 : 0, hooks 10 : 0 |

The two damage runs share no task, so their pairs add: `file` against `none`
gives 11 discordant pairs, all in the map's favour (exact McNemar, p about
0.001). Adding `fastify-complete` gives 15 of 15 (p about 0.00006), but 13 of
its tasks repeat `fastify-damage`, so that figure counts some tasks twice.

## Success on the real fix's tests

| run | arm | judged pairs | none passed | arm passed | arm only : none only | McNemar p |
|---|---|---|---|---|---|---|
| `fastify-complete` | front | 20 | 16 | 17 | 1 : 0 | 1.000 |
| `fastify-complete` | file | 20 | 16 | 17 | 1 : 0 | 1.000 |
| `fastify-complete` | hooks | 20 | 16 | 16 | 0 : 0 | |
| `fastify-damage` | file | 29 | 20 | 19 | 0 : 1 | 1.000 |
| `fastify-damage` | hooks | 29 | 20 | 19 | 0 : 1 | 1.000 |
| `undici-damage` | file | 26 | 20 | 20 | 0 : 0 | |

A run stopped by its budget cap has no success judgement and leaves its pair.

## Outcomes measured

| outcome | how | test |
|---|---|---|
| map-named tests run | shell commands against the map's "Before editing" sentence | McNemar, exact |
| success | agent's patch passes the real fix's tests | McNemar |
| collateral damage | a test that passed at the base fails after the patch, twice, in a file the fix did not change | McNemar, Wilcoxon |
| time to a finished change | wall clock, ms | Wilcoxon signed rank |
| output tokens | from the agent's usage report | Wilcoxon signed rank |
| cost | API equivalent, per run | Wilcoxon signed rank |
| diff size | lines added plus removed | Wilcoxon signed rank |

Rank based tests throughout, so one long run cannot decide a result.

## Limitations

- Collateral damage could not be compared: no fastify run broke a test, and
  on undici both arms broke the same tests on the same 2 tasks.
- The map costs more per run, at API equivalent prices. At the median,
  `hooks` costs about 50% more and takes 62% to 100% more wall clock
  (p < 0.01 in both fastify runs). `file` costs 17% to 31% more, a
  difference that reaches p < 0.01 only in `fastify-damage`.
- One agent and one model. Each task worktree shared the dataset clone's
  history, so in every arm an agent could read commits after its base.
- A month's map is built at the base of the first task run in that month. For
  at least 8 of 30 undici tasks, 12 of 30 `fastify-damage` tasks and 18 of 24
  `fastify-complete` tasks, that base is dated after the task's own fix.

## Reproducing

```sh
node bench/run.mjs --dataset bench/data/fastify-danger.json --arms none,file,hooks \
  --stop-at none --budget 2 --timeout 720 --out bench/results/<run>
node bench/report.mjs bench/results/<run>/runs.jsonl
```

`bench/data/` holds the three datasets: `fastify.json`, `fastify-danger.json`
and `undici-danger.json`.
