---
complex_md: "0.3"
generated: 2026-06-05
commit: 2f66db73
tool: complex-md/bench
window_commits: 2000
files_analyzed: 202
profile:
  files_total: 769
  files_in_scope: 202
  loc_in_scope: 52628
  kinds: "test 450, source 202, docs 64, ci 14, data 12, example 11, other 8, generated 4, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 33, c 3, h 1, sh 1"
  dependency_edges: 814
  commits_total: 3985
  commits_analyzed: 1733
  commits_skipped: 267
  half_life_commits: 500
  window_from: 2022-11-22
  window_to: 2026-06-05
  velocity_30d: 46.5
  authors_total: 254
  concentration_50: 14
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 1021
    churn: 82
    churn_w: 24.36
    fixes: 37
    authors: 21
    owner_share: 0.23
    fan_in: 45
    tests: 3
    score: 23520
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1522
    churn: 40
    churn_w: 12.40
    fixes: 19
    authors: 6
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 11496
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2403
    churn: 61
    churn_w: 26.95
    fixes: 29
    authors: 13
    owner_share: 0.36
    fan_in: 6
    tests: 1
    score: 9710
  - path: lib/core/errors.js
    kind: source
    loc: 477
    churn: 14
    churn_w: 5.61
    fixes: 8
    authors: 8
    owner_share: 0.29
    fan_in: 35
    tests: 16
    score: 9576
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 11
    churn_w: 6.32
    fixes: 5
    authors: 5
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 7665
  - path: lib/dispatcher/client.js
    kind: source
    loc: 666
    churn: 40
    churn_w: 14.38
    fixes: 23
    authors: 15
    owner_share: 0.30
    fan_in: 8
    tests: 1
    score: 7065
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1115
    churn: 39
    churn_w: 10.11
    fixes: 14
    authors: 10
    owner_share: 0.46
    fan_in: 8
    tests: 2
    score: 6196
  - path: lib/core/symbols.js
    kind: source
    loc: 76
    churn: 21
    churn_w: 6.94
    fixes: 9
    authors: 11
    owner_share: 0.29
    fan_in: 25
    tests: 30
    score: 6151
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 756
    churn: 43
    churn_w: 15.17
    fixes: 17
    authors: 7
    owner_share: 0.60
    fan_in: 6
    tests: 0
    score: 5999
  - path: lib/web/fetch/body.js
    kind: source
    loc: 503
    churn: 37
    churn_w: 14.25
    fixes: 11
    authors: 6
    owner_share: 0.51
    fan_in: 6
    tests: 0
    score: 5351
  - path: lib/web/fetch/response.js
    kind: source
    loc: 641
    churn: 29
    churn_w: 9.73
    fixes: 12
    authors: 7
    owner_share: 0.52
    fan_in: 7
    tests: 1
    score: 5283
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 4.44
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 4840
  - path: lib/core/request.js
    kind: source
    loc: 535
    churn: 47
    churn_w: 10.96
    fixes: 34
    authors: 15
    owner_share: 0.34
    fan_in: 5
    tests: 1
    score: 4601
  - path: types/dispatcher.d.ts
    kind: source
    loc: 253
    churn: 39
    churn_w: 12.08
    fixes: 15
    authors: 25
    owner_share: 0.18
    fan_in: 6
    tests: 0
    score: 4476
  - path: lib/util/cache.js
    kind: source
    loc: 408
    churn: 23
    churn_w: 10.03
    fixes: 13
    authors: 9
    owner_share: 0.30
    fan_in: 5
    tests: 5
    score: 4084
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
    count: 51
    coupling: 40
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

Risk concentrates in two layers: the shared core helpers under `lib/core` that everything imports, and the WHATWG spec implementations under `lib/web/fetch` and `lib/web/websocket` that carry the visible behaviour. Fourteen files hold half the total score, so edits in a small set of files reach most of the library. Bug fixes land hardest in `lib/dispatcher/client-h2.js` (42 fixes), `lib/core/util.js` (37) and `lib/core/request.js` (34): HTTP/2 framing, argument normalisation and request validation are where correctness keeps being re-litigated. No file is load-bearing-and-untouched; the widely depended-on files (`lib/core/util.js` at fan-in 45, `lib/core/errors.js` at 35, `lib/core/symbols.js` at 25) are also actively edited. Ownership splits by area: the core and types files are broadly shared (`lib/core/util.js` 21 authors at 0.23 top share, `types/dispatcher.d.ts` 25 authors at 0.18), while websocket files are concentrated (`lib/web/websocket/websocket.js` 0.60, `lib/web/websocket/connection.js` 0.74) — expect less collective review there. Two test submodules, `test/web-platform-tests/wpt` and `test/fixtures/cache-tests`, are not covered by this map, and the llhttp `.c`/`.h` sources have undercounted fan-in.

