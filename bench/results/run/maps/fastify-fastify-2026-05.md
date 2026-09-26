---
complex_md: "0.3"
generated: 2026-05-20
commit: 3e04cff9
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 392
  files_in_scope: 49
  loc_in_scope: 10509
  kinds: "test 228, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1, data 1"
  languages: "js 33, ts 16"
  dependency_edges: 372
  commits_total: 4291
  commits_analyzed: 1829
  commits_skipped: 171
  half_life_commits: 500
  window_from: 2021-02-12
  window_to: 2026-05-20
  velocity_30d: 31.2
  authors_total: 587
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1014
    churn: 219
    churn_w: 68.13
    fixes: 50
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12678
  - path: lib/errors.js
    kind: source
    loc: 528
    churn: 45
    churn_w: 14.55
    fixes: 19
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10410
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 27
    churn_w: 8.01
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 19
    tests: 29
    score: 5688
  - path: lib/reply.js
    kind: source
    loc: 1033
    churn: 88
    churn_w: 25.19
    fixes: 36
    authors: 45
    owner_share: 0.18
    fan_in: 3
    tests: 14
    score: 4945
  - path: lib/request.js
    kind: source
    loc: 396
    churn: 48
    churn_w: 19.17
    fixes: 19
    authors: 26
    owner_share: 0.17
    fan_in: 3
    tests: 15
    score: 3827
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.85
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3149
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.23
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2845
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 23
    coupling: 59
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
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 15
    coupling: 43
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 74
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
---

## Where the risk lives

Risk concentrates in the request lifecycle and the instance factory: `fastify.js` assembles the public API object, the router, the server and every internal symbol slot, while `lib/reply.js` and `lib/request.js` implement the per-request objects that route handlers touch. Four files hold half the total score, and all four are on that path. Bug fixes land heaviest in `fastify.js` (50 fixes of 219 commits), `lib/reply.js` (36 of 88) and `lib/route.js` (39 of 88) — response serialization and route registration are where the corner cases surface. Two small files carry outsized structural weight: `lib/symbols.js` (73 lines, 19 dependents) is the shared key namespace for all internal state, and `lib/errors.js` (17 dependents) is the public error-code catalogue. No file qualifies as load-bearing-and-untouched; everything with high fan-in also moves. With 587 committer identities and no owner above 46%, ownership is diffuse — treat no file as having a single maintainer to defer to. Nine generated or lock files are outside this map.

## Why these files are hot

**fastify.js** builds the instance: it wires `buildRouting`, `createServer`, `build404`, the `Hooks` registry, the schema controller and the content-type parser into one object, then defines the shorthand route methods and the getter properties (`prefix`, `validatorCompiler`, `errorHandler`, `supportedMethods`). Every new server option, hook name or route method lands here, which is why it has 219 commits and the widest test surface in the repo (63 covering test files, including `test/custom-parser.*.test.js` and `test/constrained-routes.test.js`). Anything added to the returned `fastify` object is part of the public API and is mirrored in `fastify.d.ts`. Before editing this file, open `fastify.d.ts` alongside it and check whether the property you touch is also declared in `types/instance.d.ts`.

**lib/errors.js** is a flat table of `createError` definitions plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. Seventeen files import codes from it, and the codes are re-exported as `module.exports.errorCodes` from `fastify.js`, so a code name, message string, status code or error subclass is a published contract. Nineteen of its 45 commits were fixes, mostly message and status corrections. `test/internals/errors.test.js` asserts the catalogue. Before editing this file, run `test/internals/errors.test.js` and add the matching entry to `docs/Reference/Errors.md` in the same commit.

**lib/symbols.js** is one exported object of `Symbol()` keys, grouped by consumer (Schema, Request, Reply, 404). Nineteen files read from it and 29 test files reach it; renaming or removing a key breaks every consumer silently, because a missing symbol reads as `undefined` rather than throwing. It changes whenever new per-request or per-reply state is introduced — 27 commits, 11 of them fixes. Before editing this file, grep the repo for the symbol name to find every reader, and add keys rather than repurposing existing ones.

**lib/reply.js** owns response state and the send path: header and trailer handling, status-code validation, serializer compilation and caching in `kReplyCacheSerializeFns`, the `onSend`/`preSerialization`/`onError`/`onResponse` hook runners, and the stream, web-stream and `Response` send branches. It reads roughly two dozen symbols directly, and 36 of its 88 commits were fixes — this is the file where payload-type and stream-lifecycle edge cases get corrected. Covered by `test/diagnostics-channel/*.test.js` among 14 test files. Before editing this file, trace the branch you are changing through `onSendHook` → `onSendEnd` and confirm `reply.sent` and the hijack path in `Reply.prototype.hijack` still clear the timeout timer and abort listener.

**lib/request.js** defines the `Request` prototype and the two build paths — `buildRegularRequest` and `buildRequestWithTrustProxy` — that produce a per-instance subclass with prototype-chained decorators. The getters (`ip`, `host`, `protocol`, `port`, `signal`, `routeOptions`) plus `compileValidationSchema` and `validateInput` are all public surface; 19 of 48 commits were fixes, largely around proxy header parsing and host fallbacks. Before editing this file, check whether your change belongs on the plain prototype or only in the trustProxy variant, and run the proxy-related tests before assuming both paths agree.

## Change coupling

`fastify.js` and `lib/route.js` share 40 commits (45%), and `fastify.js` and `lib/server.js` 18 (40%). This is by design: route registration options flow from the factory into `buildRouting`, and server construction options into `createServer`. When you add or rename a route or server option, open all three and check `lib/initial-config-validation.js` accepts it.

`fastify.d.ts` moves with `fastify.js` (34%), and within the types tree `types/instance.d.ts` pairs with `types/route.d.ts` (43%) and `types/hooks.d.ts` (58%). The declaration files carry no tests. When you change a runtime signature, update the matching `.d.ts` in the same commit and run the type tests.

`docs/Reference/Warnings.md` follows `lib/warnings.js` at 74%, and `docs/Reference/Errors.md` follows `lib/errors.js` at 59%. Each code is documented by hand. When you add a warning or error code, add its documentation entry in the same change.

`lib/reply.js` pairs with `lib/request.js` (38%) and with `lib/symbols.js` (52%). The request/reply pairing is the shared lifecycle; the symbols pairing is new state being threaded through. If a reply change needs a new symbol, verify no existing key already serves that purpose before adding one.

## What to read first

1. `lib/symbols.js` — the vocabulary for all internal state; nothing else reads clearly without it.
2. `fastify.js` — the instance factory and the definition of the public API surface.
3. `lib/errors.js` — the error-code contract every other module throws through.
4. `lib/route.js` — route registration, the partner to `fastify.js` in 45% of its commits.
5. `lib/reply.js` — the send path and hook runners, where most response bugs live.
6. `lib/request.js` — the per-request object and its two build paths.
7. `fastify.d.ts` and `types/instance.d.ts` — the typed mirror of anything you change in the factory.
