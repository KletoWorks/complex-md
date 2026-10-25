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

Change risk concentrates in the request lifecycle engine and option configuration layer. Bug fixes land most often in `source/core/Ky.ts` with 63 fixes, `source/types/options.ts` with 21 fixes, and `source/utils/merge.ts` with 18 fixes. The repository has no dormant load-bearing files. A primary author wrote 70 to 93 percent of the commits across hotspots, while 131 total authors contributed. The map leaves out 1 credential path from all analysis lists.

## Why these files are hot

`source/core/Ky.ts` executes the HTTP request lifecycle, retry loops, timeouts, and hook callbacks. The file accumulated 171 commits, and 63 of those commits were fixes. An edit here can break response body stream cancellation, retry control, or abort signal state. The test suite covers it with `test/hooks.ts`. Before editing this file, run `test/hooks.ts` and verify timeout resolution logic.

`source/types/options.ts` defines the public options contract, URL resolution types, and retry parameters. The file accumulated 74 commits, and 21 of those commits were fixes. Tests find 0 test files directly for this file. Type changes risk regression across all option validation and option merge functions. Before editing this file, open `source/core/Ky.ts` and verify type checks with the TypeScript compiler.

`source/utils/merge.ts` handles deep clone and merge logic for options, headers, search parameters, and hooks. The file accumulated 47 commits, and 18 of those commits fixed bugs. Tests show 0 test files for this file. Flaws in merge logic corrupt headers or restore deleted query parameters across extended client instances. Before editing this file, open `source/types/options.ts` and verify prototype safety in deep clone routines.

`source/types/hooks.ts` declares signatures and state objects for request, retry, response, and error hook phases. The file accumulated 36 commits, and 11 of those commits were fixes. It has 0 direct test files. Modifications here alter hook contracts and can break hook handlers across user code. Before editing this file, open `test-d/hooks.ts` and verify type compatibility for all hook stages.

`source/core/constants.ts` defines environment capabilities, method lists, timeout bounds, and retry control symbols. The file accumulated 42 commits, and 15 of those commits fixed errors. Tests register 0 test files for it. An invalid symbol check or environment guard disrupts stream support and forced retries. Before editing this file, open `source/core/Ky.ts` and test runtime feature detection in Bun and Node.

## Change coupling

`source/types/options.ts` and `source/core/constants.ts` changed together in 22 commits, with 52 percent coupling. This co-change occurs by design because new options require both type definitions and constant registry updates. When you modify options in `source/types/options.ts`, open `source/core/constants.ts` and update the option key registry.

`source/types/options.ts` and `source/utils/merge.ts` changed together in 21 commits, with 45 percent coupling. New configuration options require merge rules for client extension and deep clones. When you edit option definitions, open `source/utils/merge.ts` and ensure merge support for each new field.

`source/types/options.ts` couples with `source/utils/body.ts` at 61 percent across 17 commits, and with `source/types/retry.ts` at 69 percent across 11 commits. New options often change request body stream settings and retry policies together. When you alter retry or body options, open both `source/utils/body.ts` and `source/types/retry.ts` to sync behaviors.

The directory seam between `source/types` and `source/utils` accounts for 54 shared commits at 52 percent coupling. Utility functions implement the behavior that type definitions enforce. When you alter types in `source/types`, inspect related helper utilities in `source/utils`.

## What to read first

1. `source/types/options.ts` - Defines the public option interfaces and configuration schema for every request.
2. `source/core/constants.ts` - Lists supported HTTP methods, environment feature flags, and retry control markers.
3. `source/types/hooks.ts` - Documents the lifecycle hook contract, state parameters, and return value types.
4. `source/utils/merge.ts` - Explains how client configurations, headers, search parameters, and hooks combine.
5. `source/core/Ky.ts` - Coordinates the main execution loop, timeout races, retry branches, and hook dispatch.