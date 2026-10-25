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
load_bearing: []
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

Risk concentrates in the core Ky class (`source/core/Ky.ts`) and the options type definition (`source/types/options.ts`). The Ky class is the largest file and handles the main request logic, including error handling, timeouts, retries, and request/response processing. The options file defines all possible configuration options and is tightly coupled with the core implementation. Bug fixes land most in `source/core/Ky.ts` (63 fixes) and `source/types/options.ts` (21 fixes). No load-bearing files were found. Ownership is distributed, with 37 authors for Ky.ts and 16 for options.ts, but each has a primary owner (70% and 74% share respectively).

## Why these files are hot

`source/core/Ky.ts` (1083 score) is the main Ky class implementation. It handles request creation, error handling, timeouts, retries, and response processing. This file changes frequently (171 churns, 63 fixes) because it contains the core logic that needs to adapt to new requirements and bug fixes. It has no direct dependents but is the central coordinator. Covered by `test/hooks.ts`. Before editing this file, run `test/hooks.ts` to verify core functionality.

`source/types/options.ts` (634 score) defines all Ky configuration options. It changes frequently (74 churns, 21 fixes) as new options are added and existing ones are refined. It has no direct dependents but is used throughout the codebase. No tests found. Before editing this file, check all files that import from it, especially `source/core/Ky.ts` and `source/utils/merge.ts`.

`source/utils/merge.ts` (550 score) contains utility functions for deep merging options objects, including handling special cases like headers and hooks. It changes frequently (47 churns, 18 fixes) as option merging logic evolves. No tests found. Before editing this file, verify option merging behavior in `source/types/options.ts` and `source/core/Ky.ts`.

## Change coupling

The `source/types` and `source/utils` directories change together in 52% of commits, indicating tight coupling between type definitions and utility implementations. Before changing files in one directory, check related files in the other directory.

`source/types/options.ts` changes with `source/utils/merge.ts` in 45% of commits and with `source/utils/body.ts` in 61% of commits, showing that option handling utilities evolve together with the option definitions. Before editing options.ts, check merge.ts and body.ts for related changes.

`source/core/constants.ts` changes with `source/types/options.ts` in 52% of commits, indicating that core constants and option definitions evolve together. Before editing constants.ts, check options.ts for related changes.

## What to read first

1. `source/types/options.ts` - Defines all configuration options, understanding this is essential before modifying any option handling
2. `source/core/Ky.ts` - The main class implementation, contains the core request logic
3. `source/utils/merge.ts` - Contains critical option merging utilities used throughout the codebase
4. `source/types/hooks.ts` - Defines hook types and interfaces, important for understanding extension points