---
complex_md: "0.3"
generated: 2026-08-20
commit: 83e69762
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 394
  files_in_scope: 49
  loc_in_scope: 11213
  kinds: "test 231, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 33, ts 16"
  dependency_edges: 372
  commits_total: 4422
  commits_analyzed: 1871
  commits_skipped: 129
  half_life_commits: 500
  window_from: 2021-05-22
  window_to: 2026-08-20
  velocity_30d: 31.3
  authors_total: 592
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1009
    churn: 234
    churn_w: 75.91
    fixes: 53
    authors: 66
    owner_share: 0.44
    fan_in: 7
    tests: 63
    score: 14718
  - path: lib/errors.js
    kind: source
    loc: 554
    churn: 46
    churn_w: 16.06
    fixes: 18
    authors: 31
    owner_share: 0.11
    fan_in: 17
    tests: 10
    score: 10852
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 26
    churn_w: 7.45
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 20
    tests: 28
    score: 5588
  - path: lib/reply.js
    kind: source
    loc: 1090
    churn: 88
    churn_w: 29.76
    fixes: 38
    authors: 45
    owner_share: 0.19
    fan_in: 3
    tests: 14
    score: 5520
  - path: lib/request.js
    kind: source
    loc: 398
    churn: 49
    churn_w: 19.48
    fixes: 23
    authors: 25
    owner_share: 0.18
    fan_in: 3
    tests: 15
    score: 3938
  - path: lib/hooks.js
    kind: source
    loc: 433
    churn: 18
    churn_w: 4.14
    fixes: 8
    authors: 15
    owner_share: 0.17
    fan_in: 7
    tests: 3
    score: 3345
  - path: lib/content-type.js
    kind: source
    loc: 214
    churn: 6
    churn_w: 5.06
    fixes: 4
    authors: 5
    owner_share: 0.33
    fan_in: 5
    tests: 2
    score: 2699
  - path: lib/error-handler.js
    kind: source
    loc: 155
    churn: 20
    churn_w: 7.18
    fixes: 14
    authors: 16
    owner_share: 0.15
    fan_in: 4
    tests: 0
    score: 2529
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 28
    coupling: 61
  - files: [fastify.d.ts, fastify.js]
    count: 24
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 22
    coupling: 76
  - files: [fastify.js, lib/server.js]
    count: 19
    coupling: 41
  - files: [lib/errors.js, types/errors.d.ts]
    count: 18
    coupling: 95
  - files: [fastify.js, lib/errors.js]
    count: 18
    coupling: 39
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 37
  - files: [docs/Reference/Errors.md, types/errors.d.ts]
    count: 17
    coupling: 89
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 36
seams:
  - dirs: [docs/Reference, types]
    count: 73
    coupling: 35
blind_spots:
  - "9 generated or lock files excluded"
---

## Where the risk lives

Risk concentrates in the request lifecycle: instance construction and the public API surface in `fastify.js`, the response path in `lib/reply.js`, the request wrapper in `lib/request.js`, and the shared error catalogue in `lib/errors.js`. Five files hold half the total score, and `fastify.js` alone carries 234 commits with 53 labeled fixes. Bug fixes land heaviest in `fastify.js` (53), `lib/reply.js` (38) and `lib/request.js` (23); `lib/error-handler.js` is small but fix-dominated, 14 fixes out of 20 commits. Nothing qualifies as load-bearing-and-untouched here, but `lib/symbols.js` is the closest analogue: 73 lines, 20 dependents, and every internal state slot in the framework keyed through it. Ownership is diffuse — 592 committer identities, and only `fastify.js` has a top committer above 40% — so no file has a single owner to consult. Nine generated or lock files are outside this map.

## Why these files are hot

