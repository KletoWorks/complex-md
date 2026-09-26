# Benchmark results

Method: [README.md](README.md). Statistics: [stats.mjs](stats.mjs).

## Summary

Three runs on fastify, 24 tasks, up to four arms, all paired against the
repository without a map. Localization to the first edit shows no difference;
the map's effect, where it appears, is on what the agent produces rather than
where it looks. A run to completion on the full outcome set is in progress.

## Outcomes measured

The same outcomes as the published AGENTS.md evidence (arXiv 2601.20404,
AAIF), plus the localization metric this benchmark was built around:

| outcome | how | test |
|---|---|---|
| time to a finished change | wall clock, ms | Wilcoxon signed rank |
| output tokens | from the agent's usage report | Wilcoxon signed rank |
| cost | API equivalent, per run | Wilcoxon signed rank |
| diff size | lines added plus removed | Wilcoxon signed rank |
| success | agent's patch passes the real fix's tests | McNemar |
| steps to first relevant read | tool calls | Wilcoxon, sign test |

Rank based tests throughout: the step distribution is discrete, floored at 1
and long tailed, and a mean would let one long run decide the result.

## Run: 24 tasks, to the first edit, 2026-09-26

| arm | n | median steps | median output tokens | median cost / run |
|---|---|---|---|---|
| none | 24 | 2.0 | 56.5 | 27.0c |
| file | 24 | 2.0 | 41.0 | 33.8c |
| hooks | 23 | 3.0 | 52.0 | |

Paired against none:

| arm | outcome | pairs | median change | p |
|---|---|---|---|---|
| file | output tokens | 24 | -27.4% | 0.14 |
| file | steps to first read | 24 | 0 | 0.52 |
| hooks | output tokens | 23 | -5.5% | 0.76 |

The output token reduction with the map is the same direction and a similar
size to arXiv 2601.20404's finding for AGENTS.md (-16.6% at the median,
n=124), at n=24. The `hooks` arm acts at the first edit, which is where this
run stops, so it is measured properly by the run to completion below.

The MCP server was also run in this design and did not improve any outcome;
as of 0.8.0 it is opt in.

## Run: 24 tasks, to completion, four arms. In progress.

Arms: none; front (computed front matter only, no generated prose); file;
hooks. All outcomes above. The `front` arm asks whether the computed half of
the map carries the effect on its own. Results land here on completion.

## Power

Paired differences on steps have a standard deviation of 3.4 on this task
set. At alpha 0.05 and 80 percent power, resolving a one step difference
needs 93 pairs; a two step difference, 24. The rank based tests above do not
depend on that variance in the same way, which is why they are primary.

## Limitations

One repository. fastify is well factored and heavily tested, so the baseline
agent reaches the right file in a median of two tool calls, which leaves
little for localization to improve. Cost is API equivalent, not billed.

## Reproducing

```sh
node bench/run.mjs --dataset bench/data/fastify.json --arms none,front,file,hooks \
  --tasks 0-23 --stop-at none --out bench/results/<run>
node bench/report.mjs bench/results/<run>/runs.jsonl
```

Raw runs: `bench/results/`.
