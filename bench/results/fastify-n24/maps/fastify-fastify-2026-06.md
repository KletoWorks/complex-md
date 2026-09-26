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

Risk concentrates in the request lifecycle and the public instance API: `fastify.js` assembles the server object, `lib/reply.js` and `lib/request.js` implement the per-request objects, and `lib/errors.js` plus `lib/symbols.js` define the contracts everything else imports. Four files hold half the total score. Bug fixes land in `fastify.js` (51 fixes of 219 commits), `lib/route.js` (39 of 86) and `lib/reply.js` (38 of 91) — the serialization and send path is where behavior goes wrong most often. `lib/symbols.js` is 73 lines with 19 dependents: it is a name registry, and renaming a key there breaks files that never appear in your diff. No file is fully untouched-but-depended-on, so there is no separate load-bearing set. Ownership is diffuse (594 committers overall, 68 on `fastify.js` with a 0.46 top share), so conventions live in the tests, not in a maintainer's head. The map covers only tracked source; 9 generated or lock files were excluded.

## Why these files are hot

`fastify.js` builds the instance object literal — symbol-keyed internal state, the route shorthand methods, the getters (`version`, `prefix`, `errorHandler`, `supportedMethods`), and option processing — so nearly every feature request adds a line here. It is the entry point for 6 files including `lib/route.js` and `types/instance.d.ts`, and 63 test files reach it, which is why a change to option defaults or to the shape of the returned object surfaces as failures far from the edit. Before editing this file, run the covering tests (`test/body-limit.test.js`, `test/custom-parser.*.test.js`, `test/async-dispose.test.js`) and keep the public property set on the `fastify` literal and its `Object.defineProperties` block intact.

`lib/errors.js` is the flat `FST_ERR_*` registry built with `@fastify/error`, imported by 17 files. Codes, messages, status codes and error constructors are part of the released API, so 19 of its 45 commits were fixes to wording or status. Before editing this file, add codes rather than renumbering or renaming existing ones, and update `docs/Reference/Errors.md` and `types/errors.d.ts` in the same change.

`lib/symbols.js` is a single exported object of `Symbol()` keys grouped by area (schema, request, 404, reply). Its 19 dependents read those keys directly, and 11 of its 27 commits were fixes, usually lifecycle state added in one place but read in another. Before editing this file, grep the repo for the key name you are touching and confirm every reader and writer still agrees on when it is set.

`lib/reply.js` is the largest hotspot: header and trailer handling, status codes, serializer compilation and cache, `send()` type dispatch (stream, web stream, `Response`, Buffer, string), and the onSend/onError hook runners. Forty-two percent of its commits were fixes — the payload type branches and the streaming teardown are the fragile parts. Before editing this file, run the `test/diagnostics-channel/*.test.js` suite and preserve the `send()` early-return ordering: each branch returns `this` after handing off to `onSendHook`.

`lib/request.js` defines the `Request` prototype getters (`ip`, `host`, `protocol`, `port`, `routeOptions`, `signal`) and the two builder paths, `buildRegularRequest` and `buildRequestWithTrustProxy`, plus schema validation compilation. The trust-proxy variant redefines `ip`, `ips`, `host` and `protocol`, so a getter added only to `Request.prototype` silently behaves differently under `trustProxy`. Before editing this file, add or change getters in both builder paths and check `test/diagnostics-channel/*.test.js`.

## Change coupling

`fastify.js` and `lib/route.js` move together in 39 commits (45%): the instance exposes the shorthands, the router implements `prepareRoute` and `route`. When you touch either, open both and check that the method list on the instance and `buildRouting`'s expectations still line up. `lib/errors.js` and `types/errors.d.ts` co-change at 93% — the highest pair here, and by design: the declaration file mirrors the registry. Add a code in one and the declaration in the other in the same commit. Documentation tracks code closely too: `lib/warnings.js` with `docs/Reference/Warnings.md` at 71% and `lib/errors.js` with `docs/Reference/Errors.md` at 59%; treat these doc files as part of the change, not follow-up work. `lib/reply.js` and `lib/request.js` (38%) share the route context and the symbol set, which is also why `lib/reply.js` and `lib/symbols.js` pair at 52% — adding reply state means adding a symbol. When you add one, add it in `lib/symbols.js` first and initialize it in the `Reply` constructor so it is never read undefined. On the types side, `types/instance.d.ts` couples to `types/route.d.ts` (43%) and `types/hooks.d.ts` (56%): a new instance method usually needs its generic route or hook signature, so change all three in one pass.

## What to read first

1. `lib/symbols.js` — the internal key vocabulary; 19 files read it and nothing else makes sense first.
2. `fastify.js` — the instance object literal and its getters define the public surface.
3. `lib/errors.js` — the error contract every module throws through.
4. `lib/route.js` — the router behind every shorthand on the instance, and the second-highest fix count.
5. `lib/reply.js` — the send and serialization path, where most reply bugs are fixed.
6. `lib/request.js` — the two builder paths and the trust-proxy divergence.
7. `docs/Reference/Errors.md` and `docs/Reference/Warnings.md` — the documented side of the contracts that co-change most tightly with code.
