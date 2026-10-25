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

Change risk sits in the HTTP client core, not in config or deploy files. source/core/Ky.ts runs the request, the retry loop, timeouts, and hooks. source/types/options.ts holds the public option contract. source/utils/merge.ts combines that contract for ky.create and ky.extend. source/types/hooks.ts and source/core/constants.ts define hook results, feature checks, and option keys.

Bug fixes land in source/core/Ky.ts (63), source/types/options.ts (21), and source/utils/merge.ts (18).

No load-bearing file exists. The import graph has 2 edges, so fan-in is 0 on every hotspot.

131 authors committed here. One committer holds 0.70 of the Ky.ts commits and 0.74 of the options.ts commits. source/utils/merge.ts is tighter: owner share 0.89 across 6 authors.

The map omits 1 credential-shaped path and does not name it.

## Why these files are hot

source/core/Ky.ts is the Ky class (1376 lines). It resolves input, applies search parameters, runs hooks, retries, and reads error bodies. 171 commits touched it, and 63 were fixes. test/hooks.ts is the only test that reaches it. The class imports the option, merge, body, and constants modules.

Before editing this file, open test/hooks.ts and check the hook cases.

source/types/options.ts is the public option contract (555 lines). It exports KyOptions, Options, InitOptions, and NormalizedOptions. 74 commits touched it, and 21 were fixes. No test file reaches it. Options stays an interface so callers can extend it for ky.create. An undefined searchParams value deletes that key.

Before editing this file, open source/utils/merge.ts and keep Options an interface.

source/utils/merge.ts deep-merges options for ky.extend (501 lines). It merges headers, hooks, and search parameters, and it honors replaceOption. 47 commits touched it, and 18 were fixes. No test file reaches it. deletedParametersSymbol stops a later layer from a restore of a removed query key. source/core/Ky.ts imports cloneDeep, mergeHeaders, and mergeHooks from here.

Before editing this file, open source/types/options.ts and preserve replaceOption and deletion markers.

source/types/hooks.ts types init, beforeRequest, beforeRetry, beforeError, and afterResponse (424 lines). 36 commits touched it, and 11 were fixes. No test file reaches it. init stays synchronous, and its errors skip beforeError. beforeRetry returns a Request, a Response, stop, or a narrow options update.

Before editing this file, open source/core/constants.ts and keep that return union.

source/core/constants.ts holds feature checks and shared symbols (307 lines). It exports maxSafeTimeout, stop, RetryMarker, beforeRetryOptionKeys, and kyOptionKeys. 42 commits touched it, and 15 were fixes. No test file reaches it. stop and RetryMarker stay valid across a second copy of Ky. kyOptionKeys mirrors every key of KyOptions.

Before editing this file, add each new Ky option to kyOptionKeys.

## Change coupling

source/core/Ky.ts is absent from the pairs. The tool skips it as a convention file: it is in over a quarter of commits.

source/types/options.ts is the co-change hub, by design. It shares 22 commits with source/core/constants.ts (coupling 52%). It shares 21 commits with source/utils/merge.ts (coupling 45%). source/types/retry.ts couples at 69% across 11 commits. source/utils/body.ts couples at 61% across 17 commits. source/types/ky.ts couples at 55% across 12 commits. The type is the contract those modules read.

When you change source/types/options.ts, open source/utils/merge.ts and source/types/retry.ts.

source/types/hooks.ts shares 15 commits with source/types/options.ts (coupling 42%). source/index.ts shares 13 commits with source/types/hooks.ts (coupling 39%). source/errors/HTTPError.ts shares 9 commits with source/types/hooks.ts (coupling 53%). Those pairs follow the public hook types.

When you change a hook return type, open source/index.ts and source/errors/HTTPError.ts.

The same contract appears one directory higher. source/core and source/types share 30 commits (coupling 68%). source/errors and source/types share 17 commits (coupling 68%). source/types and source/utils share 54 commits (coupling 52%).

When you edit source/core, open source/types/options.ts in the same change.

## What to read first

1. source/types/options.ts — the public option contract the other hot files read.
2. source/core/constants.ts — feature checks, stop, RetryMarker, and the kyOptionKeys mirror.
3. source/types/hooks.ts — hook arguments and the values a hook returns.
4. source/utils/merge.ts — how ky.extend combines hooks, headers, and search parameters.
5. source/core/Ky.ts — the request loop that calls those modules.
6. test/hooks.ts — the only test file that reaches Ky.ts.