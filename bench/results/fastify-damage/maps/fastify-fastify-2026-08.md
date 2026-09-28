---
complex_md: "0.3"
generated: 2026-08-03
commit: 043baf98
tool: complex-md/bench
window_commits: 2000
files_analyzed: 50
profile:
  files_total: 395
  files_in_scope: 50
  loc_in_scope: 11332
  kinds: "test 231, docs 52, source 50, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 383
  commits_total: 4377
  commits_analyzed: 1862
  commits_skipped: 138
  half_life_commits: 500
  window_from: 2021-04-17
  window_to: 2026-08-03
  velocity_30d: 31
  authors_total: 595
  concentration_50: 5
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1026
    churn: 225
    churn_w: 68.97
    fixes: 53
    authors: 66
    owner_share: 0.45
    fan_in: 7
    tests: 63
    score: 14143
  - path: lib/errors.js
    kind: source
    loc: 548
    churn: 46
    churn_w: 15.61
    fixes: 18
    authors: 32
    owner_share: 0.11
    fan_in: 17
    tests: 10
    score: 10767
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 28
    churn_w: 8.05
    fixes: 11
    authors: 15
    owner_share: 0.14
    fan_in: 21
    tests: 29
    score: 5936
  - path: lib/reply.js
    kind: source
    loc: 1076
    churn: 93
    churn_w: 29.07
    fixes: 38
    authors: 46
    owner_share: 0.19
    fan_in: 3
    tests: 14
    score: 5418
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 50
    churn_w: 19.79
    fixes: 22
    authors: 27
    owner_share: 0.16
    fan_in: 3
    tests: 15
    score: 3947
  - path: lib/warnings.js
    kind: source
    loc: 84
    churn: 38
    churn_w: 14.54
    fixes: 12
    authors: 21
    owner_share: 0.16
    fan_in: 5
    tests: 2
    score: 3477
  - path: lib/hooks.js
    kind: source
    loc: 433
    churn: 18
    churn_w: 4.40
    fixes: 8
    authors: 15
    owner_share: 0.17
    fan_in: 7
    tests: 3
    score: 3441
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 26
    coupling: 60
  - files: [lib/reply.js, lib/request.js]
    count: 20
    coupling: 40
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 17
    coupling: 71
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [fastify.js, lib/errors.js]
    count: 17
    coupling: 37
  - files: [lib/errors.js, types/errors.d.ts]
    count: 16
    coupling: 94
  - files: [docs/Reference/Errors.md, types/errors.d.ts]
    count: 15
    coupling: 88
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 15
    coupling: 58
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the instance factory and the request lifecycle: `fastify.js` assembles the public instance object, and `lib/reply.js`, `lib/request.js` and `lib/hooks.js` carry every request from parse to serialization. Five files hold half the total score. Bug fixes land hardest in `fastify.js` (53 fixes across 225 commits), `lib/reply.js` (38 of 93) and `lib/request.js` (22 of 50) — the serialization and response-ending paths are where regressions surface. Two small files carry outsized structural weight: `lib/symbols.js` (73 lines, 21 dependents) defines the private property keys every other module reads, and `lib/errors.js` (17 dependents) is the single registry of `FST_ERR_*` codes, both a public API and an internal contract. With 595 committers and no file above 45% owner share, there is no single owner to consult; the tests and the docs are the specification. Nine generated or lock files sit outside this map.

## Why these files are hot

`fastify.js` builds the instance: symbol-keyed internal state, the shorthand route methods, decorators, hooks, content-type parsers, `inject`, `listen` and close. Every option validated in `processOptions` becomes public surface, and 63 test files reach it, so an edit here breaks broadly and quietly. Before editing this file, run the covering tests it names (`test/body-limit.test.js`, `test/custom-parser.*.test.js`, `test/constrained-routes.test.js`) and keep the `module.exports` shape intact — `fastify`, `fastify.fastify`, `errorCodes` and `LogController` are all exported deliberately.

`lib/errors.js` is a flat table of `createError` definitions keyed by code, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. It changes whenever any module needs a new failure mode, which is why 17 files depend on it. Codes, messages and status codes are published API; renaming one or changing a status silently breaks user error handling. Before editing this file, open `types/errors.d.ts` and `docs/Reference/Errors.md` in the same change and run `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` definitions and nothing else, yet 21 files import from it and 29 test files reach it. Its 11 fixes are almost all consequences of lifecycle changes elsewhere: a new symbol added in one module, read in another. Removing or renaming a key breaks modules that never appear in the diff. Before editing this file, grep the repo for the symbol name to find every reader, and add rather than repurpose an existing key.

`lib/reply.js` owns response state: headers, trailers, status codes, serialization caching, stream and web-stream sending, and hijacking. 38 of its 93 commits are fixes, the highest fix density among the large files, because payload-type branching in `send` and the stream teardown in `sendStream`/`sendWebStream` have many edge cases. Before editing this file, run the `test/diagnostics-channel/*.test.js` suite that covers it and preserve the `send` branch order — content-type detection happens before serializer selection.

`lib/request.js` builds per-request objects through `buildRegularRequest` and `buildRequestWithTrustProxy`, exposing `ip`, `host`, `protocol`, `signal` and the validation-compilation helpers. It moves with `lib/reply.js` because both share `kRouteContext` and the decorator machinery. Before editing this file, check whether the change also belongs in `lib/reply.js`, and keep the two constructor variants in sync — the trust-proxy build overrides getters the regular build inherits.

## Change coupling

`fastify.js` and `lib/route.js` share 40 commits at 45% coupling. This is by design: `buildRouting` returns the `prepareRoute`/`route` functions the instance exposes, so a new routing option needs both sides. When you change one, open the other and check the option is threaded through `buildRouterOptions`.

`lib/errors.js` and `types/errors.d.ts` couple at 94%, and `docs/Reference/Errors.md` joins at 88% and 60%. The error table has three synchronized copies — runtime, types, docs — with no generator enforcing agreement. Change all three in the same commit, or add a test that asserts the type declarations match the runtime codes.

`lib/warnings.js` and `docs/Reference/Warnings.md` couple at 71%, the same documented-registry pattern. Add the doc entry when you add the warning code.

`lib/reply.js` and `lib/request.js` couple at 40% through shared symbols and decorators; `fastify.js` and `lib/server.js` at 39% through server construction and close. Open the partner file in both cases.

## What to read first

1. `lib/symbols.js` — the vocabulary every other module uses; read it before anything else.
2. `lib/errors.js` — the failure contract, and the file with the widest fan-in after symbols.
3. `fastify.js` — the instance shape and the option validation that defines the public API.
4. `lib/route.js` — where routes are prepared; the partner to `fastify.js` in nearly half its commits.
5. `lib/reply.js` and `lib/request.js` — the request lifecycle; read as a pair.
6. `docs/Reference/Errors.md` — what users are promised about error codes.
