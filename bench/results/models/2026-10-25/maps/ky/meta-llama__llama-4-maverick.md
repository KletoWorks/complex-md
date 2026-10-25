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
The change risk concentrates in the core logic, type definitions, and utility functions of the Ky HTTP client. Bug fixes land most frequently in `source/core/Ky.ts` with 63 fixes, followed by `source/types/options.ts` with 21 fixes, and `source/utils/merge.ts` with 18 fixes. The top committers own a large share of the changes, with the top owner contributing 70% to `source/core/Ky.ts` and 74% to `source/types/options.ts`. The repository has a diverse ownership pattern across multiple files. There are no load-bearing files that many files depend on but nobody touches. The map does not cover 1 credential shaped path.

## Why these files are hot
`source/core/Ky.ts` implements the main Ky class, handling request creation, retry logic, and response processing. It changes frequently due to its central role, with 63 bug fixes indicating complex logic. 37 authors have contributed to it, showing broad interest. Before editing this file, run `test/hooks.ts` to verify changes.

`source/types/options.ts` defines the types for Ky options, including search parameters and retry configurations. It changes often due to evolving type requirements, with 21 bug fixes. 16 authors have worked on it. Before editing this file, manually verify type correctness as there are no direct tests.

`source/utils/merge.ts` provides utility functions for merging headers, hooks, and other options. It is frequently changed, likely due to its critical role in handling complex merging logic, with 18 bug fixes. 6 authors have contributed to it, showing some concentration. Before editing this file, check the related types in `source/types/options.ts` and `source/types/hooks.ts`.

`source/types/hooks.ts` defines types for Ky hooks, which are used to customize request behavior. It changes regularly, with 11 bug fixes, indicating ongoing development. 7 authors have worked on it. Before editing this file, review the usage in `source/core/Ky.ts` and related hook implementations.

`source/core/constants.ts` contains constants used throughout Ky, such as supported response types and timeout limits. It is frequently updated, with 15 bug fixes, likely due to changing requirements. 13 authors have contributed to it. Before editing this file, check the usages in `source/core/Ky.ts` and other core files.

## Change coupling
The types and utilities in `source/types` and `source/utils` move together, with 54 shared commits and 52% coupling, likely due to their interconnected nature. When changing one, check the other. The core logic in `source/core` is tightly coupled with types in `source/types`, showing 68% coupling across 30 commits. When editing core logic, review the related types. The `source/types/options.ts` file is coupled with multiple utility files, such as `source/utils/merge.ts` (45% coupling) and `source/utils/body.ts` (61% coupling), indicating that changes to options often require adjustments in utility functions. When changing `source/types/options.ts`, check these utility files.

## What to read first
1. `source/core/Ky.ts` - Understand the main Ky class implementation and its retry logic.
2. `source/types/options.ts` - Review the type definitions for Ky options to understand the configuration capabilities.
3. `source/utils/merge.ts` - Examine the utility functions for merging options and headers.
4. `source/core/constants.ts` - Familiarize yourself with the constants used throughout Ky.
5. `source/types/hooks.ts` - Understand the types for Ky hooks and their customization capabilities.
By reading these files first, you will gain a comprehensive understanding of Ky's core logic, type definitions, and utility functions, allowing you to make informed changes.