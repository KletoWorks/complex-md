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
load_bearing: []
co_change:
  - files: [source/types/options.ts, source/types/retry.ts]
    count: 11
    coupling: 69
  - files: [source/types/options.ts, source/utils/body.ts]
    count: 17
    coupling: 61
  - files: [source/types/options.ts, source/utils/normalize.ts]
    count: 11
    coupling: 61
  - files: [source/core/constants.ts, source/types/options.ts]
    count: 22
    coupling: 52
  - files: [source/types/options.ts, source/utils/merge.ts]
    count: 21
    coupling: 45
  - files: [source/types/hooks.ts, source/types/options.ts]
    count: 15
    coupling: 42
  - files: [source/index.ts, source/types/hooks.ts]
    count: 13
    coupling: 39
  - files: [source/types/ky.ts, source/types/options.ts]
    count: 12
    coupling: 55
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

Change risk concentrates in the core request class, the public options interface, and the deep-merge logic that builds the internal options object. Ky.ts (1376 lines, 171 commits, 63 fixes) is where bug fixes land: it has the most labeled fixes of any file in the window. The options types in options.ts (555 lines, 74 commits, 21 fixes) define the public API and are changed whenever new options are added or existing ones are refined. The merge.ts utility (501 lines, 47 commits, 18 fixes) handles the deep-merge of user options, parent options, and defaults; it has high ownership concentration (0.89) and a small author pool, so changes there tend to come from the same few people. The directory seam between source/core and source/types (68% coupling) and the seam between source/errors and source/types (68% coupling) show that type changes ripple through core and error handling. No load-bearing files exist in this repository: every file has fan_in of 0. The map does not cover credential-shaped paths by design, so they do not appear in hotspots or co-change lists.

## Why these files are hot

Ky.ts exports the Ky class. It normalizes input URLs, merges options, runs hooks, manages retries, reads response bodies, and throws HTTP errors. 63 of its 171 commits were labeled fixes, the highest fix share in the top six. It imports from every other hotspot and from all error classes. Only test/hooks.ts covers it; no other test file reaches the core class. Before editing this file, run `test/hooks.ts` to verify hook behavior.

source/types/options.ts defines KyOptions, Options, InitOptions, and NormalizedOptions. It is the central type document for every option Ky accepts. It changes whenever options are added, renamed, or have their types tightened. 21 of 74 commits were fixes. No test file covers it, so type correctness depends on type-checking and downstream behavior. Before editing this file, verify the changes compile and run the full test suite.

source/utils/merge.ts provides deepMerge, mergeHooks, and the replaceOption wrapper. It is the merge contract: options from the user, from ky.create(), and from ky.extend() all flow through it. 18 of 47 commits were fixes, mostly for edge cases in the deep-merge algorithm. Owner share is 0.89, so most changes come from one person. Before editing this file, open source/utils/body.ts and source/types/retry.ts because all three are coupled to options.ts at over 45%.

source/types/hooks.ts defines the five hook types: InitHook, BeforeRequestHook, BeforeRetryHook, BeforeErrorHook, and AfterResponseHook. It changes whenever hook behavior is extended or the state object is enlarged. No test file covers it directly. Before editing this file, open source/errors/HTTPError.ts since they share 9 commits at 53% coupling.

source/core/constants.ts exports runtime capability checks (requestStreams, responseStreams, abortSignal), retry timing constants, and the KyOptionsRegistry. It changes when Ky adds or removes options or when new browser features require capability checks. Before editing this file, open source/types/options.ts since the options registry and the options type definitions must stay in sync.

source/utils/body.ts handles body streaming, cancellation, and size limiting. It has low fix counts (4) and the highest ownership share (0.93) in the top six, meaning one author owns most changes. Before editing this file, open source/types/options.ts because body handling depends on the options that control it.

## Change coupling

source/types/options.ts is the hub. It couples to source/types/retry.ts at 69%, to source/utils/body.ts at 61%, to source/utils/normalize.ts at 61%, and to source/core/constants.ts at 52%. When you add or change an option, check all four of these files for required updates.

The source/types + source/utils seam (52% coupling, 54 shared commits) shows that type definitions and utility functions move together. A type change in options.ts often requires a corresponding update in merge.ts or normalize.ts. When changing options.ts, open one file from source/utils and verify the merge and normalize logic still handles the new shape.

The source/core + source/types seam (68% coupling, 30 shared commits) shows that Ky.ts and options.ts co-evolve. When you add an option to options.ts, Ky.ts likely needs to use it. When you change Ky.ts behavior, options.ts types may need updating.

The source/errors + source/types seam (68% coupling, 17 shared commits) shows that error classes and hook types co-evolve. HTTPError.ts and hooks.ts share 9 commits at 53% coupling. When you add a new hook type or change the state object, check whether the error types need corresponding updates.

The source/index.ts + source/types/hooks.ts coupling (39%) is lower but shows that the public entry point and the hook types are linked. When you add a hook, the index must re-export it.

## What to read first

Read source/types/options.ts first. It defines every option Ky accepts and is the anchor for all co-change pairs. No other file has so many couplings.

Read source/utils/merge.ts second. It is the merge contract that every options change must respect. Its high ownership share means it has deep institutional knowledge.

Read source/core/constants.ts third. It lists every Ky option in KyOptionsRegistry and exports capability checks that control which code paths Ky.ts takes.

Read source/types/hooks.ts fourth. It defines the hook state objects that pass request, response, and retry context into user code.

Read source/core/Ky.ts fifth. It is the main class and the highest-churn file. Understanding the types and merge logic first makes reading it easier.

Open source/utils/body.ts alongside source/types/options.ts when working on body handling, because their coupling to options.ts is 61%.