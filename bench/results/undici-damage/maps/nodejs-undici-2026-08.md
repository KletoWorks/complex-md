---
complex_md: "0.3"
generated: 2026-07-31
commit: a18ef2d0
tool: complex-md/bench
window_commits: 2000
files_analyzed: 202
profile:
  files_total: 798
  files_in_scope: 202
  loc_in_scope: 54429
  kinds: "test 479, source 202, docs 64, ci 14, data 12, example 11, other 8, generated 4, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 33, c 3, h 1, sh 1"
  dependency_edges: 838
  commits_total: 4124
  commits_analyzed: 1775
  commits_skipped: 225
  half_life_commits: 500
  window_from: 2023-03-13
  window_to: 2026-07-31
  velocity_30d: 48.5
  authors_total: 256
  concentration_50: 15
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 1049
    churn: 78
    churn_w: 22.43
    fixes: 35
    authors: 17
    owner_share: 0.24
    fan_in: 45
    tests: 3
    score: 22774
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1525
    churn: 41
    churn_w: 11.13
    fixes: 20
    authors: 7
    owner_share: 0.44
    fan_in: 17
    tests: 3
    score: 10981
  - path: lib/core/errors.js
    kind: source
    loc: 497
    churn: 15
    churn_w: 5.50
    fixes: 9
    authors: 9
    owner_share: 0.27
    fan_in: 35
    tests: 17
    score: 9643
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2426
    churn: 64
    churn_w: 24.80
    fixes: 31
    authors: 14
    owner_share: 0.38
    fan_in: 6
    tests: 1
    score: 9344
  - path: lib/dispatcher/client.js
    kind: source
    loc: 739
    churn: 44
    churn_w: 15.37
    fixes: 27
    authors: 16
    owner_share: 0.27
    fan_in: 8
    tests: 1
    score: 7562
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 11
    churn_w: 5.21
    fixes: 5
    authors: 5
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 7005
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1145
    churn: 41
    churn_w: 10.02
    fixes: 15
    authors: 11
    owner_share: 0.46
    fan_in: 8
    tests: 2
    score: 6224
  - path: lib/core/symbols.js
    kind: source
    loc: 77
    churn: 21
    churn_w: 6.65
    fixes: 10
    authors: 11
    owner_share: 0.33
    fan_in: 25
    tests: 34
    score: 6137
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 780
    churn: 45
    churn_w: 14.35
    fixes: 18
    authors: 8
    owner_share: 0.58
    fan_in: 6
    tests: 0
    score: 5887
  - path: lib/web/fetch/body.js
    kind: source
    loc: 547
    churn: 39
    churn_w: 13.54
    fixes: 11
    authors: 6
    owner_share: 0.54
    fan_in: 6
    tests: 0
    score: 5244
  - path: lib/web/fetch/response.js
    kind: source
    loc: 639
    churn: 30
    churn_w: 8.96
    fixes: 13
    authors: 8
    owner_share: 0.50
    fan_in: 7
    tests: 1
    score: 5130
  - path: lib/util/cache.js
    kind: source
    loc: 718
    churn: 27
    churn_w: 12.00
    fixes: 17
    authors: 9
    owner_share: 0.26
    fan_in: 5
    tests: 6
    score: 4991
  - path: lib/core/request.js
    kind: source
    loc: 546
    churn: 42
    churn_w: 11.38
    fixes: 32
    authors: 13
    owner_share: 0.26
    fan_in: 5
    tests: 2
    score: 4755
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 3.66
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 4435
  - path: types/dispatcher.d.ts
    kind: source
    loc: 253
    churn: 37
    churn_w: 11.60
    fixes: 15
    authors: 23
    owner_share: 0.19
    fan_in: 6
    tests: 0
    score: 4406
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
  - files: [lib/dispatcher/client-h2.js, lib/dispatcher/client.js]
    count: 16
    coupling: 36
  - files: [lib/web/fetch/body.js, lib/web/fetch/index.js]
    count: 15
    coupling: 38
  - files: [lib/web/fetch/index.js, lib/web/fetch/util.js]
    count: 15
    coupling: 37
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 14
    coupling: 50
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 13
    coupling: 57
  - files: [index.js, types/index.d.ts]
    count: 12
    coupling: 55
  - files: [lib/cache/memory-cache-store.js, types/cache-interceptor.d.ts]
    count: 10
    coupling: 63
seams:
  - dirs: [docs/docs, types]
    count: 58
    coupling: 39
  - dirs: [lib/interceptor, lib/util]
    count: 15
    coupling: 39
