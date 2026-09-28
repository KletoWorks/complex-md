---
complex_md: "0.3"
generated: 2026-01-03
commit: c02c5f56
tool: complex-md/bench
window_commits: 2000
files_analyzed: 48
profile:
  files_total: 385
  files_in_scope: 48
  loc_in_scope: 9870
  kinds: "test 223, docs 52, source 47, ci 25, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 31, ts 16, json 1"
  dependency_edges: 359
  commits_total: 4165
  commits_analyzed: 1790
  commits_skipped: 210
  half_life_commits: 500
  window_from: 2020-10-22
  window_to: 2026-01-03
  velocity_30d: 31.6
  authors_total: 599
  concentration_50: 4
  hotspot_cut: 6
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 981
    churn: 213
    churn_w: 65.57
    fixes: 50
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12364
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 42
    churn_w: 12.92
    fixes: 16
    authors: 32
    owner_share: 0.10
    fan_in: 16
    tests: 10
    score: 9257
  - path: lib/symbols.js
    kind: source
    loc: 67
    churn: 26
    churn_w: 6.28
    fixes: 11
    authors: 13
    owner_share: 0.15
    fan_in: 19
    tests: 26
    score: 4879
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 88
    churn_w: 23.78
    fixes: 35
    authors: 46
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4741
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 4.79
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3475
  - path: lib/request.js
    kind: source
    loc: 374
    churn: 43
    churn_w: 15.01
    fixes: 14
    authors: 25
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3277
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 40
    coupling: 44
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 20
    coupling: 57
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 19
    coupling: 49
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 18
    coupling: 60
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 38
  - files: [lib/reply.js, lib/request.js]
    count: 17
    coupling: 40
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 54
  - files: [lib/route.js, lib/symbols.js]
    count: 14
    coupling: 54
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: instance construction and the public API surface in `fastify.js`, response serialization and sending in `lib/reply.js`, the hook runners in `lib/hooks.js`, and the shared vocabulary those files speak in `lib/errors.js` and `lib/symbols.js`. Four files hold half the total score, and `fastify.js` alone scores more than the next two combined. Bug fixes land in `fastify.js` (50 fixes of 213 commits), `lib/route.js` (41 of 91) and `lib/reply.js` (35 of 88) — roughly four in ten commits to the router and the reply object are corrections, not features. No file qualifies as load-bearing-but-untouched; the widely depended-on files here are also actively edited, so `lib/symbols.js` (fan-in 19) and `lib/errors.js` (fan-in 16) carry both kinds of risk at once. Ownership is diffuse across 599 committers — every hotspot but one sits between 9% and 17% top-committer share — with `fastify.js` the exception at 46%, so changes there are likelier to meet an opinion. Nine generated or lock files are outside this map.

## Why these files are hot

`fastify.js` builds the server instance: it wires the router, the 404 handler, the schema controller, content-type parsers, hooks and Avvio, then exposes the whole public API as one object literal plus a block of `Object.defineProperties` getters. It changes on almost every feature because every new option, shorthand or accessor lands here, and 50 of its commits were fixes. Sixty-three test files reach it, and six files depend on it including `lib/route.js` and the type surface in `types/instance.d.ts`. Before editing this file, find the matching test in `test/` for the option you are touching (for example `test/body-limit.test.js` for `bodyLimit`) and keep the `options` object and `initialConfig` in sync, since `lib/initial-config-validation.js` freezes what users can read back.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`. Sixteen files import from it, so a renamed code or changed message breaks callers and the error text users match on. Its churn is steady rather than spiky: codes get added as features land. `test/internals/errors.test.js` asserts the registry itself. Before editing this file, add codes rather than renaming or renumbering them, and update `docs/Reference/Errors.md` in the same commit — 57% of its commits already do.

`lib/symbols.js` is 67 lines of `Symbol()` keys and the highest fan-in in the repo at 19 files. It is small, but 11 of its 26 commits were fixes, which is what a shared namespace looks like when a symbol is added in one place and read in another. Twenty-six test files reach it. Before editing this file, grep the repo for the symbol name before removing or renaming one, and add new keys under the existing section comments so `lib/reply.js`, `lib/route.js` and `lib/request.js` stay readable.

`lib/reply.js` owns `send`, header and trailer handling, status codes, serialization compilation and the onSend/preSerialization/onError hook plumbing. Its 35 fixes reflect how many payload shapes it must discriminate — streams, web streams, `Response`, ArrayBuffer views, strings, null. Only three files require it, but every route response passes through it. The `test/diagnostics-channel/*.test.js` suite covers its lifecycle callbacks. Before editing this file, run the diagnostics-channel tests and preserve the payload-type branch order in `Reply.prototype.send`; reordering it changes which content-type is inferred.

`lib/hooks.js` defines the supported hook names and the runners that execute them, including the async/callback duality. Seven files depend on it, but only three test files reach it — the thinnest coverage of any hotspot here. Before editing this file, read `test/internals/hook-runner.test.js` alongside the change, and check that both the callback path and the promise path in the runner you touch still call `cb` exactly once.

## Change coupling

`fastify.js` and `lib/route.js` move together in 40 commits (44%), and `fastify.js` with `lib/server.js` in 18 (38%). This is by design: the route shorthands on the instance delegate to `buildRouting`, and server construction is split out of the same options object. `lib/route.js` has no test files reaching it directly. When you change route option handling on either side, open both files and verify through a route-level test in `test/route.*.test.js`.

Documentation is coupled to code by convention: `docs/Reference/Warnings.md` with `lib/warnings.js` at 82%, `docs/Reference/Errors.md` with `lib/errors.js` at 57%, `docs/Reference/Reply.md` with `lib/reply.js` at 34%. The first two are near-mechanical — every code or warning is documented. Add or change a code in `lib/errors.js` or `lib/warnings.js` and edit the matching doc page in the same commit.

The type surface moves as one unit: `types/hooks.d.ts` with `types/instance.d.ts` at 60%, and `types/instance.d.ts` with `types/route.d.ts` at 49%. Runtime and types are edited separately, so a runtime signature change in `fastify.js` or `lib/hooks.js` can ship without its declaration. After changing a public signature, update the matching `types/*.d.ts` and run the type tests before committing.

`lib/reply.js` and `lib/request.js` share 17 commits (40%), and each pairs with `lib/symbols.js` at 54%. The reply/request pairing is structural — they are two halves of one route context. The symbol pairing is the cost of the shared namespace: a new piece of per-request state needs a key added in a third file. When adding state to either object, add the symbol in `lib/symbols.js` in the same change rather than reusing a neighbouring key.

## What to read first

1. `lib/symbols.js` — 67 lines, and the vocabulary every other file uses; read it before any `lib/` file will parse.
2. `fastify.js` — the instance object literal and its getters define the entire public API in one place.
3. `lib/errors.js` — the error contract 16 files depend on, and the fastest way to see what can go wrong where.
4. `lib/hooks.js` — the hook names and runner semantics that `lib/reply.js`, `lib/route.js` and `lib/server.js` all assume.
5. `lib/reply.js` — the send path, where payload type discrimination and serialization decisions actually happen.
6. `lib/route.js` — invoked by every shorthand in `fastify.js`, heavily fixed, and reached by no test file of its own.
7. `types/instance.d.ts` — the declaration that has to follow any change to the instance API.
