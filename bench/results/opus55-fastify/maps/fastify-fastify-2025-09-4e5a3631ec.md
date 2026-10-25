---
complex_md: "0.3"
generated: 2025-09-22
commit: 4e5a3631
tool: complex-md/bench
window_commits: 1858
files_analyzed: 48
profile:
  files_total: 384
  files_in_scope: 48
  loc_in_scope: 9686
  kinds: "test 225, docs 52, source 47, ci 25, example 18, other 8, generated 6, asset 1, manifest 1, config 1"
  languages: "js 31, ts 16, json 1"
  dependency_edges: 479
  commits_total: 4097
  commits_analyzed: 1653
  commits_skipped: 205
  half_life_commits: 465
  window_from: 2020-08-30
  window_to: 2025-09-22
  velocity_30d: 30.1
  authors_total: 597
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 963
    churn: 212
    churn_w: 62.93
    fixes: 52
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 187
    score: 12009
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 44
    churn_w: 14.26
    fixes: 18
    authors: 34
    owner_share: 0.09
    fan_in: 16
    tests: 10
    score: 9722
  - path: lib/reply.js
    kind: source
    loc: 942
    churn: 86
    churn_w: 23.01
    fixes: 36
    authors: 46
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4671
  - path: lib/symbols.js
    kind: source
    loc: 66
    churn: 27
    churn_w: 6.00
    fixes: 12
    authors: 14
    owner_share: 0.15
    fan_in: 18
    tests: 24
    score: 4549
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 19
    churn_w: 5.16
    fixes: 8
    authors: 16
    owner_share: 0.16
    fan_in: 7
    tests: 3
    score: 3600
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 45
    churn_w: 15.55
    fixes: 15
    authors: 28
    owner_share: 0.13
    fan_in: 3
    tests: 12
    score: 3297
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 38
    churn_w: 16.12
    fixes: 11
    authors: 23
    owner_share: 0.16
    fan_in: 5
    tests: 2
    score: 3257
  - path: lib/contentTypeParser.js
    kind: source
    loc: 402
    churn: 46
    churn_w: 15.86
    fixes: 22
    authors: 24
    owner_share: 0.22
    fan_in: 2
    tests: 1
    score: 2618
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 38
    coupling: 43
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 22
    coupling: 61
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 22
    coupling: 51
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 20
    coupling: 57
  - files: [lib/reply.js, lib/request.js]
    count: 17
    coupling: 38
  - files: [lib/route.js, lib/symbols.js]
    count: 16
    coupling: 59
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 35
  - files: [fastify.js, lib/server.js]
    count: 15
    coupling: 35
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
seams:
blind_spots:
  - "6 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
  - "142 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
---

## Where the risk lives

Change risk concentrates in fastify.js, the factory that builds the public instance, its options and its lifecycle. The files lib/errors.js and lib/symbols.js are small registries that 16 files and 18 files import. The public TypeScript contract lives in fastify.d.ts and types/, and the map counts 0 tests that reach those files. Bug fixes land most in fastify.js with 52 fixes, lib/route.js with 42 and lib/reply.js with 36. The repository has no load-bearing files, because every widely imported file changed in the window. One committer holds 46% of the commits to fastify.js, while no lib/ file has a top share above 33%.

## Why these files are hot

fastify.js has 963 lines. It validates the options and wires the router, the 404 handler, the server and the hook runners into 1 instance object. It changed in 212 commits, and 52 were fixes. An edit to an option default or a kState flag changes behavior for every plugin. Before editing this file, run the full test/ directory, because 187 test files reach it.

lib/errors.js defines every FST_ERR code through @fastify/error, with a message, a status code and an error class. User code matches on `code`, so a renamed code or a changed status is a breaking change. It changed in 44 commits, and 18 were fixes. Before editing this file, run test/internals/errors.test.js.

lib/reply.js has 942 lines and implements send(), headers, trailers, status codes, serialization and stream output. Its history shows 36 fixes in 86 commits. The send() function picks the content-type and the output path, then runs the onSend and preSerialization hooks. Before editing this file, open lib/request.js and lib/hooks.js, because send() calls the hook runners.

lib/symbols.js has 66 lines and defines the Symbol keys for all internal state on instances, requests, replies and route contexts. A renamed key returns undefined at the old call sites and throws no error. Before editing this file, search lib/ for each key that you change.

lib/hooks.js defines the 16 supported hooks and the runners for application and lifecycle hooks. The runners accept callback and promise styles and map avvio errors to FST_ERR codes. The function buildHooks copies hooks into child contexts but resets onReady, onListen and preClose. Only 3 test files reach it, although 7 files depend on it. Before editing this file, run test/internals/hooks.test.js and test/internals/hook-runner.test.js.

## Change coupling

docs/Reference/Warnings.md and lib/warnings.js co-changed at 82%, and docs/Reference/Errors.md and lib/errors.js at 57%. docs/Reference/Reply.md follows lib/reply.js at 35%. This coupling is by design, because each code and each API has a doc entry. Update the doc entry in the same commit as the code change.

types/instance.d.ts moved with types/hooks.d.ts at 61% and with types/route.d.ts at 51%. These declarations mirror the runtime API in fastify.js. When 1 declaration file changes, open the other 2 and compare them with the JS signature.

lib/route.js and lib/symbols.js co-changed at 59%, and fastify.js and lib/route.js at 43%. New route state needs a new symbol key, and fastify.js wires it in. When lib/route.js changes, open lib/symbols.js and the route methods in fastify.js.

lib/reply.js and lib/request.js co-changed at 38%. A Reply reads its route context through this.request. When 1 object changes, check the other object for the same property.

## What to read first

1. lib/symbols.js, because every internal property name comes from it.
2. fastify.js, because the first 300 lines show the shape of the instance.
3. lib/hooks.js, because it sets the hook order and the runner contracts.
4. lib/reply.js, because send() is the response path for every route.
5. lib/errors.js, because tests and user code match on its codes.
