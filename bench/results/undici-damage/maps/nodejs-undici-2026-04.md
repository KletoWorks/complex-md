---
complex_md: "0.3"
generated: 2026-04-17
commit: a1d6766a
tool: complex-md/bench
window_commits: 2000
files_analyzed: 199
profile:
  files_total: 751
  files_in_scope: 199
  loc_in_scope: 51553
  kinds: "test 436, source 199, docs 64, ci 14, data 12, example 11, other 8, generated 3, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 30, c 3, h 1, sh 1"
  dependency_edges: 802
  commits_total: 3821
  commits_analyzed: 1672
  commits_skipped: 328
  half_life_commits: 500
  window_from: 2022-06-30
  window_to: 2026-04-17
  velocity_30d: 43.2
  authors_total: 277
  concentration_50: 13
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 999
    churn: 80
    churn_w: 24.92
    fixes: 37
    authors: 22
    owner_share: 0.24
    fan_in: 45
    tests: 3
    score: 23787
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1522
    churn: 40
    churn_w: 15.57
    fixes: 19
    authors: 6
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 12840
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2391
    churn: 58
    churn_w: 30.62
    fixes: 27
    authors: 13
    owner_share: 0.38
    fan_in: 6
    tests: 1
    score: 10320
  - path: lib/core/errors.js
    kind: source
    loc: 477
    churn: 15
    churn_w: 6.15
    fixes: 7
    authors: 10
    owner_share: 0.27
    fan_in: 35
    tests: 15
    score: 9876
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 11
    churn_w: 7.93
    fixes: 5
    authors: 5
    owner_share: 0.45
    fan_in: 17
    tests: 3
    score: 8534
  - path: lib/dispatcher/client.js
    kind: source
    loc: 664
    churn: 39
    churn_w: 16.98
    fixes: 23
    authors: 14
    owner_share: 0.31
    fan_in: 8
    tests: 1
    score: 7707
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1115
    churn: 39
    churn_w: 12.69
    fixes: 14
    authors: 10
    owner_share: 0.46
    fan_in: 8
    tests: 2
    score: 6914
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 756
    churn: 43
    churn_w: 19.04
    fixes: 17
    authors: 7
    owner_share: 0.60
    fan_in: 6
    tests: 0
    score: 6702
  - path: lib/core/symbols.js
    kind: source
    loc: 75
    churn: 23
    churn_w: 7.85
    fixes: 10
    authors: 12
    owner_share: 0.30
    fan_in: 24
    tests: 26
    score: 6449
  - path: lib/web/fetch/response.js
    kind: source
    loc: 641
    churn: 29
    churn_w: 12.21
    fixes: 12
    authors: 7
    owner_share: 0.52
    fan_in: 7
    tests: 1
    score: 5895
  - path: lib/web/fetch/body.js
    kind: source
    loc: 508
    churn: 36
    churn_w: 16.71
    fixes: 11
    authors: 6
    owner_share: 0.50
    fan_in: 6
    tests: 0
    score: 5816
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 5.58
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 5376
  - path: lib/core/request.js
    kind: source
    loc: 520
    churn: 49
    churn_w: 12.95
    fixes: 34
    authors: 16
    owner_share: 0.33
    fan_in: 5
    tests: 1
    score: 4944
  - path: types/dispatcher.d.ts
    kind: source
    loc: 255
    churn: 38
    churn_w: 12.05
    fixes: 15
    authors: 25
    owner_share: 0.18
    fan_in: 6
    tests: 0
    score: 4484
  - path: lib/web/websocket/util.js
    kind: source
    loc: 347
    churn: 26
    churn_w: 8.55
    fixes: 7
    authors: 6
    owner_share: 0.50
    fan_in: 7
    tests: 2
    score: 4385
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
    coupling: 42
  - files: [lib/web/fetch/index.js, lib/web/fetch/util.js]
    count: 15
    coupling: 38
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 13
    coupling: 57
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 13
    coupling: 52
  - files: [index.js, types/index.d.ts]
    count: 12
    coupling: 55
  - files: [lib/dispatcher/client-h1.js, lib/dispatcher/client.js]
    count: 12
    coupling: 34
  - files: [lib/web/fetch/formdata.js, lib/web/fetch/request.js]
    count: 10
    coupling: 67
seams:
  - dirs: [docs/docs, types]
    count: 46
    coupling: 39
  - dirs: [lib/interceptor, lib/util]
    count: 14
    coupling: 42
  - dirs: [lib/util, types]
    count: 12
    coupling: 36
  - dirs: [docs/docs, docs/docsify]
    count: 11
    coupling: 92
  - dirs: [lib/cache, types]
    count: 11
    coupling: 35
blind_spots:
  - "2 submodules not analyzed: test/web-platform-tests/wpt, test/fixtures/cache-tests"
  - "3 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "7 credential shaped paths left out of every list so a committed map never names them"
  - "dependencies not resolved for 3 .c, 1 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers: the HTTP core (`lib/core`, `lib/dispatcher`), which owns URL parsing, header normalization, socket lifecycle and the error taxonomy, and the spec layer under `lib/web`, which implements fetch, WebSocket and WebIDL conversions against living standards. Thirteen files hold half the total score, and the same files keep absorbing bug fixes: `lib/core/util.js` (37 fixes in 80 commits), `lib/core/request.js` (34 in 49) and `lib/web/fetch/index.js` (27 in 58). No file qualifies as load-bearing — everything many files depend on is also edited regularly, so there is no quiet floor to rely on. Ownership splits by area: `lib/core/util.js` and `types/dispatcher.d.ts` take drive-by edits from many hands (22 and 25 authors, owner shares 0.24 and 0.18), while `lib/web/websocket` is concentrated in one or two committers (owner shares 0.60 to 0.74). The map does not cover the `test/web-platform-tests/wpt` and `test/fixtures/cache-tests` submodules, so real spec coverage is larger than the `tests` counts suggest, and the llhttp C sources have undercounted fan-in.

