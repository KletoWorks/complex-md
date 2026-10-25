---
complex_md: "0.3"
generated: 2026-05-07
commit: 6d202c62
tool: complex-md/bench
window_commits: 1845
files_analyzed: 50
profile:
  files_total: 391
  files_in_scope: 50
  loc_in_scope: 10465
  kinds: "test 230, docs 52, source 50, ci 24, example 19, other 8, generated 6, asset 1, manifest 1"
  languages: "js 34, ts 16"
  dependency_edges: 505
  commits_total: 4286
  commits_analyzed: 1676
  commits_skipped: 169
  half_life_commits: 461
  window_from: 2021-02-10
  window_to: 2026-05-07
  velocity_30d: 28.9
  authors_total: 587
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 984
    churn: 219
    churn_w: 68.10
    fixes: 50
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 191
    score: 12592
  - path: lib/errors.js
    kind: source
    loc: 522
    churn: 44
    churn_w: 13.74
    fixes: 18
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10030
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 28
    churn_w: 8.17
    fixes: 12
    authors: 15
    owner_share: 0.14
    fan_in: 19
    tests: 28
    score: 5747
  - path: lib/reply.js
    kind: source
    loc: 1032
    churn: 87
    churn_w: 24.53
    fixes: 35
    authors: 45
    owner_share: 0.17
    fan_in: 3
    tests: 14
    score: 4853
  - path: lib/request.js
    kind: source
    loc: 396
    churn: 48
    churn_w: 19.43
    fixes: 19
    authors: 26
    owner_share: 0.17
    fan_in: 3
    tests: 15
    score: 3852
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.89
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3164
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 35
    churn_w: 12.41
    fixes: 9
    authors: 20
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 2865
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 22
    coupling: 58
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
    coupling: 78
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 50
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 50
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "155 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public instance API and connects every subsystem. Four files hold half of the total score: `fastify.js`, `lib/errors.js`, `lib/symbols.js` and `lib/reply.js`. The files `lib/errors.js` and `lib/symbols.js` are shared registries that 17 and 19 files import. The files `lib/reply.js` and `lib/request.js` define the per-request contract that every handler and hook sees. Bug fixes landed most in `fastify.js` (50 fixes), `lib/route.js` (39 fixes) and `lib/reply.js` (35 fixes). The load-bearing list is empty, because no widely imported file stayed untouched in the window. Ownership is spread across 587 committers, and only `fastify.js` has a top committer above 20%, at 46%.

## Why these files are hot

`fastify.js` builds the instance object: route shorthands, hooks, decorators, schema setters and the Avvio boot lifecycle. It changed in 219 commits, and 50 of them were fixes. It imports nearly every `lib/` module, and 191 test files reach it. Its public keys are mirrored in `types/instance.d.ts`. Before editing this file, run the full test suite, because a local change here reaches all 191 test files.

`lib/errors.js` defines every `FST_ERR_*` code with `@fastify/error`: a message, a status code and an error class. `fastify.js` re-exports the codes as `errorCodes`, so code names and messages are public API. 18 of its 44 commits were fixes. Before editing this file, run `test/internals/errors.test.js`.

`lib/symbols.js` declares the private Symbol keys that modules use to read instance, request, reply and context state. It has 73 lines, but 19 files import it and 28 test files reach it. A removed key returns `undefined` at each reader without an error. Before editing this file, search `lib/` and `test/` for each key that you change.

`lib/reply.js` implements `send`, headers, trailers, serialization and the onSend, preSerialization and onError hook chain. It changed in 87 commits, and 35 were fixes. The stream, web stream and trailer paths carry the most branches. Its 14 covering tests include the `test/diagnostics-channel/` files. Before editing this file, run the tests in `test/diagnostics-channel/`.

`lib/request.js` builds per-route Request classes, the trust-proxy getters and the validation helpers. 19 of its 48 commits were fixes. Before editing this file, preserve the `ip`, `host` and `protocol` getters in both `buildRegularRequest` and `buildRequestWithTrustProxy`.

## Change coupling

`fastify.js` shared 40 commits with `lib/route.js` (45%) and 18 with `lib/server.js` (40%). This coupling is by design: `fastify.js` delegates route registration to `lib/route.js` and `listen` to `lib/server.js`. When an option or lifecycle step in `fastify.js` changes, open `lib/route.js` and `lib/server.js`.

`lib/warnings.js` moved with `docs/Reference/Warnings.md` in 78% of its commits. `lib/errors.js` moved with `docs/Reference/Errors.md` in 58%. The docs list every code, so this coupling is by design. Update the matching docs file in the same commit as a code change.

`lib/symbols.js` shared 50% of its commits with `fastify.js` and 50% with `lib/reply.js`. New state on the instance or the reply needs a new key. Add the key to the matching group in `lib/symbols.js` in the same commit.

`lib/reply.js` and `lib/request.js` shared 18 commits (38%). Part of this coupling is decay: both files duplicate the lazy WeakMap compile cache, and both carry the same TODO. Extract the shared cache logic instead of editing both copies.

`types/instance.d.ts` moved with `types/hooks.d.ts` (58%) and `types/route.d.ts` (43%). These declarations mirror the runtime API in `fastify.js`. When the runtime API changes, update `types/instance.d.ts` and the matching `types/` file.

## What to read first

1. `lib/symbols.js`: the names of all internal state that the other files read.
2. `fastify.js`: the instance API, the option checks and the boot and close lifecycle.
3. `lib/errors.js`: the error codes that users catch by name.
4. `lib/reply.js`: the send path and the hook chain after the handler.
5. `lib/request.js`: the request getters and the validation helpers.
6. `lib/route.js`: the partner of `fastify.js`, with 39 fixes and no direct tests in the table.
