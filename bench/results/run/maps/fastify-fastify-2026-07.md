---
complex_md: "0.3"
generated: 2026-07-30
commit: b93d611c
tool: complex-md/bench
window_commits: 2000
files_analyzed: 50
profile:
  files_total: 395
  files_in_scope: 50
  loc_in_scope: 11311
  kinds: "test 231, docs 52, source 50, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 383
  commits_total: 4371
  commits_analyzed: 1859
  commits_skipped: 141
  half_life_commits: 500
  window_from: 2021-04-08
  window_to: 2026-07-30
  velocity_30d: 30.9
  authors_total: 596
  concentration_50: 5
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1019
    churn: 222
    churn_w: 66.53
    fixes: 51
    authors: 66
    owner_share: 0.45
    fan_in: 7
    tests: 63
    score: 13821
  - path: lib/errors.js
    kind: source
    loc: 548
    churn: 47
    churn_w: 15.81
    fixes: 19
    authors: 33
    owner_share: 0.11
    fan_in: 17
    tests: 10
    score: 10837
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 28
    churn_w: 8.12
    fixes: 11
    authors: 15
    owner_share: 0.14
    fan_in: 21
    tests: 29
    score: 5959
  - path: lib/reply.js
    kind: source
    loc: 1076
    churn: 93
    churn_w: 29.32
    fixes: 38
    authors: 46
    owner_share: 0.19
    fan_in: 3
    tests: 14
    score: 5441
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 50
    churn_w: 19.96
    fixes: 22
    authors: 27
    owner_share: 0.16
    fan_in: 3
    tests: 15
    score: 3963
  - path: lib/hooks.js
    kind: source
    loc: 433
    churn: 18
    churn_w: 4.44
    fixes: 8
    authors: 15
    owner_share: 0.17
    fan_in: 7
    tests: 3
    score: 3454
  - path: lib/warnings.js
    kind: source
    loc: 75
    churn: 37
    churn_w: 13.66
    fixes: 11
    authors: 21
    owner_share: 0.16
    fan_in: 5
    tests: 2
    score: 3258
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
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [fastify.js, lib/errors.js]
    count: 17
    coupling: 36
  - files: [lib/errors.js, types/errors.d.ts]
    count: 16
    coupling: 94
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 16
    coupling: 70
  - files: [docs/Reference/Errors.md, types/errors.d.ts]
    count: 15
    coupling: 88
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 15
    coupling: 58
seams:
blind_spots:
  - "9 generated or lock files excluded"
---

## Where the risk lives

Risk concentrates in the request lifecycle and the instance's public surface: `fastify.js` assembles the server object and its option validation, `lib/reply.js` and `lib/request.js` own serialization and the per-request accessors, and `lib/errors.js` plus `lib/symbols.js` are the shared vocabulary everything else imports. Five files hold half the total score, so most edits land in the same small set. Bug fixes cluster in `fastify.js` (51 fixes of 222 commits), `lib/reply.js` (38 of 93) and `lib/request.js` (22 of 50) — the send path and the option surface are where correctness keeps slipping. There are no untouched load-bearing files; instead the widest dependency fan-ins are themselves hot, with `lib/symbols.js` reached by 21 files and `lib/errors.js` by 17. Ownership is diffuse across 596 committers and no file except `fastify.js` (owner share 0.45) has a dominant author, so conventions live in the code and the docs rather than in a maintainer's head.

## Why these files are hot

`fastify.js` builds the instance: the symbol-keyed internal state, every route shorthand, the decorator and hook entry points, `inject`, `ready`, and `processOptions`. It changes because every new server option, HTTP method or lifecycle tweak passes through it, and 51 of its commits were fixes. Seven files depend on it, including `types/instance.d.ts`, so a signature change there breaks the published types as well as `lib/route.js`. Before editing this file, open `lib/route.js` alongside it — the two change together in 45% of route-related commits — and run the covering tests, which include `test/body-limit.test.js`, `test/constrained-routes.test.js` and `test/async-dispose.test.js`.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, each carrying a message template, status code and error class. It is hot because every feature adds or reworords a code, and 19 of its 47 commits were fixes — usually a wrong status or a message argument mismatch. Seventeen files import from it, and consumers match on the code string, so renaming a code or reordering `%s` placeholders is a breaking change. Before editing this file, update `types/errors.d.ts` and `docs/Reference/Errors.md` in the same commit, then run `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` keys naming every internal slot on the instance, request and reply. Nothing computes here, yet 21 files read it and 29 test files reach it, which is why 11 of its 28 commits were fixes: a symbol added in one place and consumed in another drifts easily. Before editing this file, grep for the symbol name across `lib/` and `test/` before removing or renaming one, and add new keys in the section matching their owner rather than at the end.

`lib/reply.js` owns the response contract: header and trailer handling, status code validation, schema serialization caching, the `onSend`/`preSerialization` hook runs, and the stream, web-stream and HTTP/2 write paths. Its 38 fixes out of 93 commits concentrate in those send paths, where premature-close and headers-sent races are the recurring bug. It reads about two dozen symbols and drives `handleError`, so an edit that changes when `onSendHook` fires perturbs error handling too. Before editing this file, preserve the invariant that every send path terminates in exactly one `onSendEnd`, and run the `test/diagnostics-channel/*.test.js` suite, which covers the lifecycle end to end.

`lib/request.js` builds the per-request object, including the trust-proxy variants of `ip`, `host` and `protocol`, the `routeOptions` snapshot, the lazy `AbortController` on `signal`, and the validation compile cache. Its 22 fixes out of 50 commits mostly concern proxy header parsing and host fallbacks. `lib/reply.js` reads its symbols directly and the two move together in 40% of commits. Before editing this file, check whether the same property exists on both `buildRegularRequest` and `buildRequestWithTrustProxy`, since adding to one and not the other is the classic defect here.

## Change coupling

`lib/errors.js` and `types/errors.d.ts` co-change at 94%, and `docs/Reference/Errors.md` at 88% and 60% respectively: this is a three-way contract by design, one code declared in three places. Add or change a code in all three in one commit.

`docs/Reference/Warnings.md` tracks `lib/warnings.js` at 70%. Warning codes are user-facing and the doc is the only place their meaning is written. When you add an `FSTWRN`/`FSTDEP` code, add its row to the doc.

`fastify.js` couples to `lib/route.js` (45%) and `lib/server.js` (39%). Routing and server creation are configured from `processOptions` but implemented elsewhere, so options leak across the boundary. When you add a server option, check whether it belongs in `buildRouterOptions` or `createServer` rather than widening the object literal in `fastify.js`.

`types/hooks.d.ts` and `types/instance.d.ts` co-change at 58% because the instance type re-exports every hook overload. When you add a hook, add its overload in both.

## What to read first

1. `lib/symbols.js` — the names of every internal slot; nothing else is readable without it.
2. `fastify.js` — the instance literal shows the whole public surface and which module owns each piece.
3. `lib/errors.js` — the error vocabulary that 17 modules throw.
4. `lib/reply.js` — the response lifecycle, and the densest concentration of fixes after `fastify.js`.
5. `lib/request.js` — the request object and its two build paths.
6. `lib/hooks.js` — the hook runners that `lib/reply.js` and `fastify.js` both drive.
7. `docs/Reference/Errors.md` — the published meaning of the codes you may be tempted to change.
