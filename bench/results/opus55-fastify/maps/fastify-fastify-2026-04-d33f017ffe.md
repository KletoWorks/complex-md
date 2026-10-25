---
complex_md: "0.3"
generated: 2026-04-19
commit: d33f017f
tool: complex-md/bench
window_commits: 1848
files_analyzed: 50
profile:
  files_total: 390
  files_in_scope: 50
  loc_in_scope: 10423
  kinds: "test 229, docs 52, source 50, ci 24, example 19, other 8, generated 6, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 502
  commits_total: 4269
  commits_analyzed: 1671
  commits_skipped: 177
  half_life_commits: 462
  window_from: 2021-01-22
  window_to: 2026-04-19
  velocity_30d: 29
  authors_total: 591
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 985
    churn: 220
    churn_w: 68.80
    fixes: 49
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 190
    score: 12625
  - path: lib/errors.js
    kind: source
    loc: 516
    churn: 44
    churn_w: 13.12
    fixes: 17
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 9700
  - path: lib/symbols.js
    kind: source
    loc: 72
    churn: 27
    churn_w: 7.34
    fixes: 11
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 27
    score: 5369
  - path: lib/reply.js
    kind: source
    loc: 1032
    churn: 87
    churn_w: 24.14
    fixes: 35
    authors: 45
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4828
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 46
    churn_w: 17.84
    fixes: 18
    authors: 25
    owner_share: 0.15
    fan_in: 3
    tests: 14
    score: 3694
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.99
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3198
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.70
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2897
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 41
    coupling: 47
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 21
    coupling: 57
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 40
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 39
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 39
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 16
    coupling: 44
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 78
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "152 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, which builds the server instance and exposes the public API. The request lifecycle in `lib/reply.js`, `lib/request.js` and `lib/hooks.js` carries most of the remaining risk. `lib/errors.js`, `lib/symbols.js` and `lib/warnings.js` are small shared catalogs that most `lib/` files import. Bug fixes land most in `fastify.js` (49 fixes), `lib/route.js` (38 fixes) and `lib/reply.js` (35 fixes). The analysis found no load-bearing files, because every file with many dependents also changed in the window. Ownership is spread: the top committer holds 46% of `fastify.js` commits, and no other hotspot owner holds more than 18%.

## Why these files are hot

`fastify.js` builds the instance object: internal state under symbol keys, route shorthand methods, hooks, schemas, decorators and the Avvio boot. It changed in 220 commits, and 49 were fixes. Plugins and the type files depend on its public shape. 190 test files reach it, for example `test/404s.test.js` and `test/async-await.test.js`. Before editing this file, open `lib/route.js` and `lib/symbols.js` alongside it.

`lib/errors.js` defines every `FST_ERR_*` code through `@fastify/error`, with a message, a status code and an error class. 17 files import it, and users match on these codes. `test/internals/errors.test.js` covers the catalog. Before editing this file, open the matching entry in `docs/Reference/Errors.md`.

`lib/symbols.js` is a 72-line table of `Symbol` keys for internal state. 19 files import it, the highest fan-in in the map. A renamed or removed key breaks every file that reads it. Before editing this file, search `lib/` and `fastify.js` for each key that you change.

`lib/reply.js` implements `send`, headers, trailers, serialization and stream output in 1032 lines. It changed in 87 commits, and 35 were fixes. The latest fix stopped a duplicate `res.end` call in `sendTrailer`. 13 test files cover it, for example the `test/diagnostics-channel/` tests. Before editing this file, preserve the rule that a reply ends the response 1 time only.

`lib/request.js` builds the request class, with trust-proxy getters and lazy validation caches on the route context. 46 commits touched it, and 18 were fixes. Before editing this file, open `lib/reply.js`, because the 2 files share the route context.

## Change coupling

`fastify.js` moves with `lib/symbols.js` (52%), `lib/route.js` (47%), `lib/server.js` (40%) and `lib/errors.js` (34%). This coupling is by design: `fastify.js` wires the router, the HTTP server, the internal keys and the error codes into 1 object. When `fastify.js` changes, check `buildRouting` and `buildRouterOptions` in `lib/route.js`.

`lib/warnings.js` and `docs/Reference/Warnings.md` couple at 78%. `lib/errors.js` and `docs/Reference/Errors.md` couple at 57%. Each code catalog and its reference page form a pair by design. Update the reference page in the same commit as the code.

`lib/reply.js` and `lib/request.js` couple at 39%. Each file repeats the same lazy `WeakMap` cache on the route context, and each carries a TODO for a central cache. This coupling is by decay. Move the 2 caches into 1 shared helper before you change the cache logic.

`types/instance.d.ts` moves with `types/hooks.d.ts` (58%) and `types/route.d.ts` (44%). The instance interface declares methods whose signatures live in the other 2 files. When a hook or route signature changes, update `types/instance.d.ts` in the same commit.

## What to read first

1. `lib/symbols.js`: it names every internal key that the other files read.
2. `fastify.js`: it assembles the instance and shows which module owns each public method.
3. `lib/route.js`: it changed with `fastify.js` in 47% of its commits and took 38 fixes.
4. `lib/reply.js`: it holds the response lifecycle, where 35 fixes landed.
5. `lib/errors.js`: it lists the error codes that users and tests match on.
6. `types/instance.d.ts`: it declares the public instance type that the JS API mirrors.
