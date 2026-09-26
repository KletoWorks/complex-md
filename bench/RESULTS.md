# Benchmark results

What the localization benchmark has measured, including when it measured
nothing and when it measured the wrong thing. Method is in
[README.md](README.md); the statistics are in [stats.mjs](stats.mjs).

## Status as of 2026-09-26

Four arms, 24 tasks, 96 runs, one repository. The agent ran on a Claude Max
subscription; the API-equivalent price the CLI reports for all 96 runs is
6.51 USD, and that figure is the unit used for cost throughout, not money
spent.

- **`file`**: no effect on localization. Output tokens 27 percent lower at
  the median, not significant (p = 0.14). Cost 25 percent higher per run.
- **`hooks`**: cannot be evaluated by this harness. See below.
- **`mcp`**: **worse, and significantly.** Output tokens 33 percent higher
  (Wilcoxon p = 0.036), more steps to the right file (sign test p = 0.049),
  cost 2.2 times the baseline. The agent makes the calls and they do not pay
  for themselves.

Anyone choosing this tool should do so on the argument, not on these numbers,
and should not enable the MCP server on the strength of them.

## Per arm

| arm | n | found gold | steps to first gold read (median / mean) | gate fired | MCP calls | API-equivalent cost/run |
|---|---|---|---|---|---|---|
| none | 24 | 96% | 2.0 / 3.3 | 0 | 0 | 27.0c |
| file | 24 | 96% | 2.0 / 2.7 | 0 | 0 | 33.8c |
| hooks | 23 | 91% | 3.0 / 3.3 | 17 | 0 | not recorded |
| mcp | 24 | 96% | 3.0 / 3.5 | 15 | 27 | 60.3c |

## Paired tests against `none`

Wilcoxon signed rank is the primary test. It ranks the paired differences
rather than averaging them, so one 10 step run cannot outweigh twenty 2 step
runs, which is what happened to the mean in the previous version of this
page. It is also the test arXiv 2601.20404 uses on the same shape of data.
The trimmed mean drops 10 percent from each tail. Negative favours the arm.

| arm | metric | pairs | median none | median arm | trimmed Δ | Wilcoxon p | sign p |
|---|---|---|---|---|---|---|---|
| file | steps to first gold read | 24 | 2.0 | 2.0 | -0.3 | 0.52 | 0.79 |
| file | output tokens | 24 | 56.5 | 41.0 | -9.3 | 0.14 | 0.15 |
| hooks | steps to first gold read | 23 | 2.0 | 3.0 | 0.0 | 0.76 | 0.80 |
| hooks | output tokens | 23 | 55.0 | 52.0 | -1.5 | 0.76 | 0.83 |
| mcp | steps to first gold read | 24 | 2.0 | 3.0 | +0.5 | 0.22 | **0.049** |
| mcp | output tokens | 24 | 56.5 | 75.0 | +19.5 | **0.036** | 0.09 |

Minimum detectable effect on steps at this n and variance: about 2.3 steps.

## What each arm shows

**`file`.** The only arm ever measured before this run, and still a null on
the localization metric. The 27 percent drop in output tokens is the most
interesting number in the file: it is the same direction and a similar size
to what arXiv 2601.20404 found for AGENTS.md (median output tokens down 16.6
percent, n=124, significant). Here it is n=24 and not significant. It would
mean the agent reasons less before acting when the map is present. Whether
that is real is the question the next run should be designed to answer.

**`hooks`.** The harness stops at the first edit attempt. The PreToolUse hook
acts at the first edit attempt. So the run ends at the moment the mechanism
under test begins, and every downstream effect of the hook, whether the agent
then reads the partner file, runs the covering test, or edits something
better, is truncated out of the data. `gold_edited` collapses from 88 to 17
percent in this arm for that reason and for no other: the agent reached the
gold file (`first_gold_read` is unaffected), the gate refused the edit, and
the harness recorded the refusal as the end. That column is void for this
arm. What the arm does show: the gate fired on 17 of 23 tasks, so the files
the real fixes touched are files the map lists, which is a fact about the
map's coverage and not about its usefulness.

