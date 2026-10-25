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

Risk concentrates in request execution, option contracts, and merge semantics; 6 files hold half the total score.
Fixes landed most in `source/core/Ky.ts` with 63, `source/types/options.ts` with 21, and `source/utils/merge.ts` with 18.
The top committer supplied 70% of Ky.ts commits, 74% of options.ts commits, and 89% of merge.ts commits.
The analysis found only 2 dependency edges, so zero fan-in does not establish isolation.
The map identifies no load-bearing files.
The map excludes 1 credential-shaped path from every list.

## Why these files are hot

Ky.ts coordinates requests, retries, hooks, timeouts, and response bodies.
Its 171 commits included 63 fixes across this execution contract.
Its imports connect the other hotspots despite the zero recorded fan-in.
Changes can break abort behavior or leave response bodies unreleased.
`test/hooks.ts` covers it.
Before editing this file, run the tests in `test/hooks.ts`.

options.ts defines public options and internal option forms.
Its 74 commits included 21 fixes.
Ky.ts and merge.ts import these types, so changes affect runtime contracts as well as caller types.
Options and NormalizedOptions remain interfaces for external extension.
The analysis found 0 tests.
Before editing this file, verify the changed option against its validation and default behavior in Ky.ts.

merge.ts combines headers, hooks, search parameters, and option layers.
Its 47 commits included 18 fixes.
Ky.ts uses its clone and merge helpers, so changes can leak mutations between requests or restore deleted values.
The analysis found 0 tests.
Before editing this file, verify deletion markers and request isolation with consecutive calls from the same extended instance.

`source/types/hooks.ts` defines hook state, return values, and lifecycle contracts.
Its 36 commits included 11 fixes.
Ky.ts executes these hooks, and merge.ts combines their arrays.
Changes can alter retry control or the scope of option mutations.
The analysis found 0 tests.
Before editing this file, compare the changed hook contract with its execution path in Ky.ts.

`source/core/constants.ts` defines capability probes, retry markers, response shortcuts, and option keys.
Its 42 commits included 15 fixes.
Ky.ts imports these controls, and hooks.ts derives allowed retry updates from them.
Changes can break environment support or recognition across separate Ky copies.
The analysis found 0 tests.
Before editing this file, verify that stop symbols and retry markers work across separate Ky copies.

## Change coupling

constants.ts and options.ts shared 22 commits at 52% coupling.
Their typed option registry makes this a deliberate contract.
options.ts and merge.ts shared 21 commits at 45%, which links option declarations to composition rules.
Check the registry and merge rules for each changed option.

options.ts and hooks.ts shared 15 commits at 42% coupling.
The source/core and source/types seam reached 68%; the source/core and source/utils seam reached 59%.
The hook types, execution paths, and merge helpers implement different parts of the same lifecycle.
Check each changed hook against its type, execution path, and merge rule.

options.ts and `source/utils/body.ts` shared 17 commits at 61% coupling.
The options.ts contract explicitly connects URL changes to request body reuse.
The source/types and source/utils seam reached 52%, which extends this concern beyond individual pairs.
Verify body retention when search parameters leave the URL unchanged and when they change it.

## What to read first

1. options.ts — Read the public contract for URL resolution, retries, timeouts, and body reuse.
2. constants.ts — Read the capability probes, option registry, and shared retry controls.
3. merge.ts — Read deletion markers, replacement wrappers, and clone boundaries before changes to option composition.
4. hooks.ts — Read lifecycle order and permitted return values before changes to hook behavior.
5. Ky.ts — Trace the execution path for the contract that you plan to change.
6. `test/hooks.ts` — Read the identified coverage before changes to hook execution.