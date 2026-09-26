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

Risk concentrates in the instance factory and the per-request lifecycle: `fastify.js` assembles the public server object, and `lib/reply.js`, `lib/request.js` and `lib/hooks.js` carry the request/response state machine. A second cluster is contract surface rather than logic — `lib/errors.js` and `lib/symbols.js` are declaration tables that almost every other file imports, so a rename there is a break everywhere. Bug fixes land in `fastify.js` (51 fixes over 222 commits), `lib/route.js` (40 fixes over 89 commits) and `lib/reply.js` (38 fixes over 93 commits); together those three are where behavioral regressions have historically been discovered. Five files hold half the total score, so the blast radius of a careless edit is narrow but deep. There are no load-bearing untouched files: every high fan-in file here is also actively edited. With 596 committer identities and low owner shares outside `fastify.js` (0.45), this is drive-by contribution territory — no single person's mental model covers a file, so the tests are the specification. Nine generated or lock files are outside the map.

## Why these files are hot

`fastify.js` builds the instance: symbol-keyed internal state, the shorthand route methods, the Avvio boot wiring, `inject`, `setErrorHandler`, `addHook` and option normalization in `processOptions`. It changes because every new server option, hook name or HTTP method lands here, and 51 of its 222 commits were fixes. Seven files depend on it, including `types/instance.d.ts`, so adding a public method without a type breaks consumers. Before editing this file, open `lib/route.js` alongside it (they change together in 45% of commits) and run the option and lifecycle suites under `test/` that cover it, such as `test/async-dispose.test.js` and `test/custom-parser.*.test.js`.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, each carrying a code, a message template with `%s` slots, a status code and an error class. Seventeen files import it, and `test/internals/errors.test.js` asserts the table itself. The codes and their status codes are public API: changing a message template, a status or a name is a breaking change for users matching on `err.code`. Before editing this file, add codes rather than renaming or renumbering them, and update `types/errors.d.ts` and `docs/Reference/Errors.md` in the same commit.

`lib/symbols.js` is 73 lines of `Symbol()` declarations and the most depended-on file in the repo (fan_in 21, 29 tests reach it). It is pure declaration, yet 11 of its 28 commits were fixes — the fixes are elsewhere and symbol churn follows them. Removing or renaming a key silently yields `undefined` at every read site instead of a type error. Before editing this file, grep the whole tree for the symbol name to find every reader and writer before you change or delete it.

`lib/reply.js` implements serialization and the send path: content-type negotiation, header and trailer handling, stream and web-stream sending, hijacking, and the `onSend`/`preSerialization`/`onResponse` hook runners. It is the largest file at 1076 lines with 38 fixes in 93 commits — edge cases in HTTP semantics are where the bugs are. Before editing this file, run the `test/diagnostics-channel/*.test.js` suites plus the reply and stream tests, and check `lib/request.js`, which it moves with 40% of the time.

`lib/request.js` defines the request object and its lazily built prototypes — `buildRegularRequest` versus `buildRequestWithTrustProxy` — plus `ip`, `host`, `protocol`, `signal`, and the validation-compilation cache. Its getters are hot-path code shaped for performance, and 22 of 50 commits were fixes. Before editing this file, preserve the two-variant prototype construction (the trust-proxy path defines its own getters and sets `kHasBeenDecorated`) and verify against the same diagnostics-channel and request tests.

## Change coupling

`fastify.js` and `lib/route.js` (45%, 40 commits) is coupling by design: `buildRouting` returns the `prepareRoute` and `route` functions the instance exposes, and route options flow through `processOptions`. When you add or change a route option, change both and check `types/route.d.ts`.

`lib/errors.js` and `types/errors.d.ts` (94%) and `docs/Reference/Errors.md` (60% and 88%) form a three-way contract the project maintains by hand. That is the strongest coupling in the repository. Add a code in all three files in the same commit. The same pattern holds for `lib/warnings.js` and `docs/Reference/Warnings.md` (70%): a new `FSTDEP`/`FSTWRN` code needs its documentation entry.

`lib/reply.js` and `lib/request.js` (40%) move together because the reply reads request state through `kRouteContext`, `kRequestSignal` and `kTimeoutTimer`. When you touch lifecycle or timeout state on one side, check the other's cleanup path — `Reply.prototype.hijack` clears timers owned by the request.

`types/hooks.d.ts` and `types/instance.d.ts` (58%) leak into each other because hook signatures are re-declared on the instance. When adding a hook, update both, and confirm the runtime name exists in `supportedHooks` in `lib/hooks.js`.

## What to read first

1. `lib/symbols.js` — the vocabulary for all internal state; nothing else reads clearly without it.
2. `fastify.js` — the instance shape, which options exist, and how the parts are wired together.
3. `lib/errors.js` — the error contract you must not break, and the naming conventions for new codes.
4. `lib/route.js` — route registration and context construction, the partner to every `fastify.js` change.
5. `lib/hooks.js` — `supportedHooks` and the hook runners that `lib/reply.js` calls into.
6. `lib/reply.js` and `lib/request.js` — the request lifecycle, read as a pair.
7. `docs/Reference/Errors.md` and `docs/Reference/Warnings.md` — the documented half of the contracts that co-change hardest.
