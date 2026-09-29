---
complex_md: "0.3"
generated: 2026-05-25
commit: cc793b78
tool: complex-md/bench
window_commits: 2000
files_analyzed: 202
profile:
  files_total: 766
  files_in_scope: 202
  loc_in_scope: 52558
  kinds: "test 447, source 202, docs 64, ci 14, data 12, example 11, other 8, generated 4, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 33, c 3, h 1, sh 1"
  dependency_edges: 814
  commits_total: 3962
  commits_analyzed: 1721
  commits_skipped: 279
  half_life_commits: 500
  window_from: 2022-10-27
  window_to: 2026-05-25
  velocity_30d: 45.9
  authors_total: 252
  concentration_50: 14
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 1019
    churn: 79
    churn_w: 22.13
    fixes: 36
    authors: 20
    owner_share: 0.24
    fan_in: 45
    tests: 3
    score: 22510
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1522
    churn: 40
    churn_w: 12.80
    fixes: 19
    authors: 6
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 11675
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2403
    churn: 61
    churn_w: 27.82
    fixes: 29
    authors: 13
    owner_share: 0.36
    fan_in: 6
    tests: 1
    score: 9864
  - path: lib/core/errors.js
    kind: source
    loc: 477
    churn: 15
    churn_w: 5.85
    fixes: 8
    authors: 9
    owner_share: 0.27
    fan_in: 35
    tests: 16
    score: 9758
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 11
    churn_w: 6.52
    fixes: 5
    authors: 5
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 7780
  - path: lib/dispatcher/client.js
    kind: source
    loc: 666
    churn: 40
    churn_w: 14.85
    fixes: 23
    authors: 15
    owner_share: 0.30
    fan_in: 8
    tests: 1
    score: 7176
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1115
    churn: 39
    churn_w: 10.43
    fixes: 14
    authors: 10
    owner_share: 0.46
    fan_in: 8
    tests: 2
    score: 6292
  - path: lib/core/symbols.js
    kind: source
    loc: 76
    churn: 22
    churn_w: 7.23
    fixes: 9
    authors: 12
    owner_share: 0.27
    fan_in: 25
    tests: 30
    score: 6265
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 756
    churn: 43
    churn_w: 15.66
    fixes: 17
    authors: 7
    owner_share: 0.60
    fan_in: 6
    tests: 0
    score: 6092
  - path: lib/web/fetch/body.js
    kind: source
    loc: 503
    churn: 37
    churn_w: 14.72
    fixes: 11
    authors: 6
    owner_share: 0.51
    fan_in: 6
    tests: 0
    score: 5435
  - path: lib/web/fetch/response.js
    kind: source
    loc: 641
    churn: 29
    churn_w: 10.04
    fixes: 12
    authors: 7
    owner_share: 0.52
    fan_in: 7
    tests: 1
    score: 5365
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 4.59
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 4912
  - path: lib/core/request.js
    kind: source
    loc: 535
    churn: 47
    churn_w: 11.32
    fixes: 34
    authors: 15
    owner_share: 0.34
    fan_in: 5
    tests: 1
    score: 4673
  - path: types/dispatcher.d.ts
    kind: source
    loc: 253
    churn: 40
    churn_w: 12.54
    fixes: 15
    authors: 26
    owner_share: 0.17
    fan_in: 6
    tests: 0
    score: 4555
  - path: lib/util/cache.js
    kind: source
    loc: 408
    churn: 23
    churn_w: 10.35
    fixes: 13
    authors: 9
    owner_share: 0.30
    fan_in: 5
    tests: 5
    score: 4147
load_bearing:
co_change:
  - files: [lib/web/fetch/request.js, lib/web/fetch/response.js]
    count: 19
    coupling: 66
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/util.js]
    count: 16
    coupling: 62
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/websocket.js]
    count: 15
    coupling: 52
  - files: [lib/web/fetch/body.js, lib/web/fetch/index.js]
    count: 15
    coupling: 41
  - files: [lib/web/fetch/index.js, lib/web/fetch/util.js]
    count: 15
    coupling: 38
  - files: [lib/dispatcher/client-h2.js, lib/dispatcher/client.js]
    count: 14
    coupling: 35
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 13
    coupling: 57
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 13
    coupling: 52
  - files: [index.js, types/index.d.ts]
    count: 12
    coupling: 55
  - files: [lib/cache/memory-cache-store.js, types/cache-interceptor.d.ts]
    count: 10
    coupling: 63
seams:
  - dirs: [docs/docs, types]
    count: 50
    coupling: 41
  - dirs: [lib/interceptor, lib/util]
    count: 14
    coupling: 41
  - dirs: [lib/util, types]
    count: 12
    coupling: 35
  - dirs: [docs/docs, docs/docsify]
    count: 11
    coupling: 85
blind_spots:
  - "2 submodules not analyzed: test/web-platform-tests/wpt, test/fixtures/cache-tests"
  - "4 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "8 credential shaped paths left out of every list so a committed map never names them"
  - "dependencies not resolved for 3 .c, 1 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers: the shared core primitives under `lib/core` (URL parsing, header normalization, stream and body detection, error classes, symbols) and the spec implementation of fetch under `lib/web/fetch`. Fourteen files hold half the total score, and `lib/core/util.js` alone is depended on by 45 files while carrying 79 commits in the window. Bug fixes land hardest in `lib/dispatcher/client-h2.js` (39 fixes), `lib/core/util.js` (36) and `lib/core/request.js` (34) — the HTTP/2 path and request construction are where correctness is still being settled. No file qualifies as load-bearing-and-untouched: every high-fan-in file here also changes, so there is no quiet floor to lean on. Ownership is diffuse in core (`lib/core/util.js` at 0.24 owner share across 20 authors, `types/dispatcher.d.ts` at 0.17 across 26) and concentrated in websockets (`lib/web/websocket/connection.js` at 0.74, `websocket.js` at 0.60), so core changes need broad review while websocket changes need the area owner. The two test submodules, `test/web-platform-tests/wpt` and `test/fixtures/cache-tests`, are not analyzed, so spec conformance coverage is invisible to this map.

