# Benchmark results

What the localization benchmark has measured so far, including when it
measured nothing useful. Method is in [README.md](README.md).

The project's claim is that a computed map beats recollection. A project
making that claim and withholding its own measurements would be asserting
exactly what it says nobody should assert, so the results live here whatever
they say, and the limits are stated before the numbers.

## Status: one underpowered pilot. No effect demonstrated.

**As of 2026-09-25 there is no evidence that COMPLEX.md reduces the work an
agent does to locate a fix.** There is also no evidence against it. The only
run so far is too small to separate the two, and it is reported below rather
than held back until it says something more flattering.

## fastify pilot, 2026-09

One repository, eight tasks, two arms, sixteen runs.

Per arm:

| arm | n | found gold | steps to first gold read (median / mean) | wasted reads (mean) | gold edited | cost/run |
|---|---|---|---|---|---|---|
| none | 8 | 100% | 2.0 / 2.1 | 0.0 | 100% | 22.4c |
| file | 8 | 100% | 2.0 / 2.3 | 0.1 | 100% | 26.9c |

Paired, same task and same base commit:

| arm | pairs | fewer steps | same | more | mean Δ steps | mean Δ wasted reads |
|---|---|---|---|---|---|---|
| file | 8 | 1 | 5 | 2 | +0.1 | +0.1 |

Split by whether the issue text already named a file the fix touched: named,
n=1, median 2.0 both arms; not named, n=7, median 2.0 both arms.

### Read this as: inconclusive, and slightly negative on cost

One task improved, five were unchanged, two got worse. The mean difference is
+0.1 steps, which at n=8 is indistinguishable from no difference. The map arm
cost 20 percent more per run, which is real: the file occupies context whether
or not it is used.

### Why the pilot could not have shown an effect

Four reasons, and the first two are decisive.

1. **The floor is too low.** The baseline already found a gold file in a
   median of 2 tool calls, with 0.0 wasted reads and a 100 percent hit rate.
   There is almost nothing to remove. A map that helps an agent search cannot
   demonstrate it against tasks that need no searching.
2. **n=8.** Eight paired tasks cannot resolve a difference of a fraction of a
   step. No arrangement of these numbers would have been meaningful.
3. **Only the `file` arm ran.** The `hooks` and `mcp` arms, which are the ones
   carrying the enforcement the file alone does not have, were not exercised.
4. **One repository.** fastify is well factored and heavily tested, which is
   close to the worst case for a tool that points at structural risk.

### What would make the next run conclusive

- Tasks selected for difficulty: fixes whose issue text names no file, in
  repositories with more coupling than fastify has.
- Enough paired tasks to resolve a one step difference, which is a power
  calculation this project has not yet done and should.
- All four arms, so the file, the hooks and the MCP server are separable.
- More than one repository, chosen to differ in factoring and test coverage.
- Cost reported alongside, since a map that helps but costs 20 percent more
  per run is a trade rather than a win.

## Reproducing

```sh
node bench/make-dataset.mjs   # build tasks from a repository's fix history
node bench/run.mjs            # run the arms
node bench/report.mjs bench/results/<run>/runs.jsonl
```

Raw runs for the pilot: `bench/results/fastify-pilot/runs.jsonl`.
