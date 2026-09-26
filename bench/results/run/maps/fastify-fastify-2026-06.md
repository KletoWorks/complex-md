---
complex_md: "0.3"
generated: 2026-06-28
commit: 6e6be153
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 391
  files_in_scope: 49
  loc_in_scope: 10562
  kinds: "test 228, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 33, ts 16"
  dependency_edges: 372
  commits_total: 4323
  commits_analyzed: 1839
  commits_skipped: 161
  half_life_commits: 500
  window_from: 2021-03-08
  window_to: 2026-06-28
  velocity_30d: 31
  authors_total: 594
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1014
    churn: 219
    churn_w: 66.07
    fixes: 51
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12518
  - path: lib/errors.js
    kind: source
    loc: 531
    churn: 45
    churn_w: 14.83
    fixes: 19
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10583
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 27
    churn_w: 7.66
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 19
    tests: 29
    score: 5569
  - path: lib/reply.js
    kind: source
    loc: 1084
    churn: 91
    churn_w: 26.44
    fixes: 38
    authors: 46
    owner_share: 0.20
    fan_in: 3
    tests: 14
    score: 5145
  - path: lib/request.js
    kind: source
    loc: 396
    churn: 47
    churn_w: 18.28
    fixes: 19
    authors: 26
    owner_share: 0.15
    fan_in: 3
    tests: 15
    score: 3740
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.68
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3087
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.58
    fixes: 11
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 3062
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 24
    coupling: 59
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 38
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 15
    coupling: 71
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 15
    coupling: 43
  - files: [lib/errors.js, types/errors.d.ts]
    count: 14
    coupling: 93
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 56
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
---

## Where the risk lives

Risk concentrates in the request lifecycle: the instance factory (`fastify.js`), the reply and request prototypes (`lib/reply.js`, `lib/request.js`), and the two shared vocabularies everything else imports — the error catalog (`lib/errors.js`, fan-in 17) and the internal symbol table (`lib/symbols.js`, fan-in 19). Four files hold half the total score, so most structural risk is reachable from a handful of paths. Bug fixes land heaviest in `fastify.js` (51 fixes of 219 commits), `lib/route.js` (39 of 86) and `lib/reply.js` (38 of 91); the fix share in `lib/route.js` is close to half its history. No file is load-bearing-and-untouched: the widely depended-on files are also the ones being edited. With 594 committer identities and top-committer shares between 0.06 and 0.46, only `fastify.js` has anything like a primary owner; everywhere else changes arrive from many hands, so conventions live in the tests rather than in one person's head. Nine generated or lock files are outside this map.

## Why these files are hot

`fastify.js` builds the instance: it assembles the public API object, installs symbol-keyed internal state, wires Avvio booting, the router, the 404 router, the schema controller, the error handler and the HTTP server, then defines the getters (`prefix`, `version`, `errorHandler`, `supportedMethods`) that users read. Every new server option or instance method lands here, which is why it has the highest churn and 51 fixes. It is imported by `lib/route.js`, `lib/logger-factory.js` and three `types/*.d.ts` files, so an edit to the API object or its option processing ripples into routing and the public types; 63 test files reach it. Before editing this file, open `lib/route.js` alongside it — the two change together in 45% of route.js's commits — and run the option and lifecycle suites (`test/async-dispose.test.js`, `test/body-limit.test.js`, `test/constrained-routes.test.js`).

`lib/errors.js` is a flat catalog of `createError` definitions, each fixing a code, a message template and a status. Seventeen files import it, and the codes are public API: renaming a code, changing a status, or altering a `%s` placeholder is a breaking change for users matching on `err.code`. Nineteen of its 45 commits were fixes, usually message or status corrections. Before editing this file, add codes rather than renumbering existing ones, and update `types/errors.d.ts` and `docs/Reference/Errors.md` in the same commit; verify with `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` declarations and the widest dependency in the repo (fan-in 19). It carries no logic, so its 11 fixes are about scope: a symbol added for one subsystem and then read by another, or state that leaked between request, reply and context. Before editing this file, add a new key rather than reusing an existing one, and grep the repo for the symbol name to see every reader before changing what it holds.

`lib/reply.js` is the response path: header and trailer handling, status codes, serialization compilation and caching, the `onSend`/`preSerialization`/`onError` hook runners, and the stream, web-stream and HTTP/2 write paths. Its 38 fixes concentrate in those send paths — premature close, headers already sent, locked readers. It is imported by `fastify.js`, `lib/four-oh-four.js` and `lib/plugin-override.js`. Before editing this file, preserve the rule that a reply is sent exactly once (the `sent`, `kReplyHijacked` and `kReplyIsError` checks at the top of `send`) and run `test/diagnostics-channel/*.test.js`, which exercise the full lifecycle.

`lib/request.js` defines the request prototype and the two builder variants — with and without `trustProxy` — plus the getters for `ip`, `host`, `protocol`, `port` and the lazily created abort `signal`. The proxy-trust getters are where its 19 fixes cluster, since header spoofing and multi-value forwarded headers are easy to get subtly wrong. Before editing this file, keep `buildRegularRequest` and `buildRequestWithTrustProxy` behaviorally aligned — a property added to one must exist on the other — and check `lib/reply.js`, which reads request state through the same symbols.

## Change coupling

`fastify.js` and `lib/route.js` (45%) plus `fastify.js` and `lib/server.js` (39%) are by design: the factory owns option processing and the API surface, routing and server creation consume it. When you change an option or a shorthand method in `fastify.js`, open `lib/route.js` and confirm `buildRouterOptions` and `prepareRoute` still receive what they expect.

`lib/errors.js` and `types/errors.d.ts` at 93% is the strongest pair in the repo, and `lib/errors.js` with `docs/Reference/Errors.md` at 59% follows it. The types and docs are hand-maintained mirrors of the catalog, which is why they lag. Change all three in one commit; `lib/warnings.js` and `docs/Reference/Warnings.md` (71%) carry the same obligation.

`lib/reply.js` with `lib/request.js` (38%) and `lib/reply.js` with `lib/symbols.js` (52%) show the lifecycle pair sharing symbol-keyed state across object boundaries. That is by design, but it means symbol state is the coupling surface: when adding a symbol for reply state, check whether `lib/request.js` also needs to clear it (as `hijack` does for `kTimeoutTimer` and `kOnAbort`).

`types/instance.d.ts` with `types/route.d.ts` (43%) and `types/hooks.d.ts` (56%) reflect generic type parameters threading through the declaration files. When you add a generic to the instance type, compile the type tests before assuming the other declarations still resolve.

## What to read first

1. `lib/symbols.js` — the internal vocabulary; nothing in `lib/` reads clearly without it.
2. `fastify.js` — the instance shape, option processing, and what the public API actually exposes.
3. `lib/errors.js` — the error codes you must reuse rather than invent, and the public contract they form.
4. `lib/route.js` — where routes are prepared and validated; the partner to almost every `fastify.js` change.
5. `lib/reply.js` and `lib/request.js` — the per-request objects, their symbol-keyed state, and the send-once invariant.
6. `lib/hooks.js` — the hook names and runner signatures that `lib/reply.js` and `fastify.js` both depend on, with only 3 covering tests.
7. `docs/Reference/Errors.md` and `types/errors.d.ts` — the mirrors you are expected to update alongside the catalog.