**`mcp`.** The one clear result. The agent called the MCP server 27 times
across 24 runs, took more steps to reach the right file, produced a third
more output tokens, and cost 2.2 times as much. On a task set where the
baseline needs two tool calls, a tool that offers more calls is overhead by
construction, and the agent takes the offer. This is a negative finding about
the current wiring and it should change the default: the MCP server should
not be installed by `npx complex-md` until a run shows it earning its calls.

## Cost, stated properly

Three different things were being called cost and they are not alike.

1. **Running this benchmark.** The agent ran on a Claude Max subscription,
   so the runs consumed plan usage rather than being billed. `cost_usd` is
   the API-equivalent price the CLI computes for each run, and 6.51 USD is
   that figure summed over 96 runs. It is kept as the unit because it is
   the same pricing model applied to every arm, so ratios between arms
   (2.2 times for `mcp`, 1.25 for `file`) are meaningful even though the
   absolute number was never charged. An earlier version of this page
   presented it as money spent; it was not.
2. **Using the tool** costs nothing per edit. The map is computed locally by
   `npx complex-md`; the one model call is the optional prose step at
   generation time, and the tool works without it.
3. **Having the map in the agent's context** is the cost that lands on a
   user, every turn. It is what the 25 percent in the `file` arm measures. It
   is also the number most likely to be overstated: a map is byte identical
   across turns, which is exactly what a prompt cache is for, and `tokens_in`
   in earlier runs summed cached reads at full weight. Runs from this version
   of the harness record fresh, cache read and cache write tokens separately.
   `cost_usd`, priced by the agent itself, is the only figure to quote as
   money.

## The power calculation, corrected

Done on the pilot's 8 pairs, the standard deviation of the paired differences
was 0.641, implying 13 pairs would resolve half a step. On the 24 task set it
is 3.425, because the added tasks include runs of 8 and 10 steps and two where
the agent never reached a gold file. Pairs needed for 80 percent power at
alpha 0.05:

| effect | sd = 0.641 (pilot) | sd = 3.425 (measured) |
|---|---|---|
| 0.5 step | 13 | 369 |
| 1.0 step | 4 | 93 |
| 2.0 step | 1 | 24 |

The earlier estimate was out by a factor of twenty five. A power calculation
is only as good as the variance it assumes, and variance measured on easy
tasks underestimates the real thing. The rank based tests above are the
response: they do not depend on that variance in the same way.

## Is this the right outcome at all?

arXiv 2601.20404 measured AGENTS.md on 124 pull requests across 10
repositories with Codex and found wall clock time down 28.6 percent at the
median and output tokens down 16.6 percent, both significant, running each
task to completion. This benchmark measures tool calls to the first read of a
file the fix touched, and stops there.

Those are different questions. Theirs is what a user pays for: time and
tokens to a finished change. Ours is one mechanism by which a map might
deliver that. A map could win theirs while showing nothing on ours, if what
it saves is deliberation rather than navigation, and the output token result
in the `file` arm is a hint in that direction. The next run should measure
what they measured, to completion, and keep localization as a secondary.

## What the next run needs, in order

1. **Run to completion, not to the first edit.** The `hooks` arm cannot be
   evaluated any other way, and time and tokens to a finished change are the
   outcomes that justify adoption. Roughly three times the tokens per run.
2. **Wall clock and output tokens as primary outcomes**, localization as
   secondary, Wilcoxon throughout.
3. **Disable the MCP server by default** before anyone else measures it.
4. **Report cost as a primary outcome**, with fresh and cached input separated.
5. Ninety three pairs to resolve one step of localization at the measured
   variance, but the point of items 1 and 2 is that steps may be the wrong
   thing to resolve.

## Reproducing

```sh
node bench/run.mjs --dataset bench/data/fastify.json --arms none,file,hooks,mcp \
  --tasks 0-23 --stop-at edit --out bench/results/<run>
node bench/report.mjs bench/results/<run>/runs.jsonl
```

Raw runs: `bench/results/fastify-n24/runs.jsonl`. The first 16 lines are the
8 task pilot, kept separately in `bench/results/fastify-pilot/`.
