# Benchmark results

What the localization benchmark has measured, including when it measured
nothing. Method is in [README.md](README.md).

The project's claim is that a computed map beats recollection. A project
making that claim while withholding its own measurements asserts exactly what
it tells everyone else not to, so the results are here whatever they say and
the limits come before the numbers.

## Status as of 2026-09-26

**No effect demonstrated.** The direction is now consistently favourable and
no cut of the data reaches significance. The map arm also costs 25 percent
more per run. Anyone choosing this tool should do so on the argument, not on
these numbers.

## fastify, 24 tasks, 2026-09-26

One repository, 24 tasks, two arms, 48 runs, 5.81 USD.

| arm | n | found gold | steps to first gold read (median / mean) | wasted reads (mean) | gold edited | cost/run |
|---|---|---|---|---|---|---|
| none | 24 | 96% | 2.0 / 3.3 | 0.0 | 88% | 27.0c |
| file | 24 | 96% | 2.0 / 2.7 | 0.1 | 88% | 33.8c |

Paired, same task and same base commit, 22 usable pairs:

| cut | pairs | mean delta steps | sd | 95% CI | p |
|---|---|---|---|---|---|
| all | 22 | -0.73 | 3.43 | [-2.16, +0.70] | 0.32 |
| issue names a gold file | 7 | -1.00 | 2.00 | [-2.48, +0.48] | 0.19 |
| issue names none | 15 | -0.60 | 3.98 | [-2.61, +1.41] | 0.56 |

Counts: 8 tasks better, 10 unchanged, 6 worse. Sign test on the 14 non tied
pairs, p = 0.79.

Negative means fewer tool calls with the map. The direction is favourable in
every cut and no cut is distinguishable from zero.

## The power calculation, and why the first one was wrong

Done on the pilot's 8 pairs, the standard deviation of the paired differences
was 0.641, implying 13 pairs would resolve half a step and 52 would resolve a
quarter. Twenty four tasks should have settled the question.

It did the opposite. On the fuller task set the standard deviation is
**3.425**, five times larger, because the added tasks include runs of 8 and 10
steps and two where the agent never reached a gold file at all. The pilot's
low variance was a property of its easy tasks, not of the measurement.

Pairs needed for 80 percent power at alpha 0.05, under each variance:

| effect | sd = 0.641 (pilot) | sd = 3.425 (measured) |
|---|---|---|
| 0.5 step | 13 | 369 |
| 1.0 step | 4 | 93 |
| 1.5 step | 2 | 41 |
| 2.0 step | 1 | 24 |

At n=22 the minimum detectable effect is **2.05 steps**. The observed
difference is 0.73, so this run could not have resolved the effect it saw, and
the earlier estimate of what was needed was out by a factor of twenty five.

**The lesson is about the method, not the tool.** A power calculation is only
as good as the variance it assumes, and variance measured on tasks selected
for being easy underestimates the real thing. Any future estimate here should
come from the hardest tasks available rather than the convenient ones.

## What this run does and does not rule out

- It does not show the map helps. p = 0.32.
- It does not show the map fails. The interval spans a two step improvement.
- It does rule out a very large effect on this repository: better than about
  2.2 steps is outside the interval.
- The cost difference is the most solid number here. 27.0c against 33.8c per
  run, consistent with the pilot's 20 percent, because the file occupies
  context whether or not it is used. A map that saves 0.7 steps and costs 25
  percent more is a trade, and which way it falls depends on the price of a
  tool call against the price of tokens.

## What the next run needs

Ninety three pairs to resolve one step at the measured variance. At two arms
and 30c per run that is about 56 USD, at four arms about 112 USD. Before
spending it:

- **Reduce the variance rather than chase it with n.** Most of it comes from a
  few very long runs and two failures to find the file at all. A trimmed mean
  or a rank based test alongside, and a step cap, would buy more power per
  dollar than more tasks.
- **Run the `hooks` and `mcp` arms.** Still unexercised, and they carry the
  enforcement the file alone does not have. The file arm is the weakest arm
  the tool has and the only one ever measured.
- **A second repository**, with more coupling than fastify, which is well
  factored and heavily tested and close to the worst case for a tool that
  points at structural risk.
- **Report cost as a primary outcome**, not a footnote. It is the only number
  so far that is clearly non zero.

## Reproducing

```sh
node bench/make-dataset.mjs   # build tasks from a repository's fix history
node bench/run.mjs --dataset bench/data/fastify.json --arms none,file \
  --tasks 0-23 --stop-at edit --out bench/results/<run>
node bench/report.mjs bench/results/<run>/runs.jsonl
```

Raw runs: `bench/results/fastify-n24/runs.jsonl`. Its first 16 lines are the
8 task pilot, kept separately in `bench/results/fastify-pilot/`.
