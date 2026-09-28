---
complex_md: "0.3"
generated: 2025-07-16
commit: 95292098
tool: complex-md/bench
window_commits: 2000
files_analyzed: 47
profile:
  files_total: 386
  files_in_scope: 47
  loc_in_scope: 9612
  kinds: "test 223, docs 52, source 46, ci 27, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 30, ts 16, json 1"
  dependency_edges: 349
  commits_total: 4068
  commits_analyzed: 1799
  commits_skipped: 201
  half_life_commits: 500
  window_from: 2020-08-11
  window_to: 2025-07-16
  velocity_30d: 33.3
  authors_total: 593
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 958
    churn: 210
    churn_w: 62.85
    fixes: 52
    authors: 67
    owner_share: 0.46
    fan_in: 5
    tests: 62
    score: 10655
  - path: lib/errors.js
    kind: source
    loc: 500
    churn: 43
    churn_w: 13.91
    fixes: 17
    authors: 34
    owner_share: 0.07
    fan_in: 16
    tests: 10
    score: 9505
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 86
    churn_w: 23.13
    fixes: 36
    authors: 47
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4698
  - path: lib/symbols.js
    kind: source
    loc: 66
    churn: 27
    churn_w: 6.27
    fixes: 12
    authors: 14
    owner_share: 0.15
    fan_in: 18
    tests: 25
    score: 4645
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 19
    churn_w: 5.40
    fixes: 8
    authors: 16
    owner_share: 0.16
    fan_in: 7
    tests: 3
    score: 3678
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 46
    churn_w: 16.34
    fixes: 15
    authors: 29
    owner_share: 0.13
    fan_in: 3
    tests: 12
    score: 3377
  - path: lib/warnings.js
    kind: source
    loc: 47
    churn: 36
    churn_w: 14.85
    fixes: 10
    authors: 22
    owner_share: 0.17
    fan_in: 4
    tests: 2
    score: 2543
  - path: lib/contentTypeParser.js
    kind: source
    loc: 409
    churn: 44
    churn_w: 13.82
    fixes: 20
    authors: 25
    owner_share: 0.18
    fan_in: 2
    tests: 1
    score: 2410
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 38
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 22
    coupling: 59
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 22
    coupling: 51
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 19
    coupling: 56
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 39
  - files: [lib/route.js, lib/symbols.js]
    count: 16
    coupling: 59
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 36
  - files: [fastify.js, lib/server.js]
    count: 15
    coupling: 36
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 35
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: instance construction and the public API surface in `fastify.js`, the reply pipeline in `lib/reply.js`, the request object in `lib/request.js`, and body parsing in `lib/contentTypeParser.js`. Five files hold half the total score, and all of them are in the root or `lib/`. Bug fixes land hardest in `fastify.js` (52 fixes of 210 commits), `lib/reply.js` (36 of 86) and `lib/contentTypeParser.js` (20 of 44) — the last means nearly half of all parser changes were repairs. Two small files carry outsized structural weight: `lib/symbols.js` (66 lines, 18 dependents) and `lib/errors.js` (500 lines, 16 dependents) are the shared vocabulary that almost every other module imports. With 593 committers and no file above a 0.46 owner share except `fastify.js`, there is no single maintainer to defer to; the tests are the authority. The analysis excludes 9 generated or lock files.

## Why these files are hot

`fastify.js` builds the instance: it validates every server option, wires the router, reply, request, hooks, content type parser and schema controller onto one object, and exposes the entire public API including the route shorthands, `register`, `addHook`, `setErrorHandler` and `inject`. It changes because every new server option or lifecycle feature lands here, and a quarter of its commits were fixes. Anything on the instance is public surface, so an edit here tends to break plugins rather than internal callers. Before editing this file, run the covering tests under `test/` that match the area you touched (`test/custom-parser.*.test.js` for parsing, `test/async-dispose.test.js` for shutdown) and open `lib/route.js` alongside it.

`lib/errors.js` is a flat registry of `FST_ERR_*` codes built with `@fastify/error`, imported by 16 files and re-exported as `fastify.errorCodes`. Codes, messages and status codes are public contract; renaming or changing a status is a breaking change for users matching on `err.code`. It changes whenever a new failure mode is added elsewhere. Before editing this file, add codes rather than altering existing ones, and update `docs/Reference/Errors.md` in the same commit.

`lib/reply.js` owns serialization and the response path: header and trailer handling, status codes, the `preSerialization`/`onSend`/`onResponse` hook runners, stream and web-stream sending. Thirty-six of its 86 commits were fixes, mostly around content type inference, stream teardown and premature close. Its dependents are few but central (`fastify.js`, `lib/fourOhFour.js`, `lib/pluginOverride.js`); breakage shows up as wrong headers or hung responses rather than as import errors. Before editing this file, run `test/diagnostics-channel/*.test.js` and preserve the invariant that `send` returns `this` on every branch.

`lib/symbols.js` is 66 lines of `Symbol()` keys and the most depended-on file in the repo (18 dependents, 25 tests reaching it). It changes when internal state moves between modules — 12 of 27 commits were fixes, which for a key list means keys added or removed to repair a leak of state across an encapsulation boundary. A removed or renamed key breaks silently: the reader gets `undefined` instead of a crash. Before editing this file, grep the whole tree for the key name and confirm every read and write site moves together.

`lib/hooks.js` defines the supported hook names and every runner that walks them, including the async/callback duality and the child-instance recursion in `hookRunnerApplication`. It is quieter than the others (19 commits, 8 fixes) but 7 files depend on it and only 3 test files cover it directly, so most of its behavior is exercised indirectly. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and keep the rule that a runner calls `cb` exactly once on every path.

## Change coupling

`fastify.js` and `lib/route.js` share 38 commits (43%), and `lib/route.js` has 42 fixes with no direct test file of its own. The instance holds the route shorthands while `buildRouting` holds the implementation; this coupling is by design but unprotected. When you change either, open both and verify against `test/route.*.test.js`.

The `types/` files move as a block: `types/hooks.d.ts` with `types/instance.d.ts` at 59%, `types/instance.d.ts` with `types/route.d.ts` at 51%. Declarations mirror runtime shape and must be edited together. When you add an option, a hook or a route property in `lib/`, update the matching `types/*.d.ts` in the same commit and run the type tests.

Docs track code closely: `docs/Reference/Errors.md` with `lib/errors.js` at 56%, `docs/Reference/Reply.md` with `lib/reply.js` at 36%. These are reference docs for public surface. Change the doc in the same commit as the code.

`lib/route.js` with `lib/symbols.js` (59%) and `fastify.js` with `lib/symbols.js` (52%) show new internal state being threaded through the symbol list. This is the encapsulation mechanism working as intended. When adding a key, place the read, the write and the child-instance copy in one change.

`lib/reply.js` and `lib/request.js` share 18 commits (39%) — they are two halves of one per-request pair, and `lib/reply.js` reaches into `request[kRouteContext]`. Check the other side whenever you change route-context access.

## What to read first

1. `lib/symbols.js` — 66 lines, the key vocabulary every other module uses; read it before anything else.
2. `lib/errors.js` — the public error contract and the names you will see thrown everywhere.
3. `fastify.js` — instance construction and the full public API; the top of the file shows how the parts compose.
4. `lib/hooks.js` — the lifecycle names and runner conventions that `reply.js`, `route.js` and `fastify.js` all obey.
5. `lib/reply.js` — the response path, where serialization and content type decisions are made.
6. `lib/route.js` — routing implementation, 42 fixes and no direct test file; read before touching route options.
7. `types/instance.d.ts` — the declared shape of the instance, the mirror you must keep in sync.
