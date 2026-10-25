---
complex_md: "0.3"
generated: 2026-06-06
commit: fc9eafdd
tool: complex-md/bench
window_commits: 1845
files_analyzed: 50
profile:
  files_total: 392
  files_in_scope: 50
  loc_in_scope: 10521
  kinds: "test 230, docs 52, source 50, ci 24, example 19, other 8, generated 6, asset 1, manifest 1, data 1"
  languages: "js 34, ts 16"
  dependency_edges: 503
  commits_total: 4298
  commits_analyzed: 1679
  commits_skipped: 166
  half_life_commits: 461
  window_from: 2021-02-19
  window_to: 2026-06-06
  velocity_30d: 28.6
  authors_total: 588
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1014
    churn: 220
    churn_w: 68.90
    fixes: 51
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 191
    score: 12781
  - path: lib/errors.js
    kind: source
    loc: 528
    churn: 45
    churn_w: 14.51
    fixes: 19
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10393
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 27
    churn_w: 7.97
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 19
    tests: 28
    score: 5676
  - path: lib/reply.js
    kind: source
    loc: 1033
    churn: 88
    churn_w: 25.11
    fixes: 36
    authors: 45
    owner_share: 0.18
    fan_in: 3
    tests: 14
    score: 4937
  - path: lib/request.js
    kind: source
    loc: 396
    churn: 47
    churn_w: 19.05
    fixes: 19
    authors: 26
    owner_share: 0.15
    fan_in: 3
    tests: 15
    score: 3816
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.83
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3140
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.20
    fixes: 10
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2987
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 23
    coupling: 58
  - files: [fastify.d.ts, fastify.js]
    count: 21
    coupling: 34
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 40
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 38
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 38
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 15
    coupling: 71
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 15
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "155 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public instance API. The request lifecycle files `lib/reply.js` and `lib/request.js` carry the next share. Two shared contracts hold the rest: `lib/errors.js` defines the error codes, and `lib/symbols.js` defines the internal property keys. Bug fixes land most in `fastify.js` with 51 fixes, `lib/route.js` with 39 and `lib/reply.js` with 36. No file qualifies as load-bearing, because every heavily imported file changed in the window. Ownership is spread across 588 committers, and only `fastify.js` has a top committer share above 30%, at 46%.

## Why these files are hot

`fastify.js` (1014 lines) builds the instance object: route shorthands, hooks, schema setters, decorators and the Avvio boot sequence. It had 220 commits in the window, and 51 were fixes. 191 test files reach it, so a public behavior change shows up across the suite. Before editing this file, open `lib/route.js` and `fastify.d.ts` next to it.

`lib/errors.js` (528 lines) creates every `FST_ERR_*` code through `@fastify/error`, with a message, a status code and an error class. 17 files import it, and 19 of its 45 commits were fixes. Users match on these codes and status values, so a renamed code breaks client code. Before editing this file, open `docs/Reference/Errors.md` and `test/internals/errors.test.js`.

`lib/symbols.js` (73 lines) exports the `Symbol` keys for internal state on the instance, request, reply and route context. It has the highest fan-in at 19 files, and 28 test files reach it. A renamed or removed key returns `undefined` in every file that reads it. Before editing this file, find every reader of each key that you rename or remove, `test/` included.

`lib/reply.js` (1033 lines) implements `Reply`: headers, trailers, status codes, serialization and the send path through the `onSend` and `onError` hooks. 36 of its 88 commits were fixes. Streams, web streams, `Response` objects and buffers each take a separate branch. Before editing this file, run its 14 covering test files, which include `test/diagnostics-channel/`.

`lib/request.js` (396 lines) implements `Request` and builds a trust-proxy variant that overrides `ip`, `ips`, `host` and `protocol`. 19 of its 47 commits were fixes, and 15 test files reach it. Before editing this file, compare each getter with its override in `buildRequestWithTrustProxy`.

## Change coupling

`fastify.js` moves with `lib/route.js` (45%), `lib/server.js` (40%) and `fastify.d.ts` (34%). This coupling is by design: the factory wires the router and the HTTP server, and the declaration file mirrors the public API. When the instance API changes, update `fastify.d.ts` in the same commit.

`lib/warnings.js` and `docs/Reference/Warnings.md` share 71% of commits. `lib/errors.js` and `docs/Reference/Errors.md` share 58%. The reference pages list every code, so this coupling is by design. Add, change or retire a code in the source file and its reference page together.

`lib/reply.js` moves with `lib/symbols.js` (52%) and `lib/request.js` (38%). New reply state needs a new key, and request and reply share the route context. When reply state changes, check the symbol and the related request property.

`types/instance.d.ts` moves with `types/hooks.d.ts` (58%) and `types/route.d.ts` (43%). A hook or route signature change also reaches the instance interface. When one of these 3 files changes, open the other 2.

## What to read first

1. `lib/symbols.js`: the key names for all internal state that other files read.
2. `fastify.js`: the instance object and the public API surface.
3. `lib/route.js`: the router behind every route method, with 39 fixes and 0 direct tests.
4. `lib/reply.js`: the send path and the hook order at the end of a request.
5. `lib/errors.js`: the error codes that users match on.
6. `fastify.d.ts`: the public type contract that tracks `fastify.js`.