## Why these files are hot

`lib/core/util.js` is the shared toolbox: `parseURL`, `parseHeaders`/`headerNameToString`, `bodyLength`, `isStream`/`isBlobLike`/`isFormDataLike`, `destroy`, and the request-handler assertions. It changes constantly because every new dispatcher, interceptor and API surface adds a case to it, and 36 of its 79 commits were fixes — mostly validation and header-normalization edge cases. An edit here reaches 45 dependents including `index.js` and all of `lib/api`, so a loosened check silently changes public behavior. Before editing this file, run `test/util.js`, `test/node-test/util.js` and `test/fetch/formdata.js`, and keep the throw-on-invalid contract of `parseURL` intact — callers depend on `InvalidArgumentError`, not `null`.

`lib/web/fetch/util.js` holds the spec algorithms fetch leans on: referrer policy, origin headers, trustworthy-URL checks, range parsing, MIME extraction, the inflate stream. It moves with the spec and with fetch bug reports (19 fixes of 40 commits) and is imported by cache, eventsource and websocket code as well as fetch itself. Before editing this file, run `test/fetch/util.js` and `test/fetch/includes-credentials.js` and keep the numbered spec comments aligned with the code you change.

`lib/web/fetch/index.js` is the 2403-line fetch driver: `fetch`, `fetching`, `schemeFetch`, redirect handling, cache interaction and timing reporting. It is the single most weighted file by recent churn (27.82) with 29 fixes, because every fetch behavior change lands here. Only `test/mock-interceptor.js` is counted as covering it, so verification comes from the wider `test/fetch` suite and the unanalyzed WPT submodule rather than one file. Before editing this file, open `lib/web/fetch/util.js` and `lib/web/fetch/body.js` alongside it and re-run the `test/fetch` directory, since the helpers it calls are defined there.

`lib/core/errors.js` defines every `UndiciError` subclass, each with a `Symbol.for(...)`-keyed `Symbol.hasInstance` so cross-realm `instanceof` works. Its 35 dependents match on `err.code`, and 16 test files assert on these classes. Before editing this file, preserve the `code` string and the symbol brand on any class you touch, and run `test/errors.js` and `test/client-request.js`.

`lib/web/webidl/index.js` is the WebIDL conversion and brand-check layer used by 17 web API files; it changes rarely (11 commits) but a converter tweak breaks argument validation everywhere at once. Before editing this file, run `test/webidl/converters.js`, `test/webidl/helpers.js` and `test/webidl/util.js`.

## Change coupling

`lib/web/fetch/request.js` and `lib/web/fetch/response.js` move together in 66% of the quieter file's commits, and `lib/web/fetch/index.js` pairs with `body.js` (41%) and `util.js` (38%). This is by design: the four share body extraction and header plumbing. When you change one, open the other three and check that body state and header list handling still agree.

The websocket files form one cluster: `receiver.js` with `util.js` (62%), `receiver.js` with `websocket.js` (52%), `connection.js` with `websocket.js` (57%). Frame parsing, handshake and the public class are one protocol implementation split across files, and none of the top websocket files have counted tests. When you touch any of them, read all four and verify with an end-to-end echo test rather than a unit test.

`lib/dispatcher/client.js` and `lib/dispatcher/client-h2.js` co-change in 35% of commits, and `client-h2.js` carries the highest fix count in the repo (39). The HTTP/1 and HTTP/2 paths duplicate connection lifecycle logic. When fixing one, check whether `client-h1.js` needs the same fix and prefer moving the shared logic into `client.js` over copying it a third time.

The cache area couples `lib/handler/cache-handler.js` with `lib/interceptor/cache.js` (52%) and `lib/cache/memory-cache-store.js` with `types/cache-interceptor.d.ts` (63%), reinforced by the `lib/interceptor` + `lib/util` seam (41%). The store implementation and its type declaration are one contract in two files. When changing a store method, update `types/cache-interceptor.d.ts` in the same commit.

Public surface changes span `index.js` and `types/index.d.ts` (55%), and the `docs/docs` + `types` seam (50 shared commits, 41%) shows documentation tracks the type declarations. When you add or change an exported option, update the matching `.d.ts` and its page under `docs/docs` before you finish.

## What to read first

1. `lib/core/util.js` — the shared primitives 45 files import; read it before editing anything in `lib/core` or `lib/dispatcher`.
2. `lib/core/errors.js` — the error taxonomy and the symbol-brand `instanceof` trick that dependents match on by `code`.
3. `lib/core/symbols.js` — 76 lines, 25 dependents; the private keys that carry state between core, dispatcher and api layers.
4. `lib/web/fetch/index.js` — the fetch control flow, to see which helpers in `util.js`, `body.js` and `response.js` are called and in what order.
5. `lib/web/webidl/index.js` — how every web API validates and converts its arguments before any of your code runs.
6. `types/dispatcher.d.ts` and `types/index.d.ts` — the declared public contract, touched by 26 authors and kept in step with `docs/docs`.
7. `lib/dispatcher/client.js` with `lib/dispatcher/client-h2.js` — the connection lifecycle and the HTTP/2 path where most fixes land.
