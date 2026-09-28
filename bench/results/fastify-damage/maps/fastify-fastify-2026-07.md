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
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the instance factory and the request lifecycle: `fastify.js` assembles the public API and the internal symbol state, and `lib/reply.js` and `lib/request.js` implement serialization, header handling and the per-request objects. Five files hold half the total score, and the two widest internal contracts are `lib/errors.js` (fan-in 17) and `lib/symbols.js` (fan-in 21) — small files whose shape most of `lib/` reads. Bug fixes land in `fastify.js` (51 fixes of 222 commits), `lib/route.js` (40 of 89) and `lib/reply.js` (38 of 93); route building and reply sending are where behaviour is most often wrong. The TypeScript surface in `types/` and `fastify.d.ts` churns hard but has no measured dependents, so breakage there shows up only in type tests. No load-bearing files were found: everything with wide fan-in was also touched in the window. Ownership is diffuse — 596 committer identities, and every hotspot except `fastify.js` (owner_share 0.45) sits under 0.20, so no one file has a single reviewer to defer to.

## Why these files are hot

`fastify.js` is the factory: it builds the router, the 404 router, the HTTP server, and the instance object carrying ~30 symbol-keyed slots plus the whole public method surface. It changes on almost every feature because new options, hooks and route methods all have to be threaded through `processOptions` and the instance literal. 63 test files reach it, including `test/custom-parser.*.test.js` and `test/body-limit.test.js`. Before editing this file, run the covering tests for the area you touched and confirm any new symbol slot is declared in `lib/symbols.js` and copied by `lib/plugin-override.js`, or encapsulated child instances will silently lose it.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, imported by 17 files. It changes whenever a validation path needs a new code, and 19 of its 47 commits were fixes — mostly message and status-code corrections. Error codes are public API: renaming one, changing a status, or altering a `%s` placeholder count breaks users. Before editing this file, open `types/errors.d.ts` and `docs/Reference/Errors.md` in the same change and run `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` declarations and the most depended-on file here (fan-in 21), reached by 29 test files. It churns because every new internal piece of state needs a key, and 11 of its 28 commits were fixes. Nothing validates that a symbol is consumed where it is set. Before editing this file, add keys rather than renaming or removing them, and grep the repo for the old name to find every reader.

`lib/reply.js` owns everything after the handler returns: content-type inference, serializer compilation and caching, trailers, streams, web streams, and `hijack`. It is the second largest file in scope and 38 of its 93 commits were fixes, which matches how much of it is protocol edge cases (HTTP/2 chunking, aborted requests, `ERR_HTTP_HEADERS_SENT`). Its dependents are few, but every route response flows through it. Before editing this file, run `test/diagnostics-channel/*.test.js` and check that the `onSend` / `preSerialization` hook ordering and the `sent` / `hijacked` invariants still hold.

`lib/request.js` builds the per-request object, with two constructor variants — one plain, one with trust-proxy getters for `ip`, `host` and `protocol` — plus validation-function compilation and caching. Its 22 fixes cluster on header parsing and proxy semantics. The prototype is rebuilt per instance, so decorators and getters interact. Before editing this file, keep the plain and trust-proxy builders in step and run the request tests alongside `lib/reply.js`'s, since the two move together.

## Change coupling

`fastify.js` and `lib/route.js` share 40 commits (45%): route option handling is split between the factory's shorthand methods and `buildRouting`. This is by design but thinly documented, and `lib/route.js` has no covering tests. When you change one, open the other and verify the option reaches `prepareRoute`.

`lib/errors.js`, `types/errors.d.ts` and `docs/Reference/Errors.md` move as one cluster (94% and 88% coupling). Three hand-maintained copies of the same list is decay, not design. Add or change a code in all three in a single commit, and prefer generating the docs table from the registry over widening the drift.

`lib/warnings.js` and `docs/Reference/Warnings.md` couple at 70%, the same pattern one file smaller: update the doc entry in the commit that adds the `FSTWRN`/`FSTDEP` code.

`lib/reply.js` and `lib/request.js` share 20 commits (40%) because both read `lib/symbols.js` and `lib/decorate.js` for the same per-request state. Check both when you change a shared symbol or a decorator assertion.

`types/hooks.d.ts` and `types/instance.d.ts` couple at 58%: a hook signature change has to be re-declared on the instance. Change both and run the type tests.

## What to read first

1. `lib/symbols.js` — the vocabulary of internal state; every other file is unreadable without it.
2. `fastify.js` — the instance literal shows what the framework is and which module owns each concern.
3. `lib/errors.js` — the public error contract, and the file most changes have to touch.
4. `lib/route.js` — where routes are actually built; highest fix ratio of any file and no tests of its own.
5. `lib/reply.js` — the response path, including serialization and stream edge cases.
6. `lib/request.js` — the request object and trust-proxy behaviour.
7. `lib/hooks.js` — hook names and runners, which constrain what `lib/reply.js` may reorder.
