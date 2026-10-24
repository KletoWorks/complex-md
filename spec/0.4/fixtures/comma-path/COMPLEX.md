---
complex_md: "0.4"
generated: 2026-10-18
commit: "c0ffee1"
generator:
  name: complex-md
  version: 0.10.0
window_commits: 80
files_analyzed: 12
profile:
  confidence: "structure+history"
hotspots:
  - path: lib/a.js
    kind: source
    loc: 150
    churn: 20
    churn_w: 7.00
    fixes: 5
    authors: 3
    owner_share: 0.50
    fan_in: 5
    tests: 2
    score: 2200
load_bearing: []
co_change:
  - files: ["lib/a.js", "lib/b,c.js"]
    count: 7
    coupling: 41
seams: []
blind_spots: []
---

## Where the risk lives

Change risk concentrates in lib/a.js, which holds 5 of the fixes.

## Why these files are hot

lib/a.js builds the request queue, and 5 files depend on it. Before editing this file, run `npm test`.

## Change coupling

No pair of files changed together in enough commits to count.

## What to read first

1. lib/a.js: the queue.
