---
complex_md: "0.3"
generated: 2025-05-09
commit: 850ebf6e
tool: complex-md/bench
window_commits: 2000
files_analyzed: 46
profile:
  files_total: 385
  files_in_scope: 46
  loc_in_scope: 9559
  kinds: "test 222, docs 52, source 45, ci 27, example 18, other 9, generated 9, asset 1, manifest 1, config 1"
  languages: "js 29, ts 16, json 1"
  dependency_edges: 354
  commits_total: 3959
  commits_analyzed: 1762
  commits_skipped: 238
  half_life_commits: 500
  window_from: 2020-05-18
  window_to: 2025-05-09
  velocity_30d: 33
  authors_total: 617
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 946
    churn: 212
    churn_w: 67.23
    fixes: 54
    authors: 73
    owner_share: 0.45
    fan_in: 5
    tests: 61
    score: 10974
  - path: lib/errors.js
    kind: source
    loc: 494
    churn: 44
    churn_w: 15.26
    fixes: 17
    authors: 36
    owner_share: 0.07
    fan_in: 16
    tests: 10
    score: 9965
  - path: lib/reply.js
    kind: source
    loc: 948
    churn: 88
    churn_w: 26.07
    fixes: 37
    authors: 48
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 5001
  - path: lib/symbols.js
    kind: source
    loc: 65
    churn: 28
    churn_w: 6.38
    fixes: 13
    authors: 15
    owner_share: 0.14
    fan_in: 17
    tests: 24
    score: 4576
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 22
    churn_w: 6.48
    fixes: 9
    authors: 19
    owner_share: 0.14
    fan_in: 7
    tests: 3
    score: 4005
  - path: lib/request.js
    kind: source
    loc: 376
    churn: 49
    churn_w: 18.22
    fixes: 14
    authors: 31
    owner_share: 0.12
    fan_in: 3
    tests: 12
    score: 3539
  - path: lib/contentTypeParser.js
    kind: source
    loc: 409
    churn: 48
    churn_w: 16.34
    fixes: 22
    authors: 27
    owner_share: 0.17
    fan_in: 2
    tests: 1
    score: 2616
  - path: lib/error-handler.js
    kind: source
    loc: 176
    churn: 14
    churn_w: 5.44
    fixes: 11
    authors: 11
    owner_share: 0.21
    fan_in: 4
    tests: 0
    score: 2345
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 42
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 30
    coupling: 67
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 27
    coupling: 54
  - files: [types/hooks.d.ts, types/route.d.ts]
    count: 19
    coupling: 42
  - files: [lib/reply.js, lib/request.js]
    count: 19
    coupling: 39
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 18
    coupling: 55
  - files: [lib/route.js, lib/symbols.js]
    count: 17
    coupling: 61
  - files: [fastify.d.ts, types/route.d.ts]
    count: 17
    coupling: 34
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 38
  - files: [types/request.d.ts, types/route.d.ts]
    count: 15
    coupling: 37
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the framework core at the repository root and in `lib/`: instance construction and the public server API (`fastify.js`), the request/reply lifecycle (`lib/reply.js`, `lib/request.js`), the hook runners (`lib/hooks.js`), body parsing (`lib/contentTypeParser.js`), and two shared contracts every module imports — `lib/errors.js` and `lib/symbols.js`. Five files hold half the total score, so most edits land in a small, heavily depended-upon set. Bug fixes cluster in `fastify.js` (54 fixes of 212 commits), `lib/route.js` (45 of 98) and `lib/reply.js` (37 of 88); `lib/contentTypeParser.js` is the densest at 22 fixes in 48 commits. There are no files with high fan-in and zero churn, so nothing here is a frozen floor — the widely imported files are also actively edited. With 617 committer identities and owner shares mostly under 0.20, these files have no single owner; `fastify.js` is the exception at 0.45. Nine generated or lock files sit outside the analysis, and one credential-shaped path is excluded from every list.

## Why these files are hot

