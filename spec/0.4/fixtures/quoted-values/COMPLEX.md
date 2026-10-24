---
complex_md: "0.4"
generated: "2026-10-19"
commit: "1234567"
generator:
  name: complex-md
  version: 0.10.0
window_commits: 90
files_analyzed: 30
profile:
  confidence: "structure+history"
hotspots:
  - path: "app/(shop)/[slug]/page.tsx"
    kind: source
    loc: 210
    churn: 18
    churn_w: 6.50
    fixes: 4
    authors: 2
    owner_share: 0.72
    fan_in: 1
    tests: 1
    score: 1450
load_bearing: []
co_change:
  - files: ["app/(shop)/[slug]/page.tsx", "docs/notes #1.md"]
    count: 6
    coupling: 50
seams: []
blind_spots:
  - "1 file over 1 MB not read for dependencies"
---

## Where the risk lives

Change risk concentrates in the product page route. app/(shop)/[slug]/page.tsx holds 4 of the fixes.

## Why these files are hot

app/(shop)/[slug]/page.tsx renders one product page from its slug. 4 of its 18 commits were fixes. Before editing this file, run `npx playwright test e2e/product.spec.ts`.

## Change coupling

app/(shop)/[slug]/page.tsx and docs/notes #1.md share 6 commits, at 50 percent, by decay: the note copies the props of the page. Remove the copy from the note.

## What to read first

1. app/(shop)/[slug]/page.tsx: the route with the most fixes.
