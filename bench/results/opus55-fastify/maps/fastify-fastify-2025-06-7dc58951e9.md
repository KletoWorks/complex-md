---
complex_md: "0.3"
generated: 2025-06-17
commit: 7dc58951
tool: complex-md/bench
window_commits: 1856
files_analyzed: 47
profile:
  files_total: 384
  files_in_scope: 47
  loc_in_scope: 9594
  kinds: "test 224, docs 52, source 46, ci 27, example 18, other 8, generated 6, asset 1, manifest 1, config 1"
  languages: "js 30, ts 16, json 1"
  dependency_edges: 478
  commits_total: 4046
  commits_analyzed: 1651
  commits_skipped: 205
  half_life_commits: 464
  window_from: 2020-07-29
  window_to: 2025-06-17
  velocity_30d: 31.2
  authors_total: 590
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 962
    churn: 208
    churn_w: 62.26
    fixes: 51
    authors: 67
    owner_share: 0.47
    fan_in: 5
    tests: 187
    score: 10590
  - path: lib/errors.js
    kind: source
    loc: 500
    churn: 43
    churn_w: 14.23
    fixes: 17
    authors: 34
    owner_share: 0.07
    fan_in: 16
    tests: 10
    score: 9609
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 86
    churn_w: 23.65
    fixes: 36
    authors: 47
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4750
  - path: lib/symbols.js
    kind: source
    loc: 66
    churn: 28
    churn_w: 6.48
    fixes: 12
    authors: 15
    owner_share: 0.14
    fan_in: 17
    tests: 23
    score: 4574
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 5.58
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3732
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 46
    churn_w: 16.71
    fixes: 15
    authors: 29
    owner_share: 0.13
    fan_in: 3
    tests: 12
    score: 3415
  - path: lib/warnings.js
    kind: source
    loc: 47
    churn: 36
    churn_w: 15.16
    fixes: 10
    authors: 22
    owner_share: 0.17
    fan_in: 4
    tests: 2
    score: 2569
  - path: lib/contentTypeParser.js
    kind: source
    loc: 409
    churn: 44
    churn_w: 13.94
    fixes: 20
    authors: 25
    owner_share: 0.18
    fan_in: 2
    tests: 1
    score: 2417
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 38
    coupling: 41
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 23
    coupling: 61
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 23
    coupling: 52
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 19
    coupling: 56
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 39
  - files: [lib/route.js, lib/symbols.js]
    count: 16
    coupling: 57
  - files: [types/hooks.d.ts, types/route.d.ts]
    count: 15
    coupling: 39
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 36
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 35
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 50
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "144 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public instance and its methods. The rest of the risk sits in the request lifecycle under `lib/`: reply, request, hooks, and the shared tables `lib/errors.js` and `lib/symbols.js`. Bug fixes land most in `fastify.js` with 51 fixes, `lib/route.js` with 44 and `lib/reply.js` with 36. The repository has no load-bearing files, because every widely imported file also changed in the window. One committer made 47% of the commits to `fastify.js`, but no other hotspot has an owner above 18%. The type files under `types/` change with the runtime, but the analysis found no dependents or tests for them.

## Why these files are hot

`fastify.js` (962 lines) validates options, builds the router and assembles the instance with its symbol-keyed state. It changed in 208 commits, and 51 of them were fixes. Every public method, from `addHook` to `setErrorHandler`, lives here, so 187 test files reach it. Before editing this file, open `lib/route.js` and `lib/symbols.js` alongside it.

`lib/errors.js` defines every `FST_ERR_*` code through `@fastify/error`, with a message, a status and an error class. 16 files import it. Users match on `error.code`, so the current code names and statuses are a public contract. Before editing this file, run `test/internals/errors.test.js`.

`lib/reply.js` (944 lines) implements `reply.send`, headers, trailers, serialization and the onSend and onError chains. 36 of its 86 commits were fixes. The `send` path branches on streams, web streams, `Response`, buffers, strings and JSON, and each branch sets `content-type` differently. Before editing this file, run the `test/diagnostics-channel/` tests that cover the reply path.

`lib/symbols.js` (66 lines) holds the `Symbol` keys for the internal state of the instance, the request and the reply. 17 files import it, the widest fan-in in the repository. A removed key reads as `undefined` in its dependents and does not throw. Before editing this file, search all 17 dependents for the key that you change.

`lib/hooks.js` (429 lines) defines the hook names and the runners for application and lifecycle hooks. 7 files import it, but only 3 test files reach it. A new hook needs an entry in `lifecycleHooks` or `applicationHooks`, in `Hooks` and in `buildHooks`. Before editing this file, run `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`.

## Change coupling

`fastify.js`, `lib/route.js` and `lib/symbols.js` form one cluster by design. `lib/route.js` and `lib/symbols.js` changed together in 57% of commits, because route options become state under new symbol keys. When a route option changes, open all 3 files and check the option, the key and the validation.

`types/instance.d.ts`, `types/hooks.d.ts` and `types/route.d.ts` couple at 39% to 61%. They describe one public API, so a hook or route signature change also touches the instance type. When one type file changes, open the other 2 and check that the signatures agree.

`lib/errors.js` and `docs/Reference/Errors.md` changed together in 56% of commits, because the docs list each code by hand. When you add or change a code, update `docs/Reference/Errors.md` in the same commit.

`lib/reply.js` and `lib/request.js` couple at 39%. The 2 objects share the route context, the decorators and the lifecycle. When one prototype gains a property, check the other prototype for the same need.

## What to read first

1. `lib/symbols.js`, because every other file reads state through these keys.
2. `fastify.js`, for the options, the instance shape and the public methods.
3. `lib/hooks.js`, for the hook order and the runner contract.
4. `lib/route.js`, which has 44 fixes and moves with `fastify.js`.
5. `lib/reply.js`, for the send path and serialization.
6. `lib/errors.js`, for the public error codes.
