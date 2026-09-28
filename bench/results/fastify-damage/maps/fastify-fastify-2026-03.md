---
complex_md: "0.3"
generated: 2026-03-27
commit: d457aeda
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 389
  files_in_scope: 49
  loc_in_scope: 10407
  kinds: "test 226, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 33, ts 16"
  dependency_edges: 369
  commits_total: 4255
  commits_analyzed: 1817
  commits_skipped: 183
  half_life_commits: 500
  window_from: 2021-01-13
  window_to: 2026-03-27
  velocity_30d: 31.6
  authors_total: 593
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 985
    churn: 219
    churn_w: 68.73
    fixes: 49
    authors: 67
    owner_share: 0.47
    fan_in: 6
    tests: 63
    score: 12626
  - path: lib/errors.js
    kind: source
    loc: 516
    churn: 44
    churn_w: 13.29
    fixes: 17
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 9760
  - path: lib/symbols.js
    kind: source
    loc: 71
    churn: 26
    churn_w: 6.42
    fixes: 10
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 27
    score: 4936
  - path: lib/reply.js
    kind: source
    loc: 1030
    churn: 86
    churn_w: 23.44
    fixes: 34
    authors: 45
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4729
  - path: lib/request.js
    kind: source
    loc: 387
    churn: 44
    churn_w: 16.07
    fixes: 16
    authors: 25
    owner_share: 0.14
    fan_in: 3
    tests: 13
    score: 3450
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 4.05
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3221
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.86
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2915
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
    coupling: 41
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
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in two places: the instance factory in `fastify.js`, which assembles the entire public API and its symbol-keyed state, and the per-request pair `lib/reply.js` and `lib/request.js`, which own serialization, headers, streaming and the request lifecycle. The widest structural surfaces are `lib/errors.js` (17 dependents) and `lib/symbols.js` (19 dependents): both are cheap to edit and expensive to get wrong, because every other module reads from them. Bug fixes land heaviest in `fastify.js` (49 fixes), `lib/route.js` (39) and `lib/reply.js` (34). There are no untouched load-bearing files — every file many others depend on also changed in this window, so the floor moves too. Ownership splits sharply: with 593 committers overall, `fastify.js` has a dominant maintainer (owner_share 0.47) while `lib/errors.js` (0.09), `lib/request.js` (0.14) and `lib/reply.js` (0.17) are edited by dozens of people with no owner, so conventions in those files live in the tests, not in a reviewer's head. Nine generated or lock files and one credential-shaped path are outside this map.

## Why these files are hot

`fastify.js` builds the server instance: the symbol-keyed state block, every route shorthand, the `Object.defineProperties` getter set, hook registration, `inject`, `ready`, and the close/shutdown sequence. It changes constantly (219 commits, 68.73 weighted) because every new server option or instance method lands here, and 49 of those commits were fixes. Six files depend on it, including `lib/route.js` and three `.d.ts` files, so an added instance property is also a typings change. Before editing this file, check whether the property you are adding needs a matching entry in `types/instance.d.ts`, and run the covering tests under `test/` that name the option you touched — 63 test files reach this file, starting with `test/async-dispose.test.js` and `test/constrained-routes.test.js`.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. Seventeen files import from it, and the codes are public API: a renamed code or a changed message template breaks user error handling. Before editing this file, keep existing codes and their status/constructor arguments intact, add new codes rather than repurposing old ones, and update `docs/Reference/Errors.md` in the same commit — `test/internals/errors.test.js` asserts the registry.

`lib/symbols.js` is 71 lines of `Symbol()` keys and the most depended-on file in the repo (19 dependents). It changes whenever internal state is added (26 commits, 10 fixes), and a removed or renamed key silently breaks every reader. Before editing this file, grep the repo for the symbol name to find every consumer before removing or renaming it, and add rather than reuse keys.

`lib/reply.js` is the largest hotspot (1030 lines): headers, trailers, status codes, serialization compilation and caching, `onSend`/`onError`/`onResponse` hook running, and stream and web-stream sending. Its 34 fixes concentrate in edge cases — content-type charset handling, premature stream close, hijacked replies. Only three files import it, but every handler depends on its behavior. Before editing this file, preserve the send-path invariants around `sent`, `hijack` and header mutation after `writeHead`, and run the `test/diagnostics-channel/*.test.js` suite that covers the request/response lifecycle.

`lib/request.js` defines the request object and, when `trustProxy` is set, a second prototype with `ip`, `ips`, `host` and `protocol` getters gated on the proxy trust function. It carries 16 fixes, several of them in exactly that gating and in host/port parsing. Before editing this file, verify both prototypes — `buildRegularRequest` and `buildRequestWithTrustProxy` — behave consistently for any getter you change, since only the trust-proxy variant consults forwarded headers.

## Change coupling

`fastify.js` and `lib/route.js` move together in 41 commits (46%): route registration is split across the factory's shorthand methods and the router builder. This is by design, but the seam is wide — when you change route option handling in one, open the other and confirm the option is both accepted and consumed.

`lib/errors.js` with `docs/Reference/Errors.md` (57%) and `lib/warnings.js` with `docs/Reference/Warnings.md` (78%) are documentation contracts: the code list and the doc list must agree. Add the doc entry in the same commit as the code.

`lib/reply.js` and `lib/request.js` (41%) co-change because they share symbols and the abort/timeout lifecycle. When you touch `kRequestSignal`, `kTimeoutTimer` or `kOnAbort` in one, check the other's use of the same symbol.

`types/instance.d.ts` with `types/route.d.ts` (44%) and `types/hooks.d.ts` (58%) track the JavaScript API separately from it. Treat a change to instance methods, route options or hooks in `lib/` as unfinished until the matching `.d.ts` is updated.

## What to read first

1. `lib/symbols.js` — the vocabulary every other module uses; 71 lines, and nothing else makes sense without it.
2. `fastify.js` — the instance shape, option processing and boot/close order.
3. `lib/errors.js` — the public error code registry you must not break.
4. `lib/route.js` — route registration, the other half of `fastify.js`.
5. `lib/reply.js` and `lib/request.js` — the per-request contract handlers actually use.
6. `types/instance.d.ts` — the typed mirror of the instance API, which you will likely have to edit alongside any change above.
