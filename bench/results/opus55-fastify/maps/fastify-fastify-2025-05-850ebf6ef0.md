---
complex_md: "0.3"
generated: 2025-05-09
commit: 850ebf6e
tool: complex-md/bench
window_commits: 1852
files_analyzed: 47
profile:
  files_total: 385
  files_in_scope: 47
  loc_in_scope: 9570
  kinds: "test 224, docs 52, source 46, ci 27, example 18, other 9, generated 6, asset 1, manifest 1, config 1"
  languages: "js 30, ts 16, json 1"
  dependency_edges: 482
  commits_total: 3959
  commits_analyzed: 1614
  commits_skipped: 238
  half_life_commits: 463
  window_from: 2020-05-19
  window_to: 2025-05-09
  velocity_30d: 30.6
  authors_total: 615
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 946
    churn: 212
    churn_w: 66.94
    fixes: 54
    authors: 73
    owner_share: 0.45
    fan_in: 5
    tests: 186
    score: 10951
  - path: lib/errors.js
    kind: source
    loc: 494
    churn: 44
    churn_w: 15.21
    fixes: 17
    authors: 36
    owner_share: 0.07
    fan_in: 16
    tests: 10
    score: 9948
  - path: lib/reply.js
    kind: source
    loc: 948
    churn: 88
    churn_w: 25.98
    fixes: 37
    authors: 48
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4991
  - path: lib/symbols.js
    kind: source
    loc: 65
    churn: 28
    churn_w: 6.35
    fixes: 13
    authors: 15
    owner_share: 0.14
    fan_in: 17
    tests: 23
    score: 4567
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 22
    churn_w: 6.45
    fixes: 9
    authors: 19
    owner_share: 0.14
    fan_in: 7
    tests: 3
    score: 3996
  - path: lib/request.js
    kind: source
    loc: 376
    churn: 49
    churn_w: 18.17
    fixes: 14
    authors: 31
    owner_share: 0.12
    fan_in: 3
    tests: 12
    score: 3533
  - path: lib/contentTypeParser.js
    kind: source
    loc: 409
    churn: 47
    churn_w: 16.00
    fixes: 21
    authors: 26
    owner_share: 0.17
    fan_in: 2
    tests: 1
    score: 2583
  - path: lib/error-handler.js
    kind: source
    loc: 176
    churn: 14
    churn_w: 5.43
    fixes: 11
    authors: 11
    owner_share: 0.21
    fan_in: 4
    tests: 0
    score: 2344
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 42
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 30
    coupling: 67
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 27
    coupling: 54
  - files: [types/hooks.d.ts, types/route.d.ts]
    count: 19
    coupling: 42
  - files: [lib/reply.js, lib/request.js]
    count: 19
    coupling: 39
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 18
    coupling: 55
  - files: [lib/route.js, lib/symbols.js]
    count: 17
    coupling: 61
  - files: [fastify.d.ts, types/route.d.ts]
    count: 17
    coupling: 34
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 38
  - files: [types/request.d.ts, types/route.d.ts]
    count: 15
    coupling: 37
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "148 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in the framework core and its public API. `fastify.js` builds the instance, and `lib/reply.js` sends the response. `lib/errors.js` and `lib/symbols.js` hold shared tables that 16 and 17 files read. The declarations under `types/` form a second public contract that changes in step with the runtime. Bug fixes land most in `fastify.js` with 54 fixes, `lib/route.js` with 45 and `types/instance.d.ts` with 42. No file is load-bearing, because every file with many dependents changed in the window. Ownership is spread: only `fastify.js` has a dominant committer, with a 0.45 share. The analysis left out 148 bot commits and 6 generated or lock files.

## Why these files are hot

`fastify.js` validates options, builds the router and assembles the public instance with its route shorthands and hooks. It changed in 212 commits, and 54 of them were fixes. Every new option or instance method passes through it, and 186 test files reach it. Before editing this file, open `lib/route.js`, because 43% of its commits also changed `fastify.js`.

`lib/errors.js` defines every `FST_ERR_*` code with a message template, a status code and an error class. Users match on these codes, so a renamed code or a new status is a breaking change. `test/internals/errors.test.js` covers it. Before editing this file, plan the matching change to `docs/Reference/Errors.md`.

`lib/reply.js` implements `reply.send`, headers, trailers and serialization. It runs the `preSerialization`, `onSend` and `onError` hooks for each response. It changed in 88 commits, and 37 of them were fixes. Its content-type defaults and stream paths touch every response. Before editing this file, run the tests in `test/diagnostics-channel/`, which trace each response path.

`lib/symbols.js` is a 65-line table of the `Symbol` keys that hold internal state on the instance, request and reply. 17 files read it, and 23 test files reach it. A renamed key breaks every reader without a syntax error. Before editing this file, search the repository for every use of each key that you change.

`lib/hooks.js` defines the hook names and the runners that execute application and lifecycle hooks in order. The runners accept callback and promise hooks, and most stop when `reply.sent` is true. A new hook name needs an entry in the hook lists, in `Hooks` and in `buildHooks`. 7 files import it, but only 3 test files reach it. Before editing this file, run `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`.

## Change coupling

The declaration files move as one cluster. `types/hooks.d.ts` and `types/instance.d.ts` share 67% of commits, and `types/instance.d.ts` and `types/route.d.ts` share 54%. This coupling is by design: instance methods declare the hook and route signatures. The map counts 0 tests for these files. When one declaration file changes, open `types/instance.d.ts`, `types/route.d.ts` and `types/hooks.d.ts` together.

`lib/route.js` and `lib/symbols.js` share 61% of commits, because new route state needs a new key. `fastify.js` and `lib/route.js` share 43%, because the factory passes route options to the router. When `lib/route.js` gains internal state, add its key to `lib/symbols.js` in the same change.

`lib/reply.js` and `lib/request.js` share 39% of commits, because they are parallel objects with matched accessors. When you change a `Reply` accessor, check `lib/request.js` for the same accessor.

`docs/Reference/Errors.md` follows `lib/errors.js` at 55%, and `docs/Reference/Reply.md` follows `lib/reply.js` at 38%. When public behavior in either source file changes, update its reference page in the same commit.

## What to read first

1. `lib/symbols.js`: the keys for all internal state that other files read.
2. `fastify.js`: the factory and the full public instance API.
3. `lib/hooks.js`: the hook names and the order in which runners execute them.
4. `lib/reply.js`: the response path from `send` to the socket.
5. `lib/errors.js`: the error codes that users and tests match on.
6. `types/instance.d.ts`: the public type contract for the instance.
