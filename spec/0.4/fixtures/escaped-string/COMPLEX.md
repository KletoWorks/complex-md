---
complex_md: "0.4"
generated: 2026-10-18
commit: "b7e1f20"
generator:
  name: complex-md
  version: 0.10.0
window_commits: 80
files_analyzed: 12
profile:
  confidence: "structure+history"
hotspots:
  - path: src/parse.js
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
co_change: []
seams: []
blind_spots:
  - "the word \"fix\" in 3 commit subjects names a product, not a repair"
  - "a path with a backslash: docs\\windows.md"
---

## Where the risk lives

Change risk concentrates in src/parse.js, which holds 5 of the fixes.

## Why these files are hot

src/parse.js builds the request queue, and 5 files depend on it. Before editing this file, run `npm test`.

## Change coupling

No pair of files changed together in enough commits to count.

## What to read first

1. src/parse.js: the queue.
