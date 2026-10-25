```yaml
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
load_bearing:
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
  - dirs: [source, source/utils]
    count: 16
    coupling: 48
blind_spots:
  - "1 credential shaped path left out of every list so a committed map never names them"
---
## Where the risk lives
Change risk concentrates in the request orchestration (`source/core/Ky.ts`), the public options type (`source/types/options.ts`), deep option merging (`source/utils/merge.ts`), hook contracts (`source/types/hooks.ts`), and feature-gating constants (`source/core/constants.ts`). Bug fixes land most frequently in `source/core/Ky.ts` (63 fixes) and `source/types/options.ts` (21 fixes). The repository has no load-bearing files. The top committer owns 70 % of changes to `source/core/Ky.ts` and similarly large shares in the other hotspots, but 131 authors overall have contributed.

## Why these files are hot

**source/core/Ky.ts** holds the `Ky` class and the entire request lifecycle: input resolution, retry logic, timeout management, hook invocation, body handling, and error processing. The file scores highest because it is large, changed in 171 commits (63 of them fixes), and touched by 37 authors. The accompanying test `test/hooks.ts` is the only test that reaches it. Before editing this file, run `npx ava test/hooks.ts` and study the hook invocation order in the `for (;;)` retry loop.

**source/types/options.ts** defines every public option with JSDoc. It changes whenever new options are added, defaults shift, or type unions widen. Its 74 commits include 21 fixes. No test files reach it. The file co-changes often with `source/core/constants.ts` (coupling 52 %) and `source/utils/merge.ts` (45 %). Before editing this file, open `source/core/constants.ts` to verify that any new option key appears in `kyOptionKeys`, and check that the merge logic in `source/utils/merge.ts` handles its type.

**source/utils/merge.ts** implements deep merging of options, hooks, headers, and search parameters. It churns because option‑merging bugs, deletion markers, and `replaceOption` require careful handling. Its 47 commits include 18 fixes, and it has no tests. Before editing this file, add a test that covers the new merge path and confirm that existing `beforeRetry` hook mutations, which rely on the merge output, still pass.

**source/types/hooks.ts** documents the hook types and their return values. Changes here track the evolution of the hook system (init, beforeRequest, beforeRetry, etc.) and the introduction of `BeforeRetryUpdate`. 36 commits, 11 fixes; no tests. Before editing this file, open `source/core/Ky.ts` and cross‑reference each hook invocation to ensure the contract matches the updated types.

**source/core/constants.ts** contains runtime feature detections, `responseTypes`, `maxSafeTimeout`, and shared symbols (`stop`, `retry`). Its 42 commits include 15 fixes, often from environment‑specific adjustments. No tests reach it. Before editing this file, verify the feature detection in the target runtime using the project’s development console.

## Change coupling
`source/types/options.ts` is the hub. It co‑changes with `source/core/constants.ts` (52 %), `source/utils/merge.ts` (45 %), `source/utils/body.ts` (61 %), `source/types/retry.ts` (69 %), `source/utils/normalize.ts` (61 %), and `source/types/ky.ts` (55 %). This is by design: the options schema drives behavior in every utility. When you change the options type, open `source/core/constants.ts` to update `kyOptionKeys`, and run the full test suite.

`source/types/hooks.ts` and `source/types/options.ts` move together (42 %), as do `source/types/hooks.ts` and `source/index.ts` (39 %). New hook types require updates in both the hook definition and the entry point. When you add or modify hook types, edit `source/types/hooks.ts` and `source/index.ts` together, and verify the hook wiring in `source/core/Ky.ts`.

`source/errors/HTTPError.ts` co‑changes with `source/types/hooks.ts` (53 %) because hooks receive error instances. When you change `HTTPError`, check that `beforeError` and `beforeRetry` hooks in `source/types/hooks.ts` still receive the expected shape.

## What to read first
1. `source/core/Ky.ts` — the main request lifecycle and retry loop.
2. `source/types/options.ts` — the full public API surface.
3. `source/utils/merge.ts` — how options and hooks are composed.
4. `source/types/hooks.ts` — the hook contracts and return types.
5. `source/core/constants.ts` — feature flags and global symbols.
6. `source/index.ts` — the entry point that exposes the `ky` factory and shortcuts.