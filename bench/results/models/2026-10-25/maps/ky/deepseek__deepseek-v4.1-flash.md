---
complex_md: "0.3"
generated: 2026-10-09
commit: 3541888
tool: complex-md/0.10.0
window_commits: 592
files_analyzed: 54
profile:
  files_total: 115
  files_in_scope: 54
  loc_in_scope: 5421
  kinds: "source 52, test 47, other 4, docs 4, asset 3, ci 2, config 2, manifest 1"
  languages: "ts 52, json 2"
  dependency_edges: 2
  commits_total: 592
  commits_analyzed: 529
  commits_skipped: 63
  half_life_commits: 148
  window_from: 2018-09-04
  window_to: 2026-10-09
  velocity_30d: 6
  authors_total: 131
  concentration_50: 6
  hotspot_cut: 6
  pair_min: 4
  confidence: "structure+history"
hotspots:
  - path: source/core/Ky.ts
    kind: source
    loc: 1376
    churn: 171
    churn_w: 92.25
    fixes: 63
    authors: 37
    owner_share: 0.70
    fan_in: 0
    tests: 1
    score: 1083
  - path: source/types/options.ts
    kind: source
    loc: 555
    churn: 74
    churn_w: 42.14
    fixes: 21
    authors: 16
    owner_share: 0.74
    fan_in: 0
    tests: 0
    score: 634
  - path: source/utils/merge.ts
    kind: source
    loc: 501
    churn: 47
    churn_w: 31.63
    fixes: 18
    authors: 6
    owner_share: 0.89
    fan_in: 0
    tests: 0
    score: 550
  - path: source/types/hooks.ts
    kind: source
    loc: 424
    churn: 36
    churn_w: 18.93
    fixes: 11
    authors: 7
    owner_share: 0.83
    fan_in: 0
    tests: 0
    score: 412
  - path: source/core/constants.ts
    kind: source
    loc: 307
    churn: 42
    churn_w: 21.03
    fixes: 15
    authors: 13
    owner_share: 0.69
    fan_in: 0
    tests: 0
    score: 407
  - path: source/utils/body.ts
    kind: source
    loc: 242
    churn: 28
    churn_w: 20.93
    fixes: 4
    authors: 3
    owner_share: 0.93
    fan_in: 0
    tests: 0
    score: 377
load_bearing:
co_change:
  - files: [source/core/constants.ts, source/types/options.ts]
    count: 22
    coupling: 52
  - files: [source/types/options.ts, source/utils/merge.ts]
    count: 21
    coupling: 45
  - files: [source/types/options.ts, source/utils/body.ts]
    count: 17
    coupling: 61
  - files: [source/types/hooks.ts, source/types/options.ts]
    count: 15
    coupling: 42
  - files: [source/index.ts, source/types/hooks.ts]
    count: 13
    coupling: 39
  - files: [source/types/ky.ts, source/types/options.ts]
    count: 12
    coupling: 55
  - files: [source/types/options.ts, source/types/retry.ts]
    count: 11
    coupling: 69
  - files: [source/types/options.ts, source/utils/normalize.ts]
    count: 11
    coupling: 61
  - files: [source/errors/HTTPError.ts, source/types/hooks.ts]
    count: 9
    coupling: 53
  - files: [source/core/constants.ts, source/types/ky.ts]
    count: 9
    coupling: 41
seams:
  - dirs: [source/types, source/utils]
    count: 54
    coupling: 52
  - dirs: [source/core, source/types]
    count: 30
    coupling: 68
  - dirs: [source/core, source/utils]
    count: 26
    coupling: 59
  - dirs: [source, source/types]
    count: 23
    coupling: 70
  - dirs: [source/errors, source/types]
    count: 17
    coupling: 68
  - dirs: [source, source/utils]
    count: 16
    coupling: 48
blind_spots:
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

The map leaves out 1 credential-shaped path. Risk concentrates in the request lifecycle in source/core/Ky.ts and the public option types in source/types/options.ts. It also sits in the merge helpers in source/utils/merge.ts, the hook types in source/types/hooks.ts, and the feature checks in source/core/constants.ts. Bug fixes land mostly in Ky.ts (63 fixes), options.ts (21 fixes), and merge.ts (18 fixes). The load-bearing list is empty, and every hotspot has fan_in 0; the analysis found 2 dependency edges, so no stable floor is visible. Ownership is concentrated: merge.ts has 89% from one committer, body.ts 93%, and Ky.ts has 37 authors with 70% from the top one.

