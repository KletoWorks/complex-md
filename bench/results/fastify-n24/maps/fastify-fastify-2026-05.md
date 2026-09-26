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

Risk concentrates in the request lifecycle and the public instance API: `fastify.js` assembles the server object, `lib/reply.js` and `lib/request.js` implement the per-request objects, and `lib/errors.js` plus `lib/symbols.js` define the vocabulary everything else imports. Four files hold half the total score, so most edits land in a small, heavily depended-upon core. Bug fixes cluster in `fastify.js` (50 fixes of 219 commits), `lib/reply.js` (36 of 88) and `lib/route.js` (39 of 88) — the send path and the route builder are where correctness problems surface. `lib/symbols.js` and `lib/errors.js` are the widest floors: 19 and 17 files import them, and both carry public contracts, since error codes are documented and symbol keys are read across modules. The TypeScript surface (`fastify.d.ts`, `types/*.d.ts`) has no test coverage in this map and no runtime dependents, so it drifts from the JavaScript unless changed in the same commit. With 587 committer identities and ownership spread thin — `lib/errors.js` at 0.09, `lib/route.js` at 0.10 — no single maintainer's knowledge covers a change here; the tests and the docs are the memory. Generated and lock files (9) are excluded from this map.

## Why these files are hot

`fastify.js` builds the instance: it wires the router, 404 handler, hooks, schema controller, content-type parser, error handler and every shorthand route method, and exposes them through one object literal plus `Object.defineProperties`. It changes constantly because every new server option, hook name or instance method must be threaded through `processOptions` and the object literal, and 50 of its commits were fixes. Six files depend on it, including `lib/route.js` and three `.d.ts` files, so an edit that renames an option or a symbol key breaks routing and the published types at once. Before editing this file, open `lib/route.js` alongside it (they change together in 45% of the quieter file's commits) and run the tests that cover it, starting with `test/constrained-routes.test.js` and `test/custom-parser.0.test.js`.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, each with a code string, message template, status code and error class. It changes whenever a new failure mode is added and 19 of its 45 commits were fixes, usually to a message or a status code. Seventeen files import it, and the codes are part of the public API: renaming one, changing its status code or reordering the format placeholders breaks user error handling silently. Before editing this file, add or amend the matching entry in `docs/Reference/Errors.md` in the same commit and run `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` keys naming internal state on the instance, request, reply and route context. It is hot despite its size because 19 files import it and 29 test files reach it — every new piece of internal state starts here. Deleting or renaming a key breaks consumers that never mention the file's name, and symbols like `kTestInternals` exist only for tests. Before editing this file, grep the repository for the symbol name you are changing and confirm no entry is removed while any of the 19 dependents still reads it.

`lib/reply.js` implements the response: `send`, header and trailer handling, status codes, serialization compilation and caching, stream and web-stream sending, and the onSend/onError/onResponse hook runners. It is the largest file in scope at 1033 lines and the most fix-prone after `fastify.js` (36 fixes of 88 commits), because payload-type handling, content-type defaulting and stream teardown are full of edge cases. It reads route context through symbols and shares the request lifecycle with `lib/request.js`. Before editing this file, preserve the `send` contract that a hijacked or already-sent reply never writes twice, and run the `test/diagnostics-channel/` suite, which exercises the full request-to-response path.

`lib/request.js` builds the per-request object and its lazily specialized constructors: `buildRegularRequest` and `buildRequestWithTrustProxy` create prototype chains per instance, and getters derive `ip`, `host`, `protocol`, `port`, `signal` and `routeOptions` from the raw Node request. Its 19 fixes of 48 commits cluster on proxy and host parsing, where header trust decides the values. Its prototype-copying scheme means decorators added after construction behave differently from those added before. Before editing this file, keep `buildRegularRequest`'s prop-copy loop consistent with `Request.props`, and run the `test/diagnostics-channel/` tests plus any trust-proxy test that touches `ip` and `host`.

## Change coupling

`fastify.js` and `lib/route.js` move together in 45% of the quieter file's commits, and `fastify.js` with `lib/server.js` in 40%. This is by design: the instance owns route shorthands and server creation but delegates the implementation. When you touch a route option or an HTTP method set in one, open the other and check `buildRouting`, `buildRouterOptions` and `kSupportedHTTPMethods` agree.

`lib/errors.js` and `docs/Reference/Errors.md` at 59%, and `lib/warnings.js` and `docs/Reference/Warnings.md` at 74%, are documentation contracts, not decay — the codes are published surface. When you add or change a code or warning, edit the matching docs table in the same commit.

`fastify.d.ts` with `fastify.js` (34%), `types/instance.d.ts` with `types/route.d.ts` (43%) and `types/hooks.d.ts` with `types/instance.d.ts` (58%) track the same runtime API from the type side, with no tests covering them here. When you change an option, hook name or route option in JavaScript, update the corresponding `.d.ts` and verify with the type tests rather than the unit suite.

`lib/reply.js` with `lib/request.js` (38%) and `lib/reply.js` with `lib/symbols.js` (52%) reflect shared per-request state passed through symbol keys. When one side adds a symbol-keyed field, check that the other reads and clears it — the timeout timer and abort listener cleared in `Reply.prototype.hijack` are set in `lib/request.js`.

## What to read first

1. `lib/symbols.js` — the names of every piece of internal state; nothing else in `lib/` reads clearly without it.
2. `fastify.js` — the instance object literal and `processOptions` show which module owns what.
3. `lib/errors.js` — the published failure vocabulary that 17 files throw.
4. `lib/route.js` — the route builder that `fastify.js` delegates to and changes with.
5. `lib/reply.js` and `lib/request.js` — the request lifecycle and the symbol-keyed state they share.
6. `docs/Reference/Errors.md` and `docs/Reference/Warnings.md` — the documented contract your code changes must match.
7. `test/diagnostics-channel/` — the end-to-end path through request, reply, hooks and error handling.
