---
complex_md: "0.3"
generated: 2025-04-21
commit: 0daba937
tool: complex-md/bench
window_commits: 2000
files_analyzed: 184
profile:
  files_total: 3773
  files_in_scope: 184
  loc_in_scope: 46563
  kinds: "test 2992, generated 389, source 184, docs 112, asset 55, ci 15, example 9, data 9, other 5, manifest 2, vendored 1"
  languages: "js 108, ts 43, mjs 28, c 3, h 2"
  dependency_edges: 4211
  commits_total: 3339
  commits_analyzed: 1640
  commits_skipped: 360
  half_life_commits: 500
  window_from: 2021-08-04
  window_to: 2025-04-21
  velocity_30d: 44.2
  authors_total: 280
  concentration_50: 13
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 988
    churn: 80
    churn_w: 26.47
    fixes: 39
    authors: 24
    owner_share: 0.20
    fan_in: 45
    tests: 4
    score: 24383
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1782
    churn: 28
    churn_w: 14.85
    fixes: 10
    authors: 5
    owner_share: 0.46
    fan_in: 18
    tests: 2
    score: 12686
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1099
    churn: 34
    churn_w: 18.59
    fixes: 12
    authors: 10
    owner_share: 0.50
    fan_in: 8
    tests: 2
    score: 8271
  - path: lib/web/fetch/webidl.js
    kind: source
    loc: 740
    churn: 15
    churn_w: 8.77
    fixes: 2
    authors: 3
    owner_share: 0.87
    fan_in: 17
    tests: 3
    score: 8059
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 18
    churn_w: 9.83
    fixes: 7
    authors: 5
    owner_share: 0.50
    fan_in: 11
    tests: 5
    score: 6944
  - path: lib/core/errors.js
    kind: source
    loc: 244
    churn: 20
    churn_w: 4.51
    fixes: 11
    authors: 13
    owner_share: 0.25
    fan_in: 30
    tests: 12
    score: 6911
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2258
    churn: 28
    churn_w: 15.32
    fixes: 7
    authors: 8
    owner_share: 0.54
    fan_in: 6
    tests: 1
    score: 6870
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 686
    churn: 28
    churn_w: 17.08
    fixes: 11
    authors: 6
    owner_share: 0.64
    fan_in: 6
    tests: 0
    score: 6265
  - path: lib/dispatcher/client.js
    kind: source
    loc: 609
    churn: 25
    churn_w: 11.94
    fixes: 16
    authors: 6
    owner_share: 0.48
    fan_in: 6
    tests: 0
    score: 5444
  - path: lib/core/symbols.js
    kind: source
    loc: 68
    churn: 22
    churn_w: 6.18
    fixes: 6
    authors: 11
    owner_share: 0.32
    fan_in: 24
    tests: 21
    score: 5379
  - path: lib/web/fetch/response.js
    kind: source
    loc: 636
    churn: 19
    churn_w: 10.79
    fixes: 6
    authors: 7
    owner_share: 0.63
    fan_in: 7
    tests: 1
    score: 5366
  - path: lib/web/websocket/util.js
    kind: source
    loc: 338
    churn: 24
    churn_w: 13.67
    fixes: 5
    authors: 6
    owner_share: 0.54
    fan_in: 7
    tests: 1
    score: 5305
  - path: lib/web/fetch/data-url.js
    kind: source
    loc: 744
    churn: 7
    churn_w: 3.82
    fixes: 6
    authors: 3
    owner_share: 0.43
    fan_in: 12
    tests: 1
    score: 5183
  - path: lib/web/fetch/body.js
    kind: source
    loc: 532
    churn: 19
    churn_w: 11.53
    fixes: 6
    authors: 5
    owner_share: 0.68
    fan_in: 5
    tests: 0
    score: 4340
  - path: lib/core/request.js
    kind: source
    loc: 397
    churn: 55
    churn_w: 14.56
    fixes: 36
    authors: 19
    owner_share: 0.40
    fan_in: 4
    tests: 0
    score: 4265