## Why these files are hot

source/core/Ky.ts is the Ky class: it resolves input, merges options and headers, runs hooks, retries, enforces timeouts, and reads error bodies. It has 171 commits and 63 fixes, so fixes drive much of its churn. It imports options, merge, body, normalize, constants, and errors; edits can break request resolution, retry timing, timeout races, or error-body limits. Only test/hooks.ts covers it. Before editing this file, run the test in test/hooks.ts and open source/types/options.ts, source/utils/merge.ts, and source/utils/body.ts alongside it; preserve the option-merge, hook, and timeout invariants.

source/types/options.ts defines the public options contract: KyOptions, Options, InitOptions, InternalOptions, NormalizedOptions, and the exported retry and hook types. It has 74 commits and 21 fixes. The analysis finds no covering test. It co-changes with constants.ts, merge.ts, body.ts, hooks.ts, ky.ts, retry.ts, and normalize.ts at 42% to 69%, so a type change can leave runtime merge or normalization behind. Before editing this file, open those partner files and add a type-level test for the changed option.

source/utils/merge.ts implements deepMerge, validateAndMerge, mergeHeaders, mergeHooks, replaceOption, and the clone helpers. It has 47 commits and 18 fixes, with 89% of commits from one owner. It depends on options.ts, hooks.ts, and constants.ts, and its merge rules decide what extend and init hooks change. No test covers it. Before editing this file, add focused tests for the merge rule you change, with headers, hooks, search parameters, and replaceOption, then compare the result against source/types/options.ts and source/types/hooks.ts.

source/types/hooks.ts defines the hook state, return types, Hooks map, and NormalizedHooks. It has 36 commits and 11 fixes. It co-changes with options.ts at 42%, index.ts at 39%, and HTTPError.ts at 53%, because hook state carries options, responses, and errors. No test covers it. Before editing this file, open source/types/options.ts, source/index.ts, and source/errors/HTTPError.ts and add a type-level hook test for each changed state or return type.

source/core/constants.ts holds platform feature checks, responseTypes, maxSafeTimeout, stop, RetryMarker, and option-key lists. It has 42 commits and 15 fixes. It co-changes with options.ts at 52% and ky.ts at 41%. No test covers it. Before editing this file, open source/types/options.ts and source/core/Ky.ts and add a focused test for the changed constant or feature check.

## Change coupling

source/types/options.ts is the hub: it couples with retry.ts at 69%, normalize.ts and body.ts at 61%, ky.ts at 55%, constants.ts at 52%, and merge.ts at 45%. This coupling is by design: an option must move with its type, its normalization, its body behavior, and its runtime merge. The source/types + source/utils seam (54 commits, 52%) repeats the same pattern across many files. Open source/utils/normalize.ts, source/utils/body.ts, and source/utils/merge.ts when you change an option, and update the type and runtime path in one change.

The source/core + source/types seam reaches 68%, and the source + source/types seam reaches 70%. Ky.ts and constants.ts move with options.ts and hooks.ts because the class reads the option and hook contracts at request time. This coupling is by design for the request pipeline, but it is fragile when a new option lands only in the type file. Open source/core/Ky.ts and source/types/options.ts together when a core file changes, and check that the runtime path reads the new field.

HTTPError.ts and hooks.ts couple at 53%, and the source/errors + source/types seam reaches 68%. Hook state carries errors, and HTTPError feeds beforeRetry and beforeError, so the error shape and the hook type must move together. This coupling is by design. Open source/errors/HTTPError.ts and source/types/hooks.ts together when either error state or error type changes.

## What to read first

1. source/types/options.ts — the public option contract; read it before any hot edit.
2. source/core/Ky.ts — the request lifecycle and the largest hotspot.
3. source/utils/merge.ts — the merge rules for extend, headers, and hooks.
4. source/types/hooks.ts — the hook states and return types.
5. source/core/constants.ts — the feature checks and shared constants.