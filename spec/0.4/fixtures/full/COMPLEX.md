---
complex_md: "0.4"
generated: 2026-10-22
commit: "9c04e7d1b2a3"
generator:
  name: complex-md
  version: 0.12.0
  url: https://complex.md
window_commits: 640
files_analyzed: 88
profile:
  files_total: 412
  files_in_scope: 88
  loc_in_scope: 15210
  kinds: "test 160, source 80, docs 60, config 8"
  languages: "ts 70, js 10"
  dependency_edges: 301
  commits_total: 640
  commits_analyzed: 612
  commits_skipped: 28
  half_life_commits: 160
  window_from: 2025-11-02
  window_to: 2026-10-22
  velocity_30d: 54.3
  authors_total: 12
  concentration_50: 5
  hotspot_cut: 2
  pair_min: 4
  confidence: "structure+history"
hotspots:
  - path: packages/core/src/store.ts
    kind: source
    loc: 980
    churn: 77
    churn_w: 21.40
    fixes: 19
    authors: 7
    owner_share: 0.48
    fan_in: 31
    tests: 12
    score: 25110
    test_files: [packages/core/test/store.test.ts, packages/core/test/sync.test.ts]
  - path: packages/core/src/sync.ts
    kind: source
    loc: 540
    churn: 40
    churn_w: 11.05
    fixes: 9
    authors: 5
    owner_share: 0.55
    fan_in: 6
    tests: 4
    score: 7020
load_bearing:
  - path: packages/core/src/ids.ts
    kind: source
    loc: 88
    fan_in: 23
    tests: 2
co_change:
  - files: [packages/core/src/store.ts, packages/core/src/sync.ts]
    count: 18
    coupling: 45
seams:
  - dirs: [packages/core, packages/web]
    count: 22
    coupling: 38
blind_spots:
  - "packages/legacy is a git submodule: the map does not cover it"
stale_after: 2026-12-31
verified: 2026-10-23
prose:
  by: human
workspaces:
  - path: packages/web
---

## Where the risk lives

Change risk concentrates in the state store of packages/core and in the sync code that writes to it. packages/core/src/store.ts holds 19 of the fixes and packages/core/src/sync.ts holds 9. packages/core/src/ids.ts is load bearing: 23 files import it, and no commit in the window touched it.

## Why these files are hot

packages/core/src/store.ts holds the client state and its reducers, and 31 files depend on it. 19 of its 77 commits were fixes, most of them for stale reads after a sync, and 12 test files reach it. It moves with packages/core/src/sync.ts in 45 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/core` and open packages/core/src/sync.ts.

packages/core/src/sync.ts sends local changes to the server and merges the replies into the store. 9 of its 40 commits were fixes. Before editing this file, run `node --test packages/core/test/sync.test.ts` and keep the merge order of packages/core/src/store.ts.

## Change coupling

packages/core/src/store.ts and packages/core/src/sync.ts share 18 commits, at 45 percent, by design: sync writes through the store. When one of them changes, open the other and run both test files.

## What to read first

1. packages/core/src/ids.ts: 23 files import it.
2. packages/core/src/store.ts: the state that every view reads.
3. packages/core/src/sync.ts: the only writer from the network.
