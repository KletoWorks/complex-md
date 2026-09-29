---
complex_md: "0.3"
generated: 2026-07-23
commit: 10d93fc3
tool: complex-md/bench
window_commits: 2000
files_analyzed: 202
profile:
  files_total: 792
  files_in_scope: 202
  loc_in_scope: 53599
  kinds: "test 473, source 202, docs 64, ci 14, data 12, example 11, other 8, generated 4, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 33, c 3, h 1, sh 1"
  dependency_edges: 833
  commits_total: 4102
  commits_analyzed: 1765
  commits_skipped: 235
  half_life_commits: 500
  window_from: 2023-02-22
  window_to: 2026-07-23
  velocity_30d: 48.1
  authors_total: 260
  concentration_50: 14
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 1049
    churn: 81
    churn_w: 23.31
    fixes: 36
    authors: 18
    owner_share: 0.23
    fan_in: 45
    tests: 3
    score: 23205
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1525
    churn: 41
    churn_w: 11.48
    fixes: 20
    authors: 7
    owner_share: 0.44
    fan_in: 17
    tests: 3
    score: 11144
  - path: lib/core/errors.js
    kind: source
    loc: 497
    churn: 15
    churn_w: 5.67
    fixes: 9
    authors: 9
    owner_share: 0.27
    fan_in: 35
    tests: 17
    score: 9782
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2426
    churn: 64
    churn_w: 25.57
    fixes: 31
    authors: 14
    owner_share: 0.38
    fan_in: 6
    tests: 1
    score: 9485
  - path: lib/dispatcher/client.js
    kind: source
    loc: 695
    churn: 43
    churn_w: 14.83
    fixes: 26
    authors: 16
    owner_share: 0.28
    fan_in: 8
    tests: 1
    score: 7330
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 11
    churn_w: 5.37
    fixes: 5
    authors: 5
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 7105
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1145
    churn: 41
    churn_w: 10.33
    fixes: 15
    authors: 11
    owner_share: 0.46
    fan_in: 8
    tests: 2
    score: 6315
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 758
    churn: 44
    churn_w: 13.78
    fixes: 17
    authors: 8
    owner_share: 0.59
    fan_in: 6
    tests: 0
    score: 5698
  - path: lib/core/symbols.js
    kind: source
    loc: 76
    churn: 20
    churn_w: 5.85
    fixes: 9
    authors: 11
    owner_share: 0.30
    fan_in: 25
    tests: 33
    score: 5679
  - path: lib/web/fetch/body.js
    kind: source
    loc: 547
    churn: 39
    churn_w: 13.95
    fixes: 11
    authors: 6
    owner_share: 0.54
    fan_in: 6
    tests: 0
    score: 5322
  - path: lib/web/fetch/response.js
    kind: source
    loc: 639
    churn: 30
    churn_w: 9.23
    fixes: 13
    authors: 8
    owner_share: 0.50
    fan_in: 7
    tests: 1
    score: 5206
  - path: lib/core/request.js
    kind: source
    loc: 546
    churn: 42
    churn_w: 11.74
    fixes: 32
    authors: 13
    owner_share: 0.26
    fan_in: 5
    tests: 2
    score: 4826
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 3.78
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 4497
  - path: types/dispatcher.d.ts
    kind: source
    loc: 253
    churn: 37
    churn_w: 11.96
    fixes: 15
    authors: 23
    owner_share: 0.19
    fan_in: 6
    tests: 0
    score: 4472
  - path: lib/util/cache.js
    kind: source
    loc: 456
    churn: 25
    churn_w: 10.36
    fixes: 15
    authors: 9
    owner_share: 0.28
    fan_in: 5
    tests: 5
    score: 4284
load_bearing:
co_change:
  - files: [lib/web/fetch/request.js, lib/web/fetch/response.js]
    count: 19
    coupling: 63
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/util.js]
    count: 16
    coupling: 62
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/websocket.js]
    count: 16
    coupling: 50
  - files: [lib/web/fetch/body.js, lib/web/fetch/index.js]
    count: 15
    coupling: 38
  - files: [lib/web/fetch/index.js, lib/web/fetch/util.js]
    count: 15
    coupling: 37
  - files: [lib/dispatcher/client-h2.js, lib/dispatcher/client.js]
    count: 15
    coupling: 35
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 13
    coupling: 57
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 13
    coupling: 48
  - files: [index.js, types/index.d.ts]
    count: 12
    coupling: 55
  - files: [lib/cache/memory-cache-store.js, types/cache-interceptor.d.ts]
    count: 10
    coupling: 63
seams:
  - dirs: [docs/docs, types]
    count: 57
    coupling: 39
  - dirs: [lib/interceptor, lib/util]
    count: 14
    coupling: 39
blind_spots:
  - "2 submodules not analyzed: test/web-platform-tests/wpt, test/fixtures/cache-tests"
  - "4 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "8 credential shaped paths left out of every list so a committed map never names them"
  - "dependencies not resolved for 3 .c, 1 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers: the shared core under `lib/core` (URL parsing, header normalization, stream lifecycle, error taxonomy, symbol keys) and the spec-implementing web layer under `lib/web/fetch` and `lib/web/websocket`. Fourteen files hold half the total score, so edits cluster tightly. Bug fixes land hardest in `lib/core/util.js` (36 fixes), `lib/core/request.js` (32) and `lib/web/fetch/index.js` (31) — parsing, validation and the fetch algorithm absorb most correctness work. No file in scope is load-bearing-but-untouched: everything with wide fan-in also carries churn, so there is no quiet floor to rely on. Ownership is diffuse — 260 committer identities, and the highest-fan-in files have the lowest owner shares (`lib/core/util.js` at 0.23 across 18 authors, `types/dispatcher.d.ts` at 0.19 across 23) — so conventions live in the tests, not in a maintainer's head. The two git submodules (`test/web-platform-tests/wpt`, `test/fixtures/cache-tests`) are not analyzed here, and they are where much of the spec conformance verification actually happens.

