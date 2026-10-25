---
complex_md: "0.3"
generated: 2026-03-19
commit: a22217f9
tool: complex-md/bench
window_commits: 1849
files_analyzed: 50
profile:
  files_total: 388
  files_in_scope: 50
  loc_in_scope: 10422
  kinds: "test 227, docs 52, source 50, ci 24, example 19, other 8, generated 6, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 497
  commits_total: 4250
  commits_analyzed: 1665
  commits_skipped: 184
  half_life_commits: 462
  window_from: 2021-01-05
  window_to: 2026-03-19
  velocity_30d: 29.2
  authors_total: 592
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 985
    churn: 218
    churn_w: 68.35
    fixes: 49
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 189
    score: 12601
  - path: lib/errors.js
    kind: source
    loc: 516
    churn: 44
    churn_w: 13.42
    fixes: 17
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 9807
  - path: lib/symbols.js
    kind: source
    loc: 71
    churn: 26
    churn_w: 6.49
    fixes: 10
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 26
    score: 4960
  - path: lib/reply.js
    kind: source
    loc: 1030
    churn: 87
    churn_w: 23.73
    fixes: 34
    authors: 45
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4757
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 4.08
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3231
  - path: lib/request.js
    kind: source
    loc: 391
    churn: 42
    churn_w: 14.21
    fixes: 14
    authors: 24
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3200
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.99
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2929
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 41
    coupling: 46
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 21
    coupling: 57
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 43
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 40
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
    coupling: 54
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "151 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public server instance and connects every lib module to it. The request lifecycle modules sit around it: `lib/reply.js`, `lib/request.js` and `lib/hooks.js`. Two small shared tables have wide reach: `lib/errors.js` has 17 dependents and `lib/symbols.js` has 19. Bug fixes land most in `fastify.js` (49 fixes), `lib/route.js` (39 fixes) and `lib/reply.js` (34 fixes). The analysis found no load-bearing files. Ownership is spread across 592 committers, and only `fastify.js` has a lead owner, with 46% of its commits.

## Why these files are hot

`fastify.js` (985 lines) builds the instance object, its route shorthand methods, its decorator methods and its Avvio boot and close sequence. It changed in 218 commits, and 49 were fixes. Its dependents include `lib/route.js`, `lib/logger-factory.js` and `types/instance.d.ts`. 189 test files reach it, for example `test/404s.test.js` and `test/async-await.test.js`. Before editing this file, open `lib/route.js` and `types/instance.d.ts` alongside it.

`lib/errors.js` defines every `FST_ERR_*` code through `@fastify/error`, each with a message, a status code and an error class. 17 modules import it, and user code matches on the codes. 17 of its 44 commits were fixes. `test/internals/errors.test.js` covers it. Before editing this file, open `docs/Reference/Errors.md` and `test/internals/errors.test.js` alongside it.

`lib/symbols.js` (71 lines) holds the private `Symbol` keys that lib modules use to read instance, request and reply state. 19 files depend on it, and 26 test files reach it. A renamed or removed key returns `undefined` in a dependent without an error. Before editing this file, search `lib/` and `test/` for each key that you change.

`lib/reply.js` (1030 lines) implements `reply.send`, the header and trailer methods, serializer selection and the stream writers. 34 of its 87 commits were fixes. It calls the onSend, preSerialization and onError runners from `lib/hooks.js`. Its tests include the `test/diagnostics-channel/` files. Before editing this file, open `lib/request.js`, which shares the timeout and abort state.

`lib/hooks.js` defines the hook name lists and the runners for application and lifecycle hooks. 7 modules import it, but only 3 test files reach it. A change to runner order or to the `reply.sent` check alters every request. Before editing this file, run `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`.

## Change coupling

`fastify.js` moves with `lib/route.js` (46%, 41 commits), `lib/server.js` (40%), `lib/symbols.js` (54%) and `lib/errors.js` (34%). This coupling is by design: the factory composes these modules, so a new option or state key touches both sides. When you add an instance option, open `lib/route.js`, `lib/server.js` and `lib/symbols.js` together.

`lib/errors.js` couples with `docs/Reference/Errors.md` at 57%, and `lib/warnings.js` couples with `docs/Reference/Warnings.md` at 78%. The docs list each code, so this coupling is by design. Change a code and its docs entry in the same commit.

`lib/reply.js` and `lib/request.js` couple at 43%. They share request state, such as the timeout timer and the abort listener, through symbol keys. When one file changes this state, check the other file for the same keys.

`types/instance.d.ts` couples with `types/route.d.ts` (44%) and `types/hooks.d.ts` (58%). These type files mirror the runtime API, and the map shows 0 test files for them. When the runtime API changes, update `types/instance.d.ts` and its partner type files.

## What to read first

1. `lib/symbols.js`: the key names for all internal state that other files read.
2. `fastify.js`: the instance factory and the public API surface.
3. `lib/hooks.js`: the hook order and the runner contract that each request follows.
4. `lib/reply.js`: the send path, where many response bugs land.
5. `lib/errors.js`: the error codes that users and the docs depend on.
