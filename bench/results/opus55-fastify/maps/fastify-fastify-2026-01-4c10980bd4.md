---
complex_md: "0.3"
generated: 2025-12-29
commit: 4c10980b
tool: complex-md/bench
window_commits: 1843
files_analyzed: 49
profile:
  files_total: 385
  files_in_scope: 49
  loc_in_scope: 9867
  kinds: "test 225, docs 52, source 48, ci 25, example 18, other 8, generated 6, asset 1, manifest 1, config 1"
  languages: "js 32, ts 16, json 1"
  dependency_edges: 487
  commits_total: 4163
  commits_analyzed: 1633
  commits_skipped: 210
  half_life_commits: 461
  window_from: 2020-10-21
  window_to: 2025-12-29
  velocity_30d: 29.2
  authors_total: 597
  concentration_50: 4
  hotspot_cut: 6
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 981
    churn: 213
    churn_w: 66.08
    fixes: 50
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 188
    score: 12412
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 42
    churn_w: 13.02
    fixes: 16
    authors: 32
    owner_share: 0.10
    fan_in: 16
    tests: 10
    score: 9292
  - path: lib/symbols.js
    kind: source
    loc: 67
    churn: 26
    churn_w: 6.32
    fixes: 11
    authors: 13
    owner_share: 0.15
    fan_in: 19
    tests: 25
    score: 4897
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 88
    churn_w: 23.97
    fixes: 35
    authors: 46
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4759
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 4.81
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3482
  - path: lib/request.js
    kind: source
    loc: 374
    churn: 43
    churn_w: 15.13
    fixes: 14
    authors: 25
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3288
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
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "157 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in the framework core, and 4 files hold half the total score. `fastify.js` builds the public instance API. The files in `lib/` carry the request lifecycle, the reply, the hooks and the error codes. Bug fixes land most in `fastify.js` (50 fixes), `lib/route.js` (41 fixes) and `lib/reply.js` (35 fixes). The load-bearing list is empty: no file with many dependents stayed untouched in the window. 1 committer holds 46% of the commits to `fastify.js`, and the top committer of each other hotspot holds 15% or less. The map leaves out 157 bot commits and 6 generated or lock files.

## Why these files are hot

`fastify.js` (981 lines) creates the instance object, its route shorthands, its decorator methods and its lifecycle methods. It changed in 213 commits, and 50 of them were fixes. The instance properties use the keys from `lib/symbols.js`, so a new property touches both files. 188 test files reach it, for example `test/404s.test.js` and `test/async-await.test.js`. Before editing this file, open `lib/route.js`, because 40 commits changed both files.

`lib/errors.js` (505 lines) defines each `FST_ERR_*` code with its message, its HTTP status and its error class. 16 files import it. A renamed code breaks those importers and user code that matches on `err.code`. `test/internals/errors.test.js` covers the codes. Before editing this file, open `docs/Reference/Errors.md` to update the entry for each changed code.

`lib/symbols.js` (67 lines) defines the private `Symbol` keys that the instance, the request and the reply share. 19 files import it, more than any other file. It changed in 26 commits, and 11 of them were fixes. Before editing this file, search the 19 importers for each key that you rename or remove.

`lib/reply.js` (944 lines) implements `reply.send`, the headers, the trailers, the serialization and the stream output. It changed in 88 commits, and 35 of them were fixes. It calls the hook runners in `lib/hooks.js`, so an edit can change the order of `onSend`, `preSerialization` and `onError`. The tests in `test/diagnostics-channel/` cover it. Before editing this file, open `lib/request.js`, because 40% of its commits also changed `lib/reply.js`.

`lib/hooks.js` (429 lines) lists the supported hooks and builds the runners for the application and request lifecycles. 7 files import it, among them `lib/reply.js`, `lib/route.js` and `lib/server.js`. Only 3 test files reach it. Before editing this file, run `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`.

## Change coupling

`fastify.js` moves with `lib/route.js` (44%) and `lib/server.js` (38%). This coupling is by design: the instance passes its options to the router and to the server factory. When an instance option changes, open `lib/route.js` and `lib/server.js` to check how each reads it.

`lib/symbols.js` moves with `lib/reply.js` and `lib/route.js` at 54% each. A new private key lands in `lib/symbols.js` together with its first use. Add each key and its first use in the same commit.

`lib/warnings.js` moves with `docs/Reference/Warnings.md` at 82%. `lib/errors.js` moves with `docs/Reference/Errors.md` at 57%. The reference docs list each code by hand, so this coupling is by design. Update the doc entry in the same commit as the code.

`types/instance.d.ts` moves with `types/hooks.d.ts` (60%) and `types/route.d.ts` (49%). The instance type uses the hook and route types, so a signature change reaches the instance type. When a hook or route signature changes, update `types/instance.d.ts` to match.

## What to read first

1. `lib/symbols.js`: it names the private state that every core file reads.
2. `fastify.js`: it builds the public instance and connects each `lib/` module.
3. `lib/hooks.js`: it defines the hook order that the request and the reply follow.
4. `lib/reply.js`: it holds the send path, where 35 fixes landed.
5. `lib/errors.js`: it lists the error codes that user code matches on.