load_bearing:
co_change:
  - files: [lib/web/fetch/request.js, lib/web/fetch/response.js]
    count: 17
    coupling: 89
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/util.js]
    count: 16
    coupling: 67
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 11
    coupling: 73
  - files: [lib/web/websocket/receiver.js, lib/web/websocket/websocket.js]
    count: 11
    coupling: 46
  - files: [lib/cache/memory-cache-store.js, types/cache-interceptor.d.ts]
    count: 10
    coupling: 83
  - files: [lib/web/websocket/connection.js, lib/web/websocket/util.js]
    count: 10
    coupling: 63
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 10
    coupling: 63
seams:
  - dirs: [docs/docs, types]
    count: 22
    coupling: 39
  - dirs: [lib/cache, types]
    count: 11
    coupling: 42
  - dirs: [benchmarks/fetch, lib/web]
    count: 10
    coupling: 91
  - dirs: [lib/cache, lib/util]
    count: 10
    coupling: 59
blind_spots:
  - "1 vendored files excluded"
  - "389 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "3 credential shaped paths left out of every list so a committed map never names them"
  - "22 source files contain a NUL byte, so grep treats them as binary and skips them in silence: test/fixtures/wpt/fetch/api/request/destination/resources/dummy_audio.oga, test/fixtures/wpt/fetch/api/request/destination/resources/dummy_video.webm, test/fixtures/wpt/fetch/content-encoding/br/resources/big.text.br, test/fixtures/wpt/fetch/content-encoding/br/resources/foo.octetstream.br, test/fixtures/wpt/fetch/content-encoding/br/resources/foo.text.br, test/fixtures/wpt/fetch/content-encoding/br/resources/hello.html.br, test/fixtures/wpt/fetch/content-encoding/zstd/resources/big.text.zst, test/fixtures/wpt/fetch/content-encoding/zstd/resources/big.window.zst, test/fixtures/wpt/fetch/content-encoding/zstd/resources/foo.octetstream.zst, test/fixtures/wpt/fetch/content-encoding/zstd/resources/foo.text.zst, test/fixtures/wpt/fetch/content-encoding/zstd/resources/hello.html.zst, test/fixtures/wpt/fetch/h1-parsing/resources/blue-with-0x00-in-a-header.asis, test/fixtures/wpt/fetch/orb/resources/js-unlabeled-utf16-without-bom.json, test/fixtures/wpt/fetch/orb/resources/script-utf16-bom.js, test/fixtures/wpt/fetch/orb/resources/script-utf16-without-bom.js, test/fixtures/wpt/mimesniff/media/resources/flac.flac, test/fixtures/wpt/mimesniff/media/resources/ogg.ogg, test/fixtures/wpt/mimesniff/media/resources/wav.wav, test/fixtures/wpt/mimesniff/media/resources/webm.webm, test/fixtures/wpt/service-workers/service-worker/resources/silence.oga, test/fixtures/wpt/xhr/resources/utf16-bom.json, test/fixtures/wpt/xhr/resources/utf16.txt. Search with git grep -I --text, and fix the byte: it is almost always a separator that should have been written as an escape."
  - "dependencies not resolved for 3 .c, 2 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers: the shared core under `lib/core` (URL parsing, header parsing, stream lifecycle, symbols, errors) and the spec surface under `lib/web/fetch` and `lib/web/websocket`. Thirteen files hold half the total score, and `lib/core/util.js` alone carries a fifth of it: 988 lines that 45 files import. Bug fixes land in `lib/core/util.js` (39 fixes in 80 commits), `lib/core/request.js` (36 in 55) and `lib/dispatcher/client.js` (16 in 25) — all three sit on the request path from user options to socket. No file in scope is load-bearing-and-quiet: everything many files depend on also changes. Ownership splits by layer: core files are touched by everyone (`lib/core/util.js` has 24 authors, top committer 20%) while `lib/web/fetch/webidl.js` is effectively one person's file at 87%. `lib/web/websocket/websocket.js`, `lib/dispatcher/client.js`, `lib/core/request.js` and `lib/web/fetch/body.js` have no covering test file detected, so changes there need a written reproduction. The map skips one vendored file and 389 generated files, and native `.c`/`.h` sources were not resolved, so their dependents are undercounted.