## Why these files are hot

`lib/core/util.js` is the shared toolbox: URL parsing and validation, header name/value parsing, body wrapping and length detection, stream destruction, handler assertions. Forty-five files import it and 37 of its 82 commits were fixes, because nearly every protocol-level bug resolves into a parsing or validation helper here. A change to `parseURL`, `parseHeaders` or `assertRequestHandler` propagates to every dispatcher, API method and interceptor. Before editing this file, run `test/util.js`, `test/node-test/util.js` and `test/fetch/formdata.js`, and keep the thrown error types (`InvalidArgumentError`) unchanged, since callers match on `err.code`.

`lib/web/fetch/index.js` implements the fetch algorithm itself — `fetching`, `schemeFetch`, redirect handling, HTTP cache interaction, authentication and response finalisation — in 2403 lines, with 29 of 61 commits being fixes. It pulls nearly all of `lib/web/fetch/util.js` and both `request.js` and `response.js`, so its coverage is thin here: only `test/mock-interceptor.js` reaches it directly. Before editing this file, keep the numbered spec-step comments aligned with the code you change and verify against the WPT suite in `test/web-platform-tests`, which this map does not index.

`lib/web/fetch/util.js` holds the spec primitives fetch depends on: referrer policy, origin serialisation, trustworthiness checks, header validation, range parsing and the inflate stream. Seventeen files import it, including `lib/web/cache`, `lib/web/eventsource` and websocket code, so a helper change escapes the fetch directory. Before editing this file, run `test/fetch/util.js` and `test/fetch/includes-credentials.js`, and check the non-fetch importers under `lib/web/cache` and `lib/web/eventsource`.

`lib/core/errors.js` defines the public error taxonomy, each class with a `Symbol.for` brand and a custom `Symbol.hasInstance` so `instanceof` works across duplicated copies of undici. Thirty-five files construct these errors and 16 test files assert on them; the brand and the `code` string are the contract users depend on. Before editing this file, preserve each class's `code`, `name` and registered symbol, and run `test/errors.js` plus `test/client-request.js`.

`lib/web/webidl/index.js` provides the converters, brand checks and type assertions used by every web API surface — 17 importers across fetch, cache, cookies, eventsource and websocket. It changes rarely (11 commits) but a converter tweak alters argument-coercion behaviour in all of them at once. Before editing this file, run `test/webidl/converters.js`, `test/webidl/helpers.js` and `test/webidl/util.js`, and confirm error messages still match the spec-mandated prefixes callers pass in.

## Change coupling

`lib/web/fetch/request.js` and `lib/web/fetch/response.js` move together in 66% of the quieter file's commits, and `lib/web/fetch/body.js` tracks `lib/web/fetch/index.js` at 41%: this is by design, since body extraction and cloning are shared between the two wrappers. When you change body extraction or cloning on one side, open the other and mirror the state accessor it uses.

The websocket cluster is tight: `receiver.js` with `util.js` at 62%, `receiver.js` with `websocket.js` at 52%, `connection.js` with `websocket.js` at 57%. Frame parsing, handshake and the public object share state that is not isolated behind an interface. When you touch frame or opcode handling in `receiver.js`, open `lib/web/websocket/util.js` and `lib/web/websocket/websocket.js` and check the close and error paths together — neither has covering tests in the indexed set.

`lib/dispatcher/client-h2.js` and `lib/dispatcher/client.js` co-change at 35%, and `lib/handler/cache-handler.js` with `lib/interceptor/cache.js` at 52%: both pairs share an implicit contract rather than a declared one. When you add a client option or a cache-handler hook, add it to the partner file in the same commit rather than letting the second side catch up later.

Types trail implementation. `index.js` and `types/index.d.ts` co-change at 55%, `lib/cache/memory-cache-store.js` and `types/cache-interceptor.d.ts` at 63%, and the `docs/docs` + `types` seam covers 51 commits at 40%. When you change a public option or a dispatcher signature, update the matching `.d.ts` and its page under `docs/docs` in the same change.

## What to read first

1. `lib/core/util.js` — the helpers nearly every other file imports; read the URL, header and body sections before touching any request path.
2. `lib/core/errors.js` — the error taxonomy and its branding scheme, which fixes the failure contract for the whole library.
3. `lib/core/symbols.js` — 76 lines naming the internal state slots; 25 files read them and 30 test files assert through them.
4. `lib/web/webidl/index.js` — the argument-coercion layer all web APIs route through.
5. `lib/web/fetch/util.js` — the spec primitives, before reading the fetch algorithm that consumes them.
6. `lib/web/fetch/index.js` — the fetch algorithm, read alongside `request.js` and `response.js`.
7. `types/dispatcher.d.ts` — the public dispatcher surface, edited by 25 authors and the thing consumers actually compile against.
