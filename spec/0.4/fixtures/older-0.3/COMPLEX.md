---
complex_md: "0.3"
generated: 2026-09-02
commit: af6e2e43
tool: complex-md/0.4.0
window_commits: 2000
files_analyzed: 73
profile:
  files_total: 394
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1009
    churn: 234
    churn_w: 75.49
    fixes: 53
    authors: 66
    owner_share: 0.44
    fan_in: 24
    tests: 63
    score: 29220
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
seams:
blind_spots:
  - 9 generated or lock files excluded
---

## Where the risk lives

Change risk concentrates in the public constructor. fastify.js holds 53 of the fixes.

## Why these files are hot

fastify.js is the public constructor and plugin root, and 24 modules depend on it. Before editing this file, open lib/route.js and fastify.d.ts alongside it.

## Change coupling

fastify.js and lib/route.js share 39 commits, at 45 percent. When one changes, open the other.

## What to read first

1. fastify.js: the constructor.