## Why these files are hot

`lib/core/util.js` is the shared toolbox: URL and origin parsing, port and token validation, header name lowercasing via `tree.lookup`, body wrapping and length detection, stream destruction, abort listeners and handler assertions. Forty-five files import it and 37 of its 80 commits were fixes, because each helper is a validation boundary where a missed edge case becomes a CVE-shaped bug or a behavior change for every dispatcher path. An edit here reaches request construction, connection setup and the fetch layer at once. Before editing this file, run `test/util.js`, `test/node-test/util.js` and `test/fetch/formdata.js`, and keep the exported helper signatures and thrown `InvalidArgumentError` messages unchanged.

`lib/web/fetch/util.js` holds the fetch algorithm primitives: redirect location resolution, referrer policy parsing and computation, origin headers, trustworthy-URL checks, range headers, MIME extraction, the inflate stream and the iterator mixin. Nineteen of its 40 commits were fixes, typical of code that tracks spec revisions step by numbered step. It backs `lib/web/cache`, `lib/web/eventsource`, `lib/web/websocket` and the fetch core, so a changed return shape silently alters several web APIs. Before editing this file, run `test/fetch/util.js` and `test/fetch/includes-credentials.js`, and keep each function's spec step comments aligned with the code you change.

`lib/web/fetch/index.js` is the 2391-line fetch driver: the `Fetch` controller, abort and terminate paths, scheme fetch, redirect handling, caching, authentication and response finalization. It is the most weighted-churn file in the repository (30.62) with 27 fixes, because every spec update and every abort or streaming bug lands in these state transitions. Only `test/mock-interceptor.js` reaches it in this analysis; its real coverage lives in the unanalyzed WPT submodule. Before editing this file, open `lib/web/fetch/response.js` and `lib/web/fetch/body.js` alongside it and verify abort and redirect behavior against the fetch spec steps quoted in the comments rather than trusting unit tests.

`lib/core/errors.js` defines the public error taxonomy — every class extends `UndiciError` and carries a stable `code` plus a `Symbol.for('undici.error.…')` `hasInstance` brand so cross-realm and cross-copy `instanceof` keeps working. Thirty-five files import it and 15 test files assert on it, which is why it changes rarely (15 commits) but breaks loudly. Before editing this file, run `test/errors.js` and preserve the `code` string, the `name`, and the symbol brand on any class you touch; adding a class means adding both the symbol and the `module.exports` entry.

`lib/web/webidl/index.js` implements the WebIDL conversion and brand-check machinery used by 17 files across fetch, cache, cookies, EventSource and WebSocket. It is comparatively stable (11 commits, 5 fixes) but centrally positioned: a change to `brandCheck`, `argumentLengthCheck` or a converter changes the `TypeError` messages that web-facing tests assert on everywhere. Before editing this file, run `test/webidl/converters.js`, `test/webidl/helpers.js` and `test/webidl/util.js`, and keep error message wording identical unless the spec text changed.

## Change coupling

The fetch classes move as one unit: `request.js` with `response.js` (66%), `formdata.js` with `request.js` (67%), and `body.js` with `index.js` (42%). This is by design — they share body extraction, header lists and internal-state accessors. When you change one, open the others and check that state getters and `extractBody` callers still agree.

The WebSocket files are a tighter cluster still: `receiver.js` with `util.js` (62%) and with `websocket.js` (52%), and `connection.js` with `websocket.js` (57%). Frame parsing, opcode validation and close handling are split across files that all reach into the same connection state. When you touch frame or close handling, read all four before committing.

`lib/handler/cache-handler.js` and `lib/interceptor/cache.js` co-change at 52%: the handler writes cache entries and the interceptor reads them, so the store contract lives between them. Change one side and update the other plus `types/cache-interceptor.d.ts` in the same commit.

`index.js` with `types/index.d.ts` (55%) and the `docs/docs` ↔ `types` seam (46 commits, 39%) show that the public surface is maintained in three places at once: runtime exports, type declarations and reference docs. Any new export needs all three. The `docs/docs` ↔ `docs/docsify` seam at 92% is the sidebar following new pages; add a doc page and add its sidebar entry.

`lib/dispatcher/client-h1.js` with `client.js` at 34% is weaker and partly decay: HTTP/1-specific concerns leak into the shared client. When a change needs both, prefer pushing the protocol detail into `client-h1.js` or `client-h2.js` rather than widening `client.js`.

## What to read first

1. `lib/core/symbols.js` — 75 lines, 24 dependents; the private-state keys every other core file uses.
2. `lib/core/errors.js` — the error taxonomy and its symbol brands, which define the public failure contract.
3. `lib/core/util.js` — the shared validation and stream helpers all dispatcher and fetch code sits on.
4. `lib/dispatcher/client.js` with `lib/core/request.js` — the request lifecycle and socket state machine, and the pair with the highest fix density in the core.
5. `lib/web/webidl/index.js` — the conversion and brand-check layer that shapes every web-facing error.
6. `lib/web/fetch/index.js` — the fetch driver, read last because it assumes all of the above.
7. `types/dispatcher.d.ts` and `types/index.d.ts` — the declared public API that must move with any export change.
