---
complex_md: "0.4"
generated: 2026-10-20
commit: "3f2a9c1"
generator:
  name: complex-md
  version: 0.10.0
window_commits: 120
files_analyzed: 14
profile:
  confidence: "structure+history"
hotspots:
  - path: lib/router.js
    kind: source
    loc: 412
    churn: 31
    churn_w: 9.25
    fixes: 7
    authors: 4
    owner_share: 0.61
    fan_in: 9
    tests: 3
    score: 4120
load_bearing: []
co_change: []
seams: []
blind_spots: []
---

## Where the risk lives

Change risk concentrates in the request router. lib/router.js changed in 31 of the last 120 commits, and 7 of them were fixes.

## Why these files are hot

lib/router.js matches each request to a handler, and 9 files depend on it. 7 of its 31 commits were fixes, and 3 test files reach it. Before editing this file, run `node --test test/router.test.js`.

## Change coupling

No pair of files changed together in enough commits to count.

## What to read first

1. lib/router.js: every request passes through it.