blind_spots:
  - "2 submodules not analyzed: test/web-platform-tests/wpt, test/fixtures/cache-tests"
  - "4 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "8 credential shaped paths left out of every list so a committed map never names them"
  - "dependencies not resolved for 3 .c, 1 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers that everything else sits on: the shared core under `lib/core/` (URL and header parsing, symbols, error classes) and the WHATWG spec layer under `lib/web/fetch/`. Fifteen files hold half the total score. Bug fixes land most heavily in `lib/dispatcher/client-h2.js` (59 fixes), `lib/core/util.js` (35) and `lib/core/request.js` (32) — the protocol plumbing, not the public API. No file qualifies as load-bearing-and-untouched: every high-fan-in file here is also actively edited, so there is no quiet floor to rely on. Ownership splits by area: core files are diffuse (`lib/core/util.js` 17 authors, top committer 24%) while `lib/web/websocket/websocket.js` and `lib/web/fetch/body.js` sit near 55% single-owner, so web-layer changes benefit from that owner's review. The two test submodules (`test/web-platform-tests/wpt`, `test/fixtures/cache-tests`) are not analyzed, so spec conformance coverage is invisible to this map.

## Why these files are hot

`lib/core/util.js` is the widest-reaching file in the repo: 45 dependents, from `index.js` through every dispatcher and API handler. It holds URL parsing, header name lowercasing, body-length probing, stream destruction and handler validation — small functions with sharp edge cases, which is why 35 of its 78 commits were fixes. An edit to `parseURL`, `parseHeaders` or `bodyLength` propagates to request building, connection setup and fetch alike. Before editing this file, run `test/util.js`, `test/node-test/util.js` and `test/fetch/formdata.js`, and check whether the symbol you touched is re-exported through `index.js`.

`lib/web/fetch/util.js` implements spec algorithms — referrer policy, origin headers, trustworthiness, range parsing, MIME extraction, decompression streams — with the spec steps inline as comments. Twenty of its 41 commits were fixes, almost all spec-conformance corrections. It feeds `lib/web/fetch/index.js`, the cache and EventSource. Before editing this file, keep the numbered spec comments aligned with the code you change and run `test/fetch/util.js` and `test/fetch/includes-credentials.js`.

`lib/core/errors.js` is a contract file: 35 dependents, and every class pins a public `code` string plus a `Symbol.for` brand used by `Symbol.hasInstance` for cross-realm checks. Its low churn (15 commits) reflects that renaming anything is a breaking change. Before editing this file, preserve the existing `code` values and `Symbol.for('undici.error.*')` keys, add new classes rather than repurposing old ones, and run `test/errors.js`.

`lib/web/fetch/index.js` is the fetch driver at 2426 lines: the `fetching` state machine, redirect handling, cache interaction and abort plumbing, with 31 fixes across 64 commits and only `test/mock-interceptor.js` reaching it directly in this repo. Most of its real coverage lives in the unanalyzed WPT submodule. Before editing this file, trace the abort-listener cleanup path (`cleanupAbortListeners`) and run the `test/fetch/` suite plus WPT rather than relying on the one covering test.

`lib/dispatcher/client.js` owns connection options, the request queue and protocol selection between h1 and h2; 27 of its 44 commits were fixes and it imports roughly 30 symbols from `lib/core/symbols.js`. Option validation here rejects legacy names, so changing a constructor option is a public API change. Before editing this file, open `lib/dispatcher/client-h1.js` and `lib/dispatcher/client-h2.js` together with it, and mirror any new option into `types/dispatcher.d.ts`.

## Change coupling

`lib/web/fetch/request.js` and `lib/web/fetch/response.js` move together in 63% of the quieter file's commits, and `lib/web/fetch/body.js` and `lib/web/fetch/index.js` at 38% — this is by design, since body extraction and the request/response pair share one spec. Open all four when changing body handling or header mutation. The WebSocket cluster (`receiver.js`+`util.js` 62%, `connection.js`+`websocket.js` 57%, `receiver.js`+`websocket.js` 50%) behaves as one module; treat a change to frame parsing as a change to the whole directory and check all four files. `lib/dispatcher/client-h2.js` with `lib/dispatcher/client.js` at 36% reflects the h2 options leaking into the generic client constructor — when adding an h2 option, put it under `h2Options` rather than widening the top-level option list. `lib/handler/cache-handler.js` and `lib/interceptor/cache.js` at 50%, and `lib/cache/memory-cache-store.js` with `types/cache-interceptor.d.ts` at 63%, mean the cache store interface is defined in the `.d.ts`; update the type alongside the store. The `docs/docs`+`types` seam (58 commits, 39%) is the documented API contract: update both when changing a public signature.

## What to read first

1. `lib/core/symbols.js` — 77 lines naming the internal protocol every dispatcher speaks; read before any `lib/dispatcher/` work.
2. `lib/core/errors.js` — the public error codes and brand symbols that callers match on.
3. `lib/core/util.js` — the shared parsing and stream helpers with 45 dependents.
4. `index.js` with `types/index.d.ts` — what is actually exported, and the coupling that keeps types honest.
5. `lib/dispatcher/client.js` — option validation and h1/h2 selection, the entry point for connection behavior.
6. `lib/web/fetch/util.js` — the spec-step conventions the whole `lib/web/` tree follows.