`fastify.js` builds the server instance: it assembles the public API object, wires Avvio boot, the router, hooks, decorators, content-type parsers and the schema controller, then exposes every user-facing method. It changes constantly because every new option, hook or shorthand lands here, and 53 of its 234 commits were fixes. Seven files depend on it, and the symbol slots it initializes are read by `lib/reply.js`, `lib/request.js` and `lib/route.js`, so an edit that drops or reorders a `k*` assignment breaks request handling far from the change. Before editing this file, open `lib/route.js` alongside it — the two move together in 39 commits — and run the 63 covering tests under `test/`, starting with `test/fastify-instance.test.js` and `test/custom-parser.0.test.js`.

`lib/errors.js` is the single catalogue of `FST_ERR_*` codes built with `@fastify/error`, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. Seventeen files import from it, so every code is part of the public contract: the code string, message template and HTTP status are observable by users. Its 18 fixes are mostly message and status corrections. Before editing this file, keep the code string and status stable for existing entries, and update `types/errors.d.ts` and `docs/Reference/Errors.md` in the same change — both track it above 60% coupling; verify with `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` definitions and nothing else, reached by 20 files and 28 tests. It is hot because every feature that needs hidden state adds a key here; 11 of its 26 commits were fixes, typically a key added in one file and not read in another. Before editing this file, add keys rather than renaming or removing them, and grep the repo for the symbol name to confirm every reader and writer agrees.

`lib/reply.js` owns serialization and the send path: header and trailer handling, status codes, the `preSerialization`/`onSend`/`onResponse` hook runners, and the stream, web-stream and `Response` branches of `onSendEnd`. With 38 fixes across 88 commits it is the most fix-dense large file, and the bugs cluster in content-type negotiation, early-return paths and stream teardown. Only three files import it, but every route response flows through it. Before editing this file, preserve the early-return shape of `Reply.prototype.send` (each branch must call `onSendHook` exactly once) and run the `test/diagnostics-channel/` suite plus `test/internals/reply` coverage.

`lib/request.js` wraps the incoming request and builds per-instance `Request` subclasses, including the `trustProxy` variant that overrides `ip`, `ips`, `host` and `protocol`. Twenty-three of its 49 commits were fixes, several in proxy trust — the current `getTrustProxyFn` deliberately fails closed for a numeric hop count. Before editing this file, treat the `trustProxy` getters as security-sensitive: any change to who is trusted needs a test asserting that an untrusted peer cannot spoof `x-forwarded-*`.

## Change coupling

`lib/errors.js` and `types/errors.d.ts` move together in 95% of the quieter file's commits, and `docs/Reference/Errors.md` joins at 89%. This is by design: the error catalogue is a published three-part contract. When you add or change a code, edit all three in the same commit.

`fastify.js` pairs with `lib/route.js` (45%) and `lib/server.js` (41%). Routing options and server construction are split across files but conceptually one configuration surface, so option plumbing touches both. When changing an option in `fastify.js`, check `processOptions` and the matching reader in `lib/route.js` or `lib/server.js`.

`lib/warnings.js` and `docs/Reference/Warnings.md` couple at 76%, and the `docs/Reference` ↔ `types` seam at 35% across 73 commits reflects the same rule applied broadly: public behaviour is documented and typed. When you change a warning code or a public type, update its Reference page in the same change.

`lib/reply.js` and `lib/request.js` at 37% is looser and partly decay — both re-implement decorator assertions and content-type lookup against `lib/content-type.js`. When touching that shared logic, move it into `lib/content-type.js` or `lib/decorate.js` rather than editing both copies.

## What to read first

1. `lib/symbols.js` — the full inventory of internal state keys; every other file is unreadable without it.
2. `fastify.js` — the instance shape and which symbol each subsystem owns.
3. `lib/errors.js` — the error contract you must not break, and the codes every other file throws.
4. `lib/route.js` — where routes are prepared and the per-route context is assembled.
5. `lib/reply.js` — the send and serialization path, including hook ordering.
6. `lib/request.js` — request properties and the `trustProxy` variants.
7. `docs/Reference/Errors.md` — the published side of the error catalogue, kept in lockstep with `types/errors.d.ts`.
