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
load_bearing: []
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
  - dirs: [source, source/util​s]
    count: 16
    coupling: 48
blind_spots:
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives
Change risk concentrates in the request core class, the public option types, and the utility modules that merge and expose hooks. The core class file **source/core/Ky.ts** contains 1 383 lines, 171 recent changes, and 63 fix commits. The options definition file **source/types/options.ts** has 555 lines, 74 changes, and 21 fixes. The constant‑detection file **source/core/constants.ts** records 307 lines, 42 changes, and 15 fixes. No file in the list has inbound fan‑in, so edits affect many downstream users but no other file depends on them directly. Bug fixes land mainly in **source/core/Ky.ts** (63 fixes), **source/types/options.ts** (21 fixes), and **source/core/constants.ts** (15 fixes). Ownership is concentrated: the top author owns 70 % of Ky.ts, 74 % of options.ts, and 89 % of merge.ts, indicating a small team drives most changes. The map does not cover one credential‑shaped path, so that area is invisible to the analysis.

## Why these files are hot
**source/core/Ky.ts** implements the main request class. It imports error types, option types, retry helpers, and many utilities. It changed in 171 commits and 63 of those were fixes. One test file **test/hooks.ts** exercises it. Before editing this file, run test/hooks.ts.  
**source/types/options.ts** defines the public option types used by the core class and many utilities. It changed in 74 commits, 21 of which were fixes, and no test file covers it. Before editing this file, open source/core/Ky.ts and source/utils/merge.ts to verify type usage.  
**source/utils/merge.ts** provides deep‑merge logic for options. It changed in 47 commits with 18 fixes and is imported by the core class and other modules. Before editing this file, run the type‑check build and review its imports in source/core/Ky.ts.  
**source/types/hooks.ts** declares hook signatures used throughout the library. It changed in 36 commits with 11 fixes and has no direct tests. Before editing this file, open source/core/Ky.ts and source/types/options.ts to verify hook contracts.  
**source/core/constants.ts** detects platform capabilities and exports feature flags. It changed in 42 commits with 15 fixes and has no direct tests. Before editing this file, run the feature‑detection checks in test/d/normalized-options.ts.

## Change coupling
Files that frequently change together center on **source/types/options.ts**. It co‑changed with **source/core/constants.ts** (52 % coupling), **source/utils/merge.ts** (45 %), **source/utils/body.ts** (61 %), **source/types/hooks.ts** (42 %), **source/index.ts** (39 %), **source/types/ky.ts** (55 %), **source/types/retry.ts** (69 %), and **source/utils/normalize.ts** (61 %). When changing options.ts, open each of these files to check compatible updates.  
The directory seam **source + source/types** shows 70 % of commits affecting both areas, indicating that most work touches core code and the option types together. When editing any file in source, also review the impacted files in source/types.  
The seam **source/core + source/types** couples 68 % of commits, reflecting the tight link between core logic and option definitions. When modifying core files, verify the related option definitions.  
The seam **source/errors + source/types** couples 68 % of commits, showing error‑type definitions are often updated alongside option types. When editing error files, also inspect the option types.  
The seam **source/types + source/utils** couples 52 % of commits, meaning utilities that manipulate options change together with their type definitions. When editing a utility, also check the corresponding type file.

## What to read first
1. **source/types/options.ts** – central type hub; understand its shape before any change.  
2. **source/core/Ky.ts** – main request class; see how it consumes option types.  
3. **source/utils/merge.ts** – option merging logic; review before altering option handling.  
4. **source/core/constants.ts** – feature‑detection flags used across the codebase.  
5. **source/types/hooks.ts** – hook contract definitions; needed for any hook‑related work.