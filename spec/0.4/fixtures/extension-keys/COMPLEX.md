---
complex_md: "0.4"
x-acme-run: "r-118"
generated: 2026-10-21
commit: "a1b2c3d"
generator:
  name: acme-map
  version: 2.1.0
  x-acme-build: 77
window_commits: 300
files_analyzed: 40
profile:
  confidence: "history-only"
  x-acme-skipped-files: 3
hotspots:
  - path: src/main.rs
    kind: source
    loc: 1200
    churn: 52
    churn_w: 14.10
    fixes: 11
    authors: 3
    owner_share: 0.80
    fan_in: 0
    tests: 0
    score: 6100
    x-acme-owner: "@core"
load_bearing: []
co_change: []
seams: []
blind_spots:
  - "dependencies not resolved for 40 .rs files: their fan_in and covering tests are undercounted"
x-acme-teams:
  - path: src
    team: core
---

## Where the risk lives

The ranking rests on history and size, because the producer resolved no Rust dependency. src/main.rs holds 11 of the fixes.

## Why these files are hot

src/main.rs parses the command line and runs every subcommand. 11 of its 52 commits were fixes, and no test file reaches it. Before editing this file, run `cargo test` and try the changed subcommand by hand.

## Change coupling

No pair of files changed together in enough commits to count.

## What to read first

1. src/main.rs: every subcommand starts here.

## Notes from acme-map

This section is an extension. A reader ignores it.