## Why these files are hot

**`lib/core/util.js`** is the grab bag every layer reaches into: `parseURL`, `parseHeaders`/`headerNameToString`, `bodyLength`, `destroy`, `assertRequestHandler`. It changes because each of those is both a validation gate that throws `InvalidArgumentError` and a hot path someone is optimizing — half its commits are fixes. An edit here breaks anything from `index.js` to `lib/api/*` and the benchmarks in `benchmarks/core/`. Before editing this file, open `test/node-test/util.js` and `test/util.js` and confirm the existing thrown-error messages still match, since dependents assert on them.

**`lib/web/fetch/util.js`** is 1782 lines of spec algorithms — referrer policy, origin checks, `bytesMatch` and subresource integrity, timing info, `iteratorMixin`. Its comments cite the Fetch spec step by step, which is why changes arrive as spec updates rather than refactors. 18 files depend on it, including `lib/web/cache`, `lib/web/eventsource` and `lib/web/websocket`. Before editing this file, keep the numbered spec-step comments aligned with the code you change and run `test/fetch/util.js`.

**`lib/web/fetch/request.js`** implements the `Request` class: the 20-plus-step constructor, `makeRequest`, `cloneRequest`, and an `AbortSignal` + `FinalizationRegistry` teardown path that exists to work around Node issues. It keeps changing because every new init option lands here, and it moves with `response.js` in 89% of that file's commits. Before editing this file, open `lib/web/fetch/response.js` and `lib/web/fetch/body.js` alongside it and preserve the abort-listener unregistration in `buildAbort`, which leaks otherwise.

**`lib/web/fetch/webidl.js`** is the type-conversion layer — `brandCheck`, `converters`, `ConvertToInt`, `dictionaryConverter` — used by 17 files for argument validation. It is stable in churn but wide in reach: a changed converter silently alters the errors every web API throws. Before editing this file, run `test/webidl/converters.js`, `test/webidl/helpers.js` and `test/webidl/util.js`, and keep `types/webidl.d.ts` in step with any new converter.

**`lib/web/fetch/headers.js`** owns `HeadersList`, normalization, sorting and the `set-cookie` special case, including the `sortedMap` cache invalidated on every mutation. It changes whenever header semantics or performance do, and 11 files consume it. Before editing this file, run `test/fetch/headers.js` and `test/fetch/headerslist-sortedarray.js` and check that every mutation path still clears `sortedMap`.

## Change coupling

`lib/web/fetch/request.js` and `response.js` move together in 89% of commits: shared body extraction and header guards, coupling by design. Change one and check the other's `clone()` and body handling. The websocket cluster — `receiver.js` with `util.js` at 67%, `connection.js` with `util.js` and `websocket.js` at 63% — is frame parsing, handshake and public API changing as one unit; open all four when touching frame or opcode handling. `lib/handler/cache-handler.js` with `lib/interceptor/cache.js` (73%) and `lib/cache/memory-cache-store.js` with `types/cache-interceptor.d.ts` (83%, plus the `lib/cache`↔`types` seam at 42%) mean the cache store contract lives in the `.d.ts`: update the type and the store in the same commit. `benchmarks/fetch` tracks `lib/web` at 91% because benchmarks import internals directly — when you rename or move an exported helper, grep `benchmarks/` before assuming the build is green. The `docs/docs`↔`types` seam (39%) says documented options and declared options are expected to ship together.

## What to read first

1. `lib/core/util.js` — the shared helpers almost everything imports; read before any core edit.
2. `lib/core/symbols.js` and `lib/core/errors.js` — 24 and 30 dependents; the vocabulary of internal state and thrown errors.
3. `lib/web/fetch/webidl.js` — how every public web API validates its arguments.
4. `lib/web/fetch/request.js` with `lib/web/fetch/body.js` — the request state object and body extraction the rest of fetch assumes.
5. `lib/dispatcher/client.js` — the socket-level request lifecycle where 16 of 25 commits were fixes, and no test covers it directly.
6. `types/dispatcher.d.ts` and `types/cache-interceptor.d.ts` — the public contract that documentation and cache internals are expected to match.