## Why these files are hot

`lib/core/util.js` is the shared toolbox: `parseURL`, `parseHeaders`, `bodyLength`, `destroy`, `wrapRequestBody`, token and header-value validators. 45 files import it and 36 of its 81 commits were fixes, because every input-validation edge case eventually becomes a branch here — prototype pollution guards on `__proto__`, IP versus DNS servernames, `isHttpOrHttpsPrefixed` fast paths. An edit here reaches dispatchers, fetch, websocket and the benchmarks simultaneously; only `test/util.js`, `test/node-test/util.js` and `test/fetch/formdata.js` cover it directly. Before editing this file, run `test/util.js` and `test/node-test/util.js`, and keep every exported function's null/undefined and Buffer-versus-string behavior intact — callers pass both.

`lib/web/fetch/util.js` implements spec algorithms with the spec text quoted inline: referrer policy, origin headers, trustworthy-URL checks, range parsing, MIME extraction, the inflate stream. 20 of its 41 commits were fixes. It is consumed by fetch, cache, eventsource and websocket, so a behavior change propagates across all four web APIs. Before editing this file, read the cited spec step numbers in the surrounding comments and keep them matching the code, then run `test/fetch/util.js`.

`lib/core/errors.js` is the error taxonomy, and every class carries a `Symbol.for('undici.error.…')` brand plus a `Symbol.hasInstance` override so `instanceof` works across duplicated copies of undici. 35 files import it; 17 test files reach it. The risk is not churn but contract: renaming a `code`, dropping a brand symbol, or forgetting `hasInstance` on a new class silently breaks user `instanceof` and `err.code` checks. Before editing this file, copy the existing brand-plus-`hasInstance` pattern exactly for any new error, add it to the `module.exports` list, and run `test/errors.js` and `test/jest/instanceof-error.test.js`.

`lib/web/fetch/index.js` is the 2426-line fetch algorithm — `fetching`, `schemeFetch`, `httpRedirectFetch`, `fetchFinale`, abort and timing plumbing. 31 of 64 commits were fixes, several tied to listener leaks and GC-visible lifetimes (`WeakRef` on the response object, `cleanupAbortListeners`). Direct test coverage is thin: only `test/mock-interceptor.js` is attributed to it, so verification depends on the WPT submodule this map cannot see. Before editing this file, trace the abort-listener and `WeakRef` lifecycle end to end so no path skips `cleanupAbortListeners`, and verify against the web-platform-tests fetch suite rather than a unit test.

`lib/dispatcher/client.js` owns connection options, the request queue, and the h1/h2 context switch — `getMaxConcurrent` returns `maxConcurrentStreams` under h2 and the pipelining factor under h1. 26 of 43 commits were fixes, and the constructor is a long wall of rejected legacy options (`keepAlive`, `socketTimeout`, `idleTimeout`). It has one attributed test. Before editing this file, open `lib/dispatcher/client-h1.js` and `lib/dispatcher/client-h2.js` alongside it, since the symbol-keyed state in `lib/core/symbols.js` is read by both.

## Change coupling

`lib/web/fetch/request.js` and `lib/web/fetch/response.js` move together in 63% of the quieter file's commits. This is by design: both wrap an inner spec object, both mirror the same body-extraction and clone paths. When you change one's body or header handling, open the other and apply the symmetric change.

The websocket cluster is tight: `receiver.js` with `util.js` at 62%, `connection.js` with `websocket.js` at 57%, `receiver.js` with `websocket.js` at 50%. Frame parsing, handshake and the public class share state and neither `websocket.js` nor `body.js` has attributed test coverage. When you touch frame handling in `receiver.js`, open `lib/web/websocket/util.js` and `lib/web/websocket/websocket.js` and check the close and error paths in both.

`lib/dispatcher/client-h2.js` and `lib/dispatcher/client.js` co-change at 35%, and `client-h2.js` is the highest-churn file in the whole table (84 commits, 57 fixes). The h2 context still needs `client.js` to change with it, which means the context abstraction is leaking. When you add h2 behavior, put it behind the existing context interface instead of widening `client.js`.

Two documentation-and-type seams are structural: `docs/docs` and `types` share 57 commits (39%), and `index.js` with `types/index.d.ts` sits at 55%, `lib/cache/memory-cache-store.js` with `types/cache-interceptor.d.ts` at 63%. Public surface, its types and its docs are one change. When you add or alter an export, update the matching `.d.ts` and the page under `docs/docs` in the same commit.

## What to read first

1. `lib/core/symbols.js` — 76 lines of symbol keys that 25 files use as the actual state protocol between dispatchers, clients and handlers.
2. `lib/core/errors.js` — the branded error taxonomy every layer throws; learn the `Symbol.for` plus `hasInstance` pattern before adding anything.
3. `lib/core/util.js` — the validation and stream-lifecycle helpers with the widest reach in the repo.
4. `lib/dispatcher/client.js` with `lib/dispatcher/dispatcher-base.js` — the request queue and the h1/h2 context switch, which explain how a dispatch actually flows.
5. `lib/web/fetch/util.js` — the spec-quoting helper layer shared by fetch, cache, eventsource and websocket.
6. `lib/web/fetch/index.js` — the fetch algorithm itself; read it after the helpers so the step numbers resolve.
7. `types/dispatcher.d.ts` — the most-edited public type surface (23 authors), and the contract user code compiles against.
