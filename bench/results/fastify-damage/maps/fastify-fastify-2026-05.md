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
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: the instance factory (`fastify.js`), the reply and request objects (`lib/reply.js`, `lib/request.js`), and the two shared vocabularies they all import — the error catalog (`lib/errors.js`) and the internal symbol table (`lib/symbols.js`). Four files hold half the total score, and all four are public-API surface: what they export is what plugin authors consume. Bug fixes land heaviest in `fastify.js` (50 fixes of 219 commits), `lib/route.js` (39 of 88) and `lib/reply.js` (36 of 88) — roughly 40% of every change to the router and reply paths is corrective. There are no load-bearing files: everything with many dependents also moves, so no part of this tree is quietly frozen. Ownership is diffuse — 587 committer identities in the window, and `owner_share` sits near 0.1–0.2 on every hotspot except `fastify.js` at 0.46, so most of these files have no single person to ask. Nine generated or lock files and one credential-shaped path are excluded from every list above.

## Why these files are hot

`fastify.js` builds the server instance: it assembles the symbol-keyed internal state, wires the router, reply and request factories, and defines the whole public method surface plus its getters (`pluginName`, `errorHandler`, `supportedMethods`). It changes on nearly every feature because every feature needs a hook, an option or a method here, and 50 of its 219 commits were fixes. Sixty-three test files reach it, and six files depend on it including `lib/route.js` and three `.d.ts` files. Before editing this file, decide whether the change adds a public method or an internal symbol, and if public, update `fastify.d.ts` in the same commit — those two move together in 34% of its commits.

`lib/errors.js` is a flat catalog of `createError` definitions, imported by 17 files. Each entry is a code string, a format template with `%s` placeholders, a status code and sometimes an error subclass; consumers destructure by name, so a rename or a status-code change breaks callers silently and changes HTTP responses. It carries 19 fixes in 45 commits, mostly message and status corrections. Before editing this file, keep existing code names and their `%s` arity intact, add new codes rather than repurposing old ones, and update `docs/Reference/Errors.md` alongside it.

`lib/symbols.js` is 73 lines of `Symbol()` definitions and nothing else, imported by 19 files — the highest fan-in in the tree. Every piece of hidden state on an instance, request or reply is keyed here, so the file grows whenever a feature needs internal state and shrinks almost never. Removing or renaming a key breaks any dependent that still destructures it, and the destructuring is by name at the top of each module. Before editing this file, grep the repo for the key you are touching and confirm every importer, because 29 test files exercise these symbols indirectly and none tests the file itself.

`lib/reply.js` implements serialization, headers, trailers, status codes, streaming (`sendStream`, `sendWebStream`), the `onSend`/`onError`/`onResponse` hook runners, and `hijack`. It is the file where protocol edge cases surface: 36 of its 88 commits were fixes, on content-type charset handling, trailer validity, premature stream close and already-sent replies. It reads state that `lib/request.js` writes (`kTimeoutTimer`, `kOnAbort`, `kRequestSignal`) and shares symbols with it heavily. Before editing this file, run the `test/diagnostics-channel/*` suite plus the reply tests, and check `lib/request.js` for the lifecycle symbols you touch.

`lib/request.js` builds the per-request object, with two factory paths — `buildRegularRequest` and `buildRequestWithTrustProxy` — and a large block of prototype getters (`host`, `protocol`, `ip`, `port`, `signal`, `routeOptions`) plus the validation-compilation API. The trust-proxy variant overrides three of those getters, so a getter added to the base prototype can be silently wrong behind a proxy. Before editing this file, check whether the property you add also needs a trust-proxy override, and run the request tests along with `test/diagnostics-channel/`.

## Change coupling

`fastify.js` and `lib/route.js` share 40 commits (45%): the factory delegates every shorthand method and `route()` into `buildRouting`, so the two sides of the routing contract are one change. `lib/route.js` has no test file of its own — verify routing changes through the `fastify.js` suites. Open both when adding or altering a route option or HTTP method.

Documentation tracks two source files closely by design: `lib/warnings.js` with `docs/Reference/Warnings.md` at 74%, and `lib/errors.js` with `docs/Reference/Errors.md` at 59%. Each warning code and error code is a documented part of the public contract. When you add or change a code in either file, add the matching entry to its reference doc in the same commit.

The type declarations form their own cluster: `types/instance.d.ts` with `types/route.d.ts` (43%) and with `types/hooks.d.ts` (58%), and `fastify.d.ts` with `fastify.js` (34%). This is the runtime API restated in TypeScript, and the coupling is the cost of keeping two descriptions of one surface. When you change a hook signature or route option in `lib/`, update the corresponding `types/*.d.ts` and check the type tests.

`lib/reply.js` pairs with `lib/request.js` (38%) and with `lib/symbols.js` (52%). Both are structural: reply reads request-owned lifecycle state, and every new piece of that state needs a symbol. When adding lifecycle state, add the symbol first, then set it in `lib/request.js` and clear it in `lib/reply.js` — `hijack` and `setupResponseListeners` are the two places that must release it.

## What to read first

1. `lib/symbols.js` — the internal vocabulary; nothing in `lib/` reads without it.
2. `fastify.js` — the instance shape and the full public method surface in one object literal.
3. `lib/errors.js` — every failure mode the framework can produce, with its status code.
4. `lib/reply.js` — the send, serialize and hook-run path where most protocol bugs live.
5. `lib/request.js` — the per-request object and the trust-proxy fork of its getters.
6. `lib/route.js` — the routing contract that `fastify.js` delegates to, and which has no direct tests.
7. `fastify.d.ts` and `types/instance.d.ts` — the declared contract that must match any public change.
