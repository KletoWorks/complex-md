---
complex_md: "0.3"
generated: 2026-04-20
commit: d76dbcd5
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 390
  files_in_scope: 49
  loc_in_scope: 10412
  kinds: "test 227, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 33, ts 16"
  dependency_edges: 373
  commits_total: 4272
  commits_analyzed: 1821
  commits_skipped: 179
  half_life_commits: 500
  window_from: 2021-01-25
  window_to: 2026-04-20
  velocity_30d: 31.4
  authors_total: 594
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 984
    churn: 220
    churn_w: 69.05
    fixes: 50
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12677
  - path: lib/errors.js
    kind: source
    loc: 516
    churn: 43
    churn_w: 12.92
    fixes: 17
    authors: 32
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 9630
  - path: lib/symbols.js
    kind: source
    loc: 72
    churn: 27
    churn_w: 7.26
    fixes: 11
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 29
    score: 5344
  - path: lib/reply.js
    kind: source
    loc: 1032
    churn: 86
    churn_w: 23.83
    fixes: 35
    authors: 44
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4798
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 46
    churn_w: 17.66
    fixes: 18
    authors: 25
    owner_share: 0.15
    fan_in: 3
    tests: 14
    score: 3677
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.95
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3187
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.56
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2882
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 46
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
    count: 15
    coupling: 43
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 78
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 52
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: the instance factory `fastify.js`, the reply and request objects `lib/reply.js` and `lib/request.js`, and the two shared vocabularies every module imports, `lib/errors.js` and `lib/symbols.js`. Four files hold half the total score, and all four sit on the path every HTTP request takes. Bug fixes land heaviest in `fastify.js` (50 fixes of 220 commits), `lib/route.js` (38 of 87) and `lib/reply.js` (35 of 86) — the routing and response-sending code, where async ordering and header state go wrong. `lib/errors.js` and `lib/symbols.js` are hot for a different reason: 17 and 19 files depend on them, so a rename there ripples across the whole `lib/` tree. With 594 committer identities, ownership is broadly shared; the one exception is `fastify.js`, where a single committer holds 46% of its history, so that file has a de facto maintainer whose conventions the code already follows. The map does not cover the 9 generated or lock files, and one credential-shaped path is deliberately absent from every list.

## Why these files are hot

`fastify.js` builds the instance object: every public method, every internal symbol slot, the Avvio boot wiring, and the option processing in `processOptions`. It changes whenever the public API grows, and 50 of its 220 commits were fixes, mostly around close/listen state and hook registration. It is imported by `lib/route.js`, `lib/logger-factory.js` and the `types/` declarations, and 63 test files reach it, so an edit that shifts the shape of the returned object breaks tests across the suite. Before editing this file, run the tests that name your area (`test/async-dispose.test.js` and `test/body-limit.test.js` for lifecycle and limits) and keep the `kState` transitions and the `Object.defineProperties` getter contract intact.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, re-exported as `fastify.errorCodes`. Its 43 commits are almost all additions of new codes, with 17 fixes correcting messages and status codes. Seventeen files import it and it is part of the public API, so changing a code string, status or constructor argument count is a breaking change for users. Before editing this file, run `test/internals/errors.test.js`, and update `docs/Reference/Errors.md` in the same commit — the two move together 57% of the time.

`lib/symbols.js` is 72 lines of `Symbol()` declarations and the most depended-on file in the repository: 19 modules import keys from it, 29 test files reach it. It changes only when new internal state appears, but 11 of its 27 commits were fixes, which means symbol lifecycle mistakes — state set but never cleared — are the recurring failure. Before editing this file, grep for the symbol name across `lib/` and `test/` and confirm every writer has a matching reader and reset path.

`lib/reply.js` owns response serialization, headers, trailers, streams and the onSend/onError hook runners. It is the largest file in scope at 1032 lines, and 35 of its 86 commits were fixes, concentrated in `onSendEnd`, `sendTrailer` and the stream error paths where `res.end` can be called twice. Only three files import it, but it defines the behavior every route handler observes. Before editing this file, run the `test/diagnostics-channel/` suite, which exercises the full send path for sync, async, error and 404 replies.

`lib/request.js` defines the request object and its lazily built prototypes — `buildRequestWithTrustProxy` overrides `ip`, `host` and `protocol` when `trustProxy` is set, so the same getter has two implementations. Eighteen of its 46 commits were fixes, largely in proxy header parsing and validation compilation caching. Before editing this file, check whether your change must be mirrored in both `buildRegularRequest` and `buildRequestWithTrustProxy`, and open `lib/reply.js` alongside it — the pair moves together in 39% of commits.

## Change coupling

`fastify.js` and `lib/route.js` share 40 commits (46%): the instance exposes the shorthand route methods and delegates to `router.prepareRoute`, so the route option contract lives in two places. This is by design but thinly documented; when you change a route option, open both and check `buildRouterOptions` and `validateBodyLimitOption`. `fastify.js` and `lib/server.js` (40%) split server creation and connection teardown, so touching close or listen behavior means reading both. Note that `lib/route.js`, `lib/server.js` and `lib/error-handler.js` have no tests reaching them directly in this analysis; verify changes there through the route and 500-level suites instead of a file-named test.

Docs are coupled to code, tightly. `lib/warnings.js` and `docs/Reference/Warnings.md` move together in 78% of commits, and `lib/errors.js` with `docs/Reference/Errors.md` in 57%. These are contracts with users. When you add or change a warning or error code, edit its doc entry in the same commit.

The type declarations form their own cluster: `types/instance.d.ts` with `types/route.d.ts` (43%) and with `types/hooks.d.ts` (58%). The `.d.ts` files carry no tests and no fan-in, so they drift from the JavaScript silently. When you add a method or hook to `fastify.js` or `lib/hooks.js`, update the matching declaration and run the type tests before considering the change complete.

`lib/symbols.js` pairs with both `fastify.js` (52%) and `lib/reply.js` (52%), which is what adding internal state looks like: declare the symbol, initialize it on the instance, read it in the reply. Adding a symbol without all three sites is the incomplete change to watch for.

## What to read first

1. `lib/symbols.js` — the shared internal vocabulary; 19 modules read it, and nothing in `lib/` is legible without it.
2. `lib/errors.js` — every error the framework can throw, plus the public `errorCodes` export.
3. `fastify.js` — the instance shape and boot sequence; the entry point for the public API.
4. `lib/route.js` — route registration and the router options that `fastify.js` delegates to.
5. `lib/reply.js` — the response send path, where the largest share of fixes lands.
6. `lib/hooks.js` — the hook runners that `lib/reply.js` and `lib/handle-request.js` drive; only 3 tests reach it.
7. `docs/Reference/Errors.md` and `docs/Reference/Warnings.md` — the user-facing contracts you must update alongside their source files.
