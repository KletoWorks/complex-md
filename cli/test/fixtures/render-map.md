---
complex_md: "0.3"
generated: 2026-10-20
commit: 1234567
tool: complex-md/0.9.2
window_commits: 140
files_analyzed: 48
profile:
  files_total: 120
  files_in_scope: 48
  loc_in_scope: 6120
  commits_total: 140
  commits_analyzed: 138
  window_from: 2026-06-01
  window_to: 2026-10-19
  hotspot_cut: 5
  confidence: "structure+history"
hotspots:
  - path: src/core/engine.js
    kind: source
    loc: 820
    churn: 21
    churn_w: 12.4
    fixes: 9
    authors: 4
    owner_share: 0.61
    fan_in: 14
    tests: 3
    score: 9100
  - path: src/<script>alert(1)</script>.js
    kind: source
    loc: 140
    churn: 8
    churn_w: 5.1
    fixes: 4
    authors: 2
    owner_share: 0.80
    fan_in: 3
    tests: 1
    score: 2200
  - path: lib/it's "quoted" & odd.js
    kind: source
    loc: 300
    churn: 6
    churn_w: 3.2
    fixes: 0
    authors: 1
    owner_share: 1.00
    fan_in: 2
    tests: 0
    score: 1100
  - path: src/net/parser.js
    kind: source
    loc: 410
    churn: 11
    churn_w: 6.0
    fixes: 6
    authors: 3
    owner_share: 0.50
    fan_in: 6
    tests: 2
    score: 4300
  - path: src/util/tiny.js
    kind: source
    loc: 12
    churn: 3
    churn_w: 1.1
    fixes: 1
    authors: 1
    owner_share: 1.00
    fan_in: 9
    tests: 0
    score: 600
load_bearing:
  - path: src/legacy/codec.js
    kind: source
    loc: 950
    fan_in: 11
    tests: 0
co_change:
  - files: [src/core/engine.js, src/net/parser.js]
    count: 7
    coupling: 64
  - files: [src/<script>alert(1)</script>.js, lib/it's "quoted" & odd.js]
    count: 4
    coupling: 100
seams:
  - dirs: [src/core, src/net]
    count: 9
    coupling: 70
blind_spots:
  - "2 generated or lock files excluded"
  - "1 source file contains a NUL byte, so grep treats it as binary and skips it in silence: src/net/parser.js. Search with git grep -I --text, and fix the byte: it is almost always a separator that should have been written as an escape."
---

## Where the risk lives

Change risk concentrates in src/core/engine.js and src/net/parser.js. Fixes land there 15 times in 138 commits.

## Why these files are hot

src/core/engine.js schedules every job. Fourteen modules import it. Before editing this file, run `npm test -- engine` and keep the job order stable.

src/<script>alert(1)</script>.js renders the banner. Before editing this file, check that the <b>banner</b> still escapes "user" input & names.

lib/it's "quoted" & odd.js formats dates. It has no test.

src/net/parser.js reads the wire format. Before editing this file, search it with a text search because grep skips it.

src/legacy/codec.js decodes old archives and no commit touched it in the window. Before editing this file, run the archive round trip in test/codec.test.js.

## Change coupling

src/core/engine.js and src/net/parser.js move together in 7 commits.

## What to read first

1. src/core/engine.js: the scheduler.
2. `src/net/parser.js`: the wire format.