`fastify.js` builds the instance: it validates every server option, wires the router, content-type parser, schema controller, error handler and 404 handler onto a symbol-keyed object, and exposes the public API (route shorthands, `addHook`, `register`, `ready`, `listen`, `inject`). It changes because every new option or public method lands here, and 54 of its 212 commits were fixes. Its dependents are few (5) but its consumers are everyone, so an edit here breaks option validation, boot ordering or plugin encapsulation. It is the best-covered file in the repo with 61 test files. Before editing this file, run the test files matching the surface you touch (`test/async-dispose.test.js` for shutdown, `test/custom-parser.*.test.js` for parser wiring, `test/body-limit.test.js` for option handling) and preserve the option-defaulting order: `getSecuredInitialConfig(options)` must see the fixed values.

`lib/errors.js` is a flat table of `FST_ERR_*` codes built with `@fastify/error`, imported by 16 files. Each entry fixes a code string, a message template with its `%s` slots, a status code and an error class — all of that is public API. It changes whenever a new failure path needs a code, and its owner share of 0.07 shows the edits come from everywhere. Renaming a code, reordering format arguments or changing a status silently breaks callers and user error handling. Before editing this file, add codes rather than repurposing them, keep the message placeholders aligned with every call site, and run `test/internals/errors.test.js` together with the test for the module that throws the code.

`lib/reply.js` owns response state: headers, trailers, status codes, serializer compilation and caching, stream and `Response` handling, and the `onSend`/`preSerialization`/`onError`/`onResponse` hook ends. At 948 lines with 37 fixes in 88 commits it is the most fix-dense large file, mostly around payload type detection and content-type inference in `send`. Only three files import it, but every response passes through it, so an edit tends to break content-type defaults or stream teardown. Before editing this file, run `test/diagnostics-channel/*.test.js` alongside the reply tests, and keep `send` returning `this` on every branch so chained replies and hijacking continue to work.

`lib/symbols.js` is 65 lines of `Symbol()` keys and the widest dependency in the repo at fan-in 17, reached by 24 test files. It churns because each new piece of internal state needs a key, and 13 of its 28 commits were fixes. A removed or renamed key breaks at runtime rather than at import, and plugins reaching for internals break silently. Before editing this file, add keys without removing existing ones, and grep for the key name across `lib/` and `test/` before changing it, since the symbol name is never inferred.

`lib/hooks.js` defines the supported hook names and every runner: the application runner that walks children through avvio, the generated lifecycle runners, and the special-cased `onSend`, `preParsing` and `onRequestAbort` loops. It changes when a hook is added or its error semantics shift, and only 3 test files cover it directly. Errors here surface as hooks silently skipped or `done` called twice. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and check `fastify.js`'s `addHook` arity validation, which encodes each hook's expected signature separately.

## Change coupling

`fastify.js` and `lib/route.js` share 42 commits (43%), and `lib/route.js` and `lib/symbols.js` share 17 (61%). This is by design: `fastify.js` calls `buildRouting` and passes the router config, while route stores are keyed by symbols. Note that `lib/route.js` has 0 covering test files despite 45 fixes. When changing route options or the route store, open all three and verify behavior through the route tests in `test/route.*.test.js` rather than a unit test of `lib/route.js`.

The `types/` declarations move as one cluster: `types/hooks.d.ts` with `types/instance.d.ts` at 67%, `instance` with `route` at 54%, `hooks` with `route` at 42%, and `request`/`route` at 37%. The generics thread through all of them, so a signature added in one leaves the others inconsistent. When you change any hook, route or instance type, update the matching declarations in the same commit and run the type tests.

`lib/reply.js` and `lib/request.js` share 19 commits (39%) — expected, since `Reply` reads `this.request[kRouteContext]` and both are built per request. When changing one, check the other's use of the shared route context.

Two doc pairs are contract coupling, not decay: `docs/Reference/Errors.md` with `lib/errors.js` (55%) and `docs/Reference/Reply.md` with `lib/reply.js` (38%). Update the matching doc page in the same commit as the code change.

## What to read first

1. `lib/symbols.js` — the vocabulary of every internal property; nothing in `lib/` reads without it.
2. `lib/errors.js` — the public error contract used by 16 files.
3. `fastify.js` — how an instance is assembled and what the public API actually is.
4. `lib/hooks.js` — the lifecycle order that `fastify.js` and `lib/reply.js` both drive.
5. `lib/route.js` — route construction and the store; coupled to `fastify.js` and untested directly.
6. `lib/reply.js` — response state and serialization, the widest blast radius per line.
7. `types/instance.d.ts` — the typed mirror of the public API, kept in step with the other `types/` files.
