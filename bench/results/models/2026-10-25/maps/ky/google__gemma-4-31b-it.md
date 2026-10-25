```yaml
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

Change risk concentrates in the request lifecycle and option merging logic. The core logic is in `source/core/Ky.ts`, which handles request construction, timeouts, and retries. Bug fixes primarily land in `source/core/Ky.ts` with 63 fixes and `source/types/options.ts` with 21 fixes. The map does not cover credential paths.

## Why these files are hot

`source/core/Ky.ts` implements the main `Ky` class. It manages the fetch loop, hook execution, and response processing. It changes frequently due to complex retry and timeout edge cases. `test/hooks.ts` covers it. Before editing this file, run `test/hooks.ts`.

`source/types/options.ts` defines the configuration schema for the library. It changes when new features are added or existing options are refined. No test files cover this file. Before editing this file, verify all consuming types in `source/core/Ky.ts`.

`source/utils/merge.ts` handles the deep merging of options and hooks. It is hot because it must support a complex "replace" mechanism to override inherited options. No test files cover this file. Before editing this file, check the `replaceOption` logic.

`source/types/hooks.ts` defines the state and return types for the request lifecycle hooks. It changes as hook signatures evolve to provide more context. No test files cover this file. Before editing this file, check the `BeforeRetryState` and `AfterResponseState` types.

`source/core/constants.ts` contains environment feature detection and default limits. It changes to support new browser or runtime capabilities. No test files cover this file. Before editing this file, verify the `supportsRequestStreams` check.

## Change coupling

`source/types/options.ts` is the central hub for coupling. It moves with `source/utils/body.ts` (61%) and `source/utils/normalize.ts` (61%) because option changes require updates to how those values are processed. Open `source/types/options.ts` when editing any utility in `source/utils/`.

`source/types/options.ts` and `source/types/retry.ts` show high coupling (69%). This is by design as retry configuration is a subset of global options. Update both files when changing retry logic.

`source/core/constants.ts` and `source/types/options.ts` move together (52%). This links runtime constants to the public type definitions. Open both files when adjusting default timeouts or limits.

## What to read first

1. `source/core/Ky.ts` to understand the request loop and hook sequence.
2. `source/types/options.ts` to see the full configuration surface.
3. `source/utils/merge.ts` to understand how options are inherited and overridden.
4. `source/types/hooks.ts` to learn the lifecycle of a request.
5. `source/core/constants.ts` to see the environment assumptions.