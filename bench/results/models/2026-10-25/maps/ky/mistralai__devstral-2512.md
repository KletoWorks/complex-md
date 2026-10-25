Here is the complete COMPLEX.md file based on the provided inputs:

```markdown
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

The risk concentrates in the HTTP client core and its option types. `source/core/Ky.ts` holds the main client logic with 1376 lines and 63 fixes. Bug fixes land most in `source/core/Ky.ts` with 63 fixes and `source/types/options.ts` with 21. No load-bearing files exist. Ownership is distributed with top contributors holding 70% share in the hottest files.

## Why these files are hot

`source/core/Ky.ts` is the main HTTP client implementation handling requests, retries, timeouts and response processing. It changes often because it contains the core request logic and error handling that needs frequent adjustments. 63 of its 171 commits were fixes. It has 1 test file covering it. Before editing this file, run the test in `test/hooks.ts`.

`source/types/options.ts` defines all configuration options for the client with 555 lines. It changes often because new features and bug fixes require option type updates. 21 of its 74 commits were fixes. It has no tests. Before editing this file, verify the changes compile with the TypeScript config.

`source/utils/merge.ts` handles deep merging of options and headers with 501 lines. It changes often because option merging logic evolves with new features. 18 of its 47 commits were fixes. It has no tests. Before editing this file, check that merged options produce the expected request shape.

`source/types/hooks.ts` defines all hook types for request lifecycle with 424 lines. It changes often because hook interfaces expand with new capabilities. 11 of its 36 commits were fixes. It has no tests. Before editing this file, ensure all hook signatures remain backward compatible.

## Change coupling

`source/types/options.ts` moves with many files: it couples with `source/core/constants.ts` at 52%, `source/utils/body.ts` at 61%, `source/types/retry.ts` at 69%, and `source/utils/normalize.ts` at 61%. These are design couplings where options types drive behavior. When editing options, open `source/core/constants.ts` to verify constants still match the types.

`source/core/constants.ts` and `source/types/ky.ts` couple at 41%. This is a design coupling where core constants inform type definitions. When editing constants, check `source/types/ky.ts` for type consistency.

The `source/types` and `source/utils` directories move together at 52% coupling. This is a design coupling where types define utility behavior. When editing types, verify the corresponding utilities in `source/utils`.

The `source/core` and `source/types` directories move together at 68% coupling. This is a design coupling where core logic depends on type definitions. When editing core files, check the type definitions in `source/types`.

## What to read first

1. `source/core/Ky.ts` to understand the HTTP client core logic.
2. `source/types/options.ts` to see all available configuration options.
3. `source/types/hooks.ts` to learn the request lifecycle hooks.
4. `source/core/constants.ts` to know the runtime feature detection and limits.
5. `source/utils/merge.ts` to understand how options are merged.
```