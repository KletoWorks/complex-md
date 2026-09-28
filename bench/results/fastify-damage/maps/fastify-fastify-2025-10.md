---
complex_md: "0.3"
generated: 2025-10-06
commit: 387b1689
tool: complex-md/bench
window_commits: 2000
files_analyzed: 47
profile:
  files_total: 384
  files_in_scope: 47
  loc_in_scope: 9756
  kinds: "test 223, docs 52, source 46, ci 25, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 30, ts 16, json 1"
  dependency_edges: 353
  commits_total: 4119
  commits_analyzed: 1779
  commits_skipped: 221
  half_life_commits: 500
  window_from: 2020-09-15
  window_to: 2025-10-06
  velocity_30d: 32.5
  authors_total: 597
  concentration_50: 4
  hotspot_cut: 6
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 973
    churn: 215
    churn_w: 65.21
    fixes: 52
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 62
    score: 12285
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 44
    churn_w: 13.90
    fixes: 18
    authors: 34
    owner_share: 0.09
    fan_in: 16
    tests: 10
    score: 9602
  - path: lib/symbols.js
    kind: source
    loc: 67
    churn: 27
    churn_w: 6.76
    fixes: 12
    authors: 14
    owner_share: 0.15
    fan_in: 18
    tests: 26
    score: 4917
  - path: lib/reply.js
    kind: source
    loc: 942
    churn: 88
    churn_w: 24.40
    fixes: 36
    authors: 46
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4816
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 5.10
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3579
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 44
    churn_w: 15.10
    fixes: 14
    authors: 27
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3249
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 22
    coupling: 63
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 21
    coupling: 51
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 20
    coupling: 57
  - files: [lib/reply.js, lib/request.js]
    count: 17
    coupling: 39
  - files: [fastify.js, lib/server.js]
    count: 17
    coupling: 37
  - files: [lib/route.js, lib/symbols.js]
    count: 15
    coupling: 56
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 34
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in three kinds of code: the instance factory that assembles the public API (`fastify.js`), the per-request objects and their lifecycle (`lib/reply.js`, `lib/request.js`, `lib/hooks.js`), and the shared vocabulary everything else imports (`lib/errors.js`, `lib/symbols.js`). Bug fixes land mostly in `fastify.js` (52 fixes of 215 commits), `lib/route.js` (42 of 91) and `lib/reply.js` (36 of 88) — the boot/routing path and the send path are where mistakes surface. No file qualifies as load-bearing-and-untouched: the most depended-on files, `lib/symbols.js` (fan_in 18) and `lib/errors.js` (fan_in 16), are edited regularly, so their dependents move with them. Ownership is diffuse — 597 committer identities, and every hotspot except one sits at or below 0.20 owner_share; `fastify.js` is the exception at 0.46 across 67 authors, so one maintainer holds the boot sequence and the rest of the surface has no single reviewer. Two files carry high fix counts with no tests reaching them at all: `lib/route.js` and `lib/error-handler.js`.

## Why these files are hot

`fastify.js` builds the instance object literal: state symbols, route shorthands, decorators, hooks, content-type parsers, Avvio wiring, `inject`, `listen` and close. It changes because every new public method or server option is added here, and 52 of its commits were fixes, largely in option processing and the ready/close state machine. Six files import it, including `lib/route.js` and three `.d.ts` files, so a signature change propagates into the type surface. Before editing this file, run the test files that cover it (`test/async-dispose.test.js`, `test/body-limit.test.js`, `test/custom-parser.*.test.js` — 62 test files reach it) and open `lib/route.js` and `lib/server.js`, which move with it.

`lib/errors.js` is the `FST_ERR_*` code table built with `@fastify/error`, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. Sixteen files import it, so it is the widest dependency in the repo; its churn is additive — new codes for new validation paths — but 18 of 44 commits were fixes, usually to message strings and status codes that users assert on. Before editing this file, treat every code name, message placeholder and status as public API, run `test/internals/errors.test.js`, and update `docs/Reference/Errors.md` in the same commit.

`lib/symbols.js` is 67 lines of `Symbol()` keys and nothing else, imported by 18 files. It is hot because it is the shared state contract: any new internal field on an instance, request, reply or route context gets a key here first. Twelve of its 27 commits were fixes, which for a key table means renames and mis-scoped state. Before editing this file, grep for the symbol you are changing across `lib/` — the 26 test files that reach it will not catch a key added but never read.

`lib/reply.js` owns the send path: header and trailer handling, status codes, serializer compilation and caching, stream and `Response` sending, and the `onSend`/`preSerialization`/`onError`/`onResponse` hook calls. Of 88 commits, 36 were fixes — content-type negotiation, stream teardown and already-sent detection are the recurring sources. Only three files import it, but every route response flows through it. Before editing this file, run the `test/diagnostics-channel/*.test.js` suite that covers it and preserve the invariant that `send` returns `this` and calls exactly one terminal path per reply.

`lib/hooks.js` defines the supported hook names and the runners: `hookRunnerApplication`, `onListenHookRunner`, `hookRunnerGenerator` and the specialized `onSend`/`preParsing`/`onRequestAbort` variants. It changes when a hook is added or its argument shape moves; only 8 of 20 commits were fixes, and it is the calmest of the hotspots. Seven files depend on it, and each runner has a distinct callback arity, so a change to one runner silently breaks its callers. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and check that `supportedHooks` still matches the validation branches in `addHook` in `fastify.js`.

## Change coupling

`fastify.js` moves with `lib/route.js` (43%) and `lib/server.js` (37%), and `lib/route.js` moves with `lib/symbols.js` (56%). This is by design: the factory holds the shorthand methods, the router holds route construction, and the context symbols are the handoff between them. When you change a route option or a shorthand, open all three and confirm the symbol is both written and read; `lib/route.js` has no tests reaching it, so verify through the route tests under `test/route.*.test.js`.

The type declarations form a tight triangle: `types/hooks.d.ts` with `types/instance.d.ts` (63%) and `types/instance.d.ts` with `types/route.d.ts` (51%). The declarations are one surface split across files. When you add a hook or route option in JavaScript, update all three declarations in the same commit and run the type tests.

Documentation tracks the code contract closely: `lib/warnings.js` with `docs/Reference/Warnings.md` (82%), `lib/errors.js` with `docs/Reference/Errors.md` (57%), `lib/reply.js` with `docs/Reference/Reply.md` (34%). Codes and warning identifiers are user-visible. When you add or reword a code, edit the matching reference page in the same commit.

`lib/reply.js` and `lib/request.js` co-change at 39% because both are per-request objects sharing `kRouteContext` and the schema symbols. When you touch one, check whether the other reads the same symbol before adding a parallel field.

## What to read first

1. `lib/symbols.js` — the shared state vocabulary; nothing in `lib/` reads correctly without it.
2. `lib/errors.js` — the error code table sixteen files import, and the public contract you must not reword casually.
3. `fastify.js` — the instance object literal and boot sequence; the shape of the public API in one place.
4. `lib/hooks.js` — the hook names and runner arities that the request lifecycle is built from.
5. `lib/reply.js` — the send path, where serialization, streams and hooks meet and most response bugs live.
6. `lib/route.js` — route construction, 42 fixes and no direct test coverage, so read it before changing routing.
