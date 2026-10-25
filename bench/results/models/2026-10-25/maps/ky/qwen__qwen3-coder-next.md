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
  - source/core/constants.ts + source/types/ky.ts: 9 shared commits, coupling 41%
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

Change risk concentrates in the core Ky class and its type definitions. `source/core/Ky.ts` handles the full request lifecycle, retries, hooks, timeouts, and error handling. `source/types/options.ts`, `source/types/hooks.ts`, and `source/utils/merge.ts` define the public interface and option merging logic. The six files with the highest scores hold 62% of the total weighted churn. Bug fixes land in `source/core/Ky.ts` (63 fixes), `source/utils/merge.ts` (18), and `source/core/constants.ts` (15). No load-bearing files exist. One credential shaped path is excluded from the map.

## Why these files are hot

`source/core/Ky.ts` implements the main Ky request class. It processes input, normalizes options, manages retries, hooks, timeouts, streaming, and error handling. Its 171 commits include 63 fixes (37% of history), reflecting complex edge cases. It covers one test file: `test/hooks.ts`. Before editing this file, run `npm test -- test/hooks.ts`.

`source/types/options.ts` defines all user-facing options: `json`, `searchParams`, `baseUrl`, `prefix`, `retry`, `timeout`, `hooks`, and `context`. Its 74 commits include 21 fixes (28% of history), indicating frequent refinement of types and defaults. No test files cover it. Before editing this file, open `source/core/Ky.ts` to check how options are consumed.

`source/utils/merge.ts` implements deep merging for `headers`, `searchParams`, `hooks`, `context`, `json`, and `retry`. Its 47 commits include 18 fixes (38% of history), showing ongoing correctness work for `replaceOption` and `cloneDeep`. No test files cover it. Before editing this file, open `source/types/options.ts` to verify which options merge and how.

`source/types/hooks.ts` defines the five hook types: `init`, `beforeRequest`, `beforeRetry`, `beforeError`, `afterResponse`, with their state types and allowed returns. Its 36 commits include 11 fixes (31% of history). No test files cover it. Before editing this file, open `source/core/Ky.ts` to verify hooks are invoked in the correct order.

`source/core/constants.ts` defines runtime capability checks, `requestMethods`, `responseTypes`, `stop` and `retry` symbols, `beforeRetryOptionKeys`, and `kyOptionKeys`. Its 42 commits include 15 fixes (36% of history). No test files cover it. Before editing this file, open `source/types/options.ts` to confirm which options appear in `beforeRetryOptionKeys`.

## Change coupling

`source/types/options.ts` couples with `source/utils/merge.ts` (61% of `source/utils/merge.ts` commits), `source/utils/body.ts` (61%), `source/types/hooks.ts` (42%), `source/types/retry.ts` (69%), and `source/utils/normalize.ts` (61%). This coupling is by design: `options.ts` types drive merging, body handling, and normalization rules. Before editing `source/types/options.ts`, open all coupled files to verify compatibility.

`source/core/constants.ts` couples with `source/types/options.ts` (52%) and `source/types/ky.ts` (41%). This coupling is by design: constants like `stop` and `retry` must match their usage in `options.ts` and `source/types/ky.ts`. Before editing `source/core/constants.ts`, open `source/types/options.ts` and `source/types/ky.ts` to update all usages.

The `source/types` and `source/utils` directories move together (52% coupling). The `source/core` and `source/types` directories move together (68% coupling). Before touching any `source/core` file, run `npm test` to catch coupling errors.

## What to read first

1. `source/core/Ky.ts` — the request class, covers retry, hooks, and error handling.
2. `source/types/options.ts` — the public option types and defaults.
3. `source/types/hooks.ts` — hook signatures and state types.
4. `source/utils/merge.ts` — how options combine across `ky.extend()`.
5. `source/core/constants.ts` — runtime capabilities and reserved symbols.