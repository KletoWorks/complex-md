---
complex_md: "0.3"
generated: 2026-02-20
commit: 3653e7b9
tool: complex-md/bench
window_commits: 1847
files_analyzed: 50
profile:
  files_total: 385
  files_in_scope: 50
  loc_in_scope: 10129
  kinds: "test 225, docs 52, source 49, ci 23, example 19, other 8, generated 6, asset 1, manifest 1, config 1"
  languages: "js 33, ts 16, json 1"
  dependency_edges: 492
  commits_total: 4206
  commits_analyzed: 1652
  commits_skipped: 195
  half_life_commits: 462
  window_from: 2020-11-21
  window_to: 2026-02-20
  velocity_30d: 28.9
  authors_total: 589
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 983
    churn: 216
    churn_w: 67.72
    fixes: 52
    authors: 69
    owner_share: 0.46
    fan_in: 6
    tests: 188
    score: 12593
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 42
    churn_w: 12.25
    fixes: 16
    authors: 32
    owner_share: 0.10
    fan_in: 17
    tests: 10
    score: 9317
  - path: lib/reply.js
    kind: source
    loc: 1008
    churn: 87
    churn_w: 24.30
    fixes: 35
    authors: 44
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4812
  - path: lib/symbols.js
    kind: source
    loc: 67
    churn: 26
    churn_w: 5.95
    fixes: 11
    authors: 13
    owner_share: 0.15
    fan_in: 19
    tests: 25
    score: 4760
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 19
    churn_w: 4.46
    fixes: 8
    authors: 16
    owner_share: 0.16
    fan_in: 7
    tests: 3
    score: 3370
  - path: lib/request.js
    kind: source
    loc: 374
    churn: 42
    churn_w: 14.17
    fixes: 14
    authors: 24
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3186
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.88
    fixes: 10
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 3027
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 41
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 20
    coupling: 57
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 17
    coupling: 47
  - files: [lib/reply.js, lib/request.js]
    count: 17
    coupling: 40
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 16
    coupling: 38
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 54
  - files: [lib/route.js, lib/symbols.js]
    count: 14
    coupling: 54
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "153 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in the instance factory `fastify.js` and the request lifecycle in `lib/reply.js`, `lib/request.js` and `lib/hooks.js`. Two small files are shared contracts: `lib/errors.js` has 17 importers and `lib/symbols.js` has 19. Bug fixes land most in `fastify.js` (52), `lib/route.js` (41) and `lib/reply.js` (35). No file qualifies as load-bearing, because every widely imported file also changed in the window. Ownership is wide: among the hotspots, only `fastify.js` has a top owner above 20%, at 46%. The counts leave out 153 bot commits and 6 generated or lock files.

## Why these files are hot

`fastify.js` builds every instance: its symbol-keyed state, the route shorthands and the public API methods. It changed in 216 commits, and 52 of them were fixes. It imports nearly every `lib/` module, so an edit here reaches routes, hooks, schemas and server start. 188 test files reach it, for example `test/404s.test.js` and `test/async-await.test.js`. Before editing this file, open `lib/route.js` alongside it, because 41 commits changed both.

`lib/errors.js` defines every `FST_ERR_*` code through `@fastify/error`, each with a message, an HTTP status and an error class. Users match on `err.code`, so a changed code or status is a public API break. 16 of its 42 commits were fixes. `test/internals/errors.test.js` covers it. Before editing this file, open `docs/Reference/Errors.md` and plan to update it in the same commit.

`lib/reply.js` implements `Reply`: headers, trailers, status codes, serialization and the send path through the onSend, preSerialization and onError hooks. 35 of its 87 commits were fixes. The payload branches in `Reply.prototype.send` (stream, web stream, Response, buffer, string, JSON) set content-type defaults that users depend on. Tests include `test/diagnostics-channel/sync-request-reply.test.js`. Before editing this file, preserve the content-type default of each payload branch in `send`.

`lib/symbols.js` holds 67 lines of `Symbol` keys for internal state. A removed or renamed key reads as `undefined` in its 19 importers and raises no error. 25 test files reach it. Before editing this file, search `fastify.js` and `lib/` for every use of the key.

`lib/hooks.js` defines the hook names, the `Hooks` container and the hook runners. Only 3 test files reach it, among them `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`. `buildHooks` copies lifecycle hooks to a child but gives it empty `onReady`, `onListen` and `preClose` arrays. Before editing this file, add any new hook name to the name list, the `Hooks` constructor and `buildHooks` together.

## Change coupling

`fastify.js` moves with `lib/route.js` at 45% and with `lib/server.js` at 39%. This is by design: the factory wires the router and the HTTP server. When a route or listen option changes in `fastify.js`, open `lib/route.js` and `lib/server.js`.

`lib/warnings.js` moves with `docs/Reference/Warnings.md` at 82%, and `lib/errors.js` moves with `docs/Reference/Errors.md` at 57%. The reference pages mirror the code tables by design. Add each new error or warning code to its reference page in the same commit.

`types/instance.d.ts` moves with `types/hooks.d.ts` at 58% and with `types/route.d.ts` at 47%. The instance type composes the hook and route types. When the instance API changes, update `types/instance.d.ts` and its partner type files together.

`lib/reply.js` and `lib/route.js` each move with `lib/symbols.js` at 54%, and `lib/reply.js` moves with `lib/request.js` at 40%. New internal state needs a new key, and `Reply` and `Request` expose parallel APIs. Declare each new key in `lib/symbols.js` before you use it in another file.

## What to read first

1. `lib/symbols.js`: the names of all internal state that other files read.
2. `fastify.js`: how an instance is built and which API methods it exposes.
3. `lib/hooks.js`: the hook names and the order the runners call them in.
4. `lib/reply.js`: the send path, where most lifecycle fixes land.
5. `lib/errors.js`: the error codes that users match on.
