---
complex_md: "0.3"
generated: 2026-07-30
commit: 0e9a3b35
tool: complex-md/bench
window_commits: 1842
files_analyzed: 51
profile:
  files_total: 395
  files_in_scope: 51
  loc_in_scope: 11341
  kinds: "test 233, docs 52, source 51, ci 24, example 19, other 8, generated 6, asset 1, manifest 1"
  languages: "js 35, ts 16"
  dependency_edges: 517
  commits_total: 4372
  commits_analyzed: 1704
  commits_skipped: 138
  half_life_commits: 461
  window_from: 2021-04-12
  window_to: 2026-07-30
  velocity_30d: 28.6
  authors_total: 594
  concentration_50: 5
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1026
    churn: 223
    churn_w: 68.05
    fixes: 52
    authors: 66
    owner_share: 0.45
    fan_in: 7
    tests: 194
    score: 14026
  - path: lib/errors.js
    kind: source
    loc: 548
    churn: 47
    churn_w: 15.92
    fixes: 19
    authors: 33
    owner_share: 0.11
    fan_in: 17
    tests: 10
    score: 10875
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 28
    churn_w: 8.17
    fixes: 11
    authors: 15
    owner_share: 0.14
    fan_in: 21
    tests: 28
    score: 5979
  - path: lib/reply.js
    kind: source
    loc: 1076
    churn: 93
    churn_w: 29.52
    fixes: 38
    authors: 46
    owner_share: 0.19
    fan_in: 3
    tests: 14
    score: 5459
  - path: lib/request.js
    kind: source
    loc: 397
    churn: 50
    churn_w: 20.10
    fixes: 22
    authors: 27
    owner_share: 0.16
    fan_in: 3
    tests: 15
    score: 3977
  - path: lib/warnings.js
    kind: source
    loc: 84
    churn: 38
    churn_w: 14.78
    fixes: 12
    authors: 21
    owner_share: 0.16
    fan_in: 5
    tests: 2
    score: 3503
  - path: lib/hooks.js
    kind: source
    loc: 433
    churn: 18
    churn_w: 4.46
    fixes: 8
    authors: 15
    owner_share: 0.17
    fan_in: 7
    tests: 3
    score: 3461
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
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 17
    coupling: 71
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [fastify.js, lib/errors.js]
    count: 17
    coupling: 36
  - files: [lib/errors.js, types/errors.d.ts]
    count: 16
    coupling: 94
  - files: [docs/Reference/Errors.md, types/errors.d.ts]
    count: 15
    coupling: 88
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 15
    coupling: 58
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "158 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in `fastify.js`, the factory that builds the public instance API. The other hotspots are shared internals under `lib/`: the error catalog, the symbol keys, and the request and reply objects. 5 files hold half of the total score. Bug fixes land in `fastify.js` (52 fixes), `lib/route.js` (40 fixes) and `lib/reply.js` (38 fixes). No file qualifies as load-bearing, because every widely imported file changed in the window. Ownership is spread: the top committer holds 45% of `fastify.js` and under 20% of each other hotspot.

## Why these files are hot

`fastify.js` builds the instance object, defines the HTTP method shorthands and wires every `lib/` module together. It changed in 223 commits, and 52 were fixes. A change to the instance shape reaches `lib/route.js`, `types/instance.d.ts` and 194 test files. Before editing this file, open `lib/route.js` and `types/instance.d.ts` alongside it.

`lib/errors.js` defines each `FST_ERR_*` code through `@fastify/error`, with a message, a status code and an error class. 17 files import it, but only 10 test files reach it. Before editing this file, update `types/errors.d.ts` and `docs/Reference/Errors.md` for each code that you add or change.

`lib/symbols.js` holds the table of internal `Symbol` keys. 21 files import it, the highest fan-in in scope. A renamed or removed key breaks those files without a type error. Before editing this file, search `lib/` and `test/` for each key that you change.

`lib/reply.js` sends the payload: it sets the content type, runs the serialization and send hooks, and writes streams and trailers. It changed in 93 commits, and 38 were fixes. Only 14 test files reach it, most under `test/diagnostics-channel/`. Before editing this file, preserve the content-type defaults in `send` and the timer cleanup in `hijack`.

`lib/request.js` defines the request object, the trust-proxy getters and the validation helpers. It changed in 50 commits, and 22 were fixes. Before editing this file, test the `trustProxy` path and the default path, because `buildRequest` builds 2 different prototypes.

## Change coupling

`lib/errors.js`, `types/errors.d.ts` and `docs/Reference/Errors.md` move together by design. The type file shared 94% of its commits with `lib/errors.js` and 88% with the docs page. Open all 3 files when an error code changes.

`lib/warnings.js` and `docs/Reference/Warnings.md` shared 71% of the quieter file's commits. This coupling follows the same catalog pattern as the error codes. Add the doc entry in the same commit as the warning.

`fastify.js` shared 45% of commits with `lib/route.js` and 39% with `lib/server.js`. The factory passes options and callbacks into both modules, so option changes cross the boundary. When an option changes in `processOptions`, open `lib/route.js` and `lib/server.js` to check how they read it.

`lib/reply.js` and `lib/request.js` shared 40% of commits. The coupling is partly decay: `compileSerializationSchema` and `compileValidationSchema` duplicate the same WeakMap cache logic and the same TODO. Move that cache logic into 1 shared helper.

`types/hooks.d.ts` and `types/instance.d.ts` shared 58% of commits. Open `types/instance.d.ts` when a hook type changes.

## What to read first

1. `lib/symbols.js`, because every internal module reads its keys.
2. `fastify.js`, because it defines the instance shape and the order in which modules connect.
3. `lib/errors.js`, because its codes form a contract with `types/errors.d.ts` and the docs.
4. `lib/route.js`, because it has 40 fixes and 0 covering test files in this map.
5. `lib/reply.js` with `lib/request.js`, because together they carry 60 fixes on the request path.
