---
complex_md: "0.3"
generated: 2026-06-29
commit: 0c28b57c
tool: complex-md/bench
window_commits: 1846
files_analyzed: 50
profile:
  files_total: 392
  files_in_scope: 50
  loc_in_scope: 10606
  kinds: "test 231, docs 52, source 50, ci 24, example 19, other 8, generated 6, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 504
  commits_total: 4333
  commits_analyzed: 1691
  commits_skipped: 155
  half_life_commits: 462
  window_from: 2021-03-09
  window_to: 2026-06-29
  velocity_30d: 28.6
  authors_total: 595
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1014
    churn: 219
    churn_w: 66.67
    fixes: 51
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 192
    score: 12564
  - path: lib/errors.js
    kind: source
    loc: 531
    churn: 45
    churn_w: 14.75
    fixes: 19
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10553
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 27
    churn_w: 7.61
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 19
    tests: 28
    score: 5553
  - path: lib/reply.js
    kind: source
    loc: 1085
    churn: 92
    churn_w: 27.28
    fixes: 39
    authors: 47
    owner_share: 0.20
    fan_in: 3
    tests: 14
    score: 5249
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 48
    churn_w: 19.16
    fixes: 20
    authors: 27
    owner_share: 0.15
    fan_in: 3
    tests: 15
    score: 3849
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.66
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3078
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.52
    fixes: 11
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 3054
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 24
    coupling: 59
  - files: [lib/reply.js, lib/request.js]
    count: 19
    coupling: 40
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 15
    coupling: 71
  - files: [lib/errors.js, types/errors.d.ts]
    count: 14
    coupling: 93
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 56
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 14
    coupling: 41
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "154 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public instance and wires every `lib/` module into it. The request lifecycle in `lib/reply.js` and `lib/request.js` carries the next share of churn. Two small registries, `lib/errors.js` and `lib/symbols.js`, rank high because 17 and 19 files import them. Bug fixes land most in `fastify.js` with 51 fixes, `lib/reply.js` with 39 and `lib/route.js` with 39. The map lists no load-bearing files, because every widely imported file changed in the window. Among the hotspots, only `fastify.js` has a top committer above 20%, at 46%.

## Why these files are hot

`fastify.js` builds the instance object: route shorthands, hooks, schema setters, decorators and the Avvio lifecycle. It changed in 219 commits, and 51 of them were fixes. It imports nearly every `lib/` module, so an edit here reaches routes, hooks, schemas and server shutdown. 192 test files reach it, for example `test/404s.test.js` and `test/async-await.test.js`. Before editing this file, open `lib/route.js` and `lib/server.js` alongside it.

`lib/errors.js` defines every `FST_ERR_*` code through `@fastify/error`, each with a message, a status code and an error class. 19 of its 45 commits were fixes. 17 files import it, and `fastify.js` exports the codes as `errorCodes`. `test/internals/errors.test.js` is 1 of the 10 test files that cover it. Before editing this file, open `types/errors.d.ts` and `docs/Reference/Errors.md` for the same change.

`lib/symbols.js` exports the Symbol keys that hold internal state on the instance, the request and the reply. 19 files import it, and 28 test files reach it. A removed key does not throw; the property read returns `undefined`. Before editing this file, search `lib/` and `test/` for every use of the key you change.

`lib/reply.js` implements `send`, headers, trailers, serialization and stream writes for HTTP/1 and HTTP/2. 39 of its 92 commits were fixes, which is 42%. Only 3 files import it, but every response passes through it. 14 test files cover it, which include the `test/diagnostics-channel/` suite. Before editing this file, run the test files under `test/diagnostics-channel/`.

`lib/request.js` builds the Request prototype: getters for `ip`, `host`, `protocol` and `headers`, plus validation helpers. 20 of its 48 commits were fixes. The `trustProxy` getters read `X-Forwarded-*` headers, so an edit there changes what callers trust. Before editing this file, preserve the rule that forwarded headers count only when `proxyFn` trusts the socket.

## Change coupling

`lib/errors.js` moves with `types/errors.d.ts` at 93% and with `docs/Reference/Errors.md` at 59%. This coupling is by design: each code has a type and a doc entry. When you add or rename a code, edit all 3 files in 1 commit.

`lib/warnings.js` moves with `docs/Reference/Warnings.md` at 71%, by the same design. Document each new `FSTWRN` code in `docs/Reference/Warnings.md`.

`fastify.js` moves with `lib/route.js` at 45% and `lib/server.js` at 39%. The factory passes its options into `buildRouting` and `createServer`, so a new option crosses both boundaries. When you add a server option, trace it from `processOptions` into both files.

`lib/reply.js` moves with `lib/symbols.js` at 52% and `lib/request.js` at 40%. This coupling is decay: `hijack` clears request timers through `kTimeoutTimer` and `kOnAbort` directly. Put new shared request state behind a Request method instead of a new symbol.

`types/instance.d.ts` moves with `types/hooks.d.ts` at 56% and `types/route.d.ts` at 41%. The instance type declares `addHook` and the route methods, so their signatures live in 2 places. When you change a hook or route signature, update `types/instance.d.ts` in the same commit.

## What to read first

1. `lib/symbols.js`, because it names every internal state key that the other files read.
2. `fastify.js`, because it defines the instance shape and the boot and close lifecycle.
3. `lib/errors.js`, because every module throws its codes and the types mirror them.
4. `lib/reply.js`, because it holds the send path where most response bugs land.
5. `lib/request.js`, because its proxy getters decide which client data callers trust.
6. `types/instance.d.ts`, because it is the typed public contract of the instance.
