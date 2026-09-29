---
complex_md: "0.3"
generated: 2026-09-04
commit: 6d583124
tool: complex-md/bench
window_commits: 2000
files_analyzed: 203
profile:
  files_total: 809
  files_in_scope: 203
  loc_in_scope: 54989
  kinds: "test 489, source 203, docs 64, ci 14, data 12, example 11, other 8, generated 4, manifest 2, asset 2"
  languages: "js 116, ts 48, mjs 34, c 3, h 1, sh 1"
  dependency_edges: 853
  commits_total: 4194
  commits_analyzed: 1789
  commits_skipped: 211
  half_life_commits: 500
  window_from: 2023-05-15
  window_to: 2026-09-04
  velocity_30d: 49.7
  authors_total: 263
  concentration_50: 15
  hotspot_cut: 15
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: lib/core/util.js
    kind: source
    loc: 1049
    churn: 75
    churn_w: 20.18
    fixes: 35
    authors: 16
    owner_share: 0.25
    fan_in: 47
    tests: 3
    score: 22051
  - path: lib/web/fetch/util.js
    kind: source
    loc: 1525
    churn: 41
    churn_w: 10.10
    fixes: 20
    authors: 7
    owner_share: 0.44
    fan_in: 17
    tests: 3
    score: 10479
  - path: lib/core/errors.js
    kind: source
    loc: 497
    churn: 15
    churn_w: 4.99
    fixes: 9
    authors: 9
    owner_share: 0.27
    fan_in: 36
    tests: 17
    score: 9334
  - path: lib/web/fetch/index.js
    kind: source
    loc: 2432
    churn: 65
    churn_w: 23.50
    fixes: 32
    authors: 15
    owner_share: 0.37
    fan_in: 6
    tests: 1
    score: 9130
  - path: lib/dispatcher/client.js
    kind: source
    loc: 741
    churn: 46
    churn_w: 15.79
    fixes: 29
    authors: 17
    owner_share: 0.26
    fan_in: 8
    tests: 1
    score: 7725
  - path: lib/web/webidl/index.js
    kind: source
    loc: 1004
    churn: 12
    churn_w: 5.72
    fixes: 5
    authors: 6
    owner_share: 0.42
    fan_in: 17
    tests: 3
    score: 7203
  - path: lib/core/symbols.js
    kind: source
    loc: 79
    churn: 21
    churn_w: 6.97
    fixes: 10
    authors: 10
    owner_share: 0.33
    fan_in: 31
    tests: 35
    score: 7069
  - path: lib/web/fetch/request.js
    kind: source
    loc: 1144
    churn: 42
    churn_w: 10.04
    fixes: 15
    authors: 12
    owner_share: 0.45
    fan_in: 8
    tests: 2
    score: 6185
  - path: lib/web/websocket/websocket.js
    kind: source
    loc: 780
    churn: 45
    churn_w: 13.03
    fixes: 18
    authors: 8
    owner_share: 0.58
    fan_in: 6
    tests: 0
    score: 5616
  - path: lib/util/cache.js
    kind: source
    loc: 758
    churn: 29
    churn_w: 12.79
    fixes: 19
    authors: 10
    owner_share: 0.24
    fan_in: 5
    tests: 7
    score: 5231
  - path: lib/web/fetch/body.js
    kind: source
    loc: 547
    churn: 39
    churn_w: 12.28
    fixes: 11
    authors: 6
    owner_share: 0.54
    fan_in: 6
    tests: 0
    score: 5004
  - path: lib/web/fetch/response.js
    kind: source
    loc: 639
    churn: 30
    churn_w: 8.13
    fixes: 13
    authors: 8
    owner_share: 0.50
    fan_in: 7
    tests: 1
    score: 4898
  - path: lib/core/request.js
    kind: source
    loc: 546
    churn: 41
    churn_w: 10.27
    fixes: 31
    authors: 12
    owner_share: 0.27
    fan_in: 5
    tests: 2
    score: 4523
  - path: lib/web/fetch/headers.js
    kind: source
    loc: 719
    churn: 19
    churn_w: 3.33
    fixes: 8
    authors: 5
    owner_share: 0.47
    fan_in: 11
    tests: 5
    score: 4247
  - path: types/dispatcher.d.ts
    kind: source
    loc: 253
    churn: 36
    churn_w: 10.46
    fixes: 15
    authors: 23
    owner_share: 0.17
    fan_in: 6
    tests: 0
    score: 4195
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
    coupling: 35
  - files: [lib/handler/cache-handler.js, lib/interceptor/cache.js]
    count: 15
    coupling: 50
  - files: [lib/web/fetch/body.js, lib/web/fetch/index.js]
    count: 15
    coupling: 38
  - files: [lib/web/fetch/index.js, lib/web/fetch/util.js]
    count: 15
    coupling: 37
  - files: [lib/core/request.js, lib/core/util.js]
    count: 14
    coupling: 34
  - files: [lib/web/websocket/connection.js, lib/web/websocket/websocket.js]
    count: 13
    coupling: 57
  - files: [index.js, types/index.d.ts]
    count: 12
    coupling: 55
seams:
  - dirs: [docs/docs, types]
    count: 60
    coupling: 39
  - dirs: [lib/interceptor, lib/util]
    count: 17
    coupling: 43
blind_spots:
  - "2 submodules not analyzed: test/web-platform-tests/wpt, test/fixtures/cache-tests"
  - "4 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "8 credential shaped paths left out of every list so a committed map never names them"
  - "dependencies not resolved for 3 .c, 1 .h files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Risk concentrates in two layers that everything else sits on: the core dispatcher plumbing under `lib/core/` and `lib/dispatcher/`, and the WHATWG spec implementations under `lib/web/fetch/` and `lib/web/websocket/`. The core layer is shared infrastructure — URL parsing, body handling, header normalization, error classes, and internal symbols — so a change there reaches nearly every request path. The web layer is spec-conformance code where correctness is defined by an external standard, and most edits there are bug fixes chasing spec or platform behavior. Bug fixes land heaviest in `lib/core/util.js` (35 fixes), `lib/web/fetch/index.js` (32) and `lib/core/request.js` (31); `lib/dispatcher/client.js` (29) is close behind. No load-bearing files were found: everything with high fan-in is also actively changed. Ownership is diffuse — 263 committers and no hotspot above a 0.58 owner share — so there is no single person's convention to match; follow the file's existing idiom instead. Two test submodules (`test/web-platform-tests/wpt`, `test/fixtures/cache-tests`) are not analyzed here, so spec conformance coverage is larger than the `tests` numbers suggest.

## Why these files are hot

`lib/core/util.js` is the shared toolbox: URL and origin parsing, stream and body detection, header name lowercasing, listener management and request-handler validation. 47 files depend on it and 35 of its 75 commits were fixes, because every new edge case in URL validation or body typing lands here first. An edit to `parseURL`, `bodyLength` or `parseHeaders` changes behavior for every dispatcher, interceptor and API wrapper at once. Before editing this file, run `test/util.js` and `test/node-test/util.js`, and check the validation branches in `parseURL` still throw `InvalidArgumentError` for the same inputs.

`lib/web/fetch/util.js` holds the fetch spec's helper algorithms: referrer policy, origin headers, trustworthy-URL checks, range parsing, MIME extraction and the inflate stream. It keeps changing (20 fixes in 41 commits) because each helper tracks a moving spec section. Its dependents include `lib/web/cache/`, `lib/web/eventsource/` and the websocket layer, so a helper change leaks well past fetch. Before editing this file, run `test/fetch/util.js` and keep the spec step comments aligned with the code you change — they are the only record of which algorithm a function implements.

`lib/core/errors.js` defines the public error taxonomy. Every class carries a `Symbol.for('undici.error.…')` brand and a `static [Symbol.hasInstance]` so `instanceof` works across duplicated copies of undici. 36 files import it, and 17 test files assert on it. Adding or renaming an error changes a public contract users match on by `code`. Before editing this file, run `test/errors.js` and preserve both the brand symbol and the `code` string on any class you touch; add a new class rather than repurposing an existing one.

`lib/web/fetch/index.js` is the fetch algorithm itself — 2432 lines covering the `fetch()` entry point, redirect handling, caching, auth and body finalization. Half its commits are fixes (32 of 65), and only `test/mock-interceptor.js` reaches it in the analyzed tree; the real coverage lives in the unanalyzed WPT submodule. It is imported by `index.js`, the cache, eventsource and websocket connection paths, so a regression here surfaces as a protocol bug elsewhere. Before editing this file, run the web-platform-tests suite rather than relying on the one covering test, and keep the abort-listener cleanup path (`cleanupAbortListeners`) intact on every exit branch.

`lib/dispatcher/client.js` owns connection lifecycle: option validation, h1/h2 context selection, pipelining and concurrency ceilings, and the queue. 29 of its 46 commits were fixes, and it moves with `lib/dispatcher/client-h2.js` in 16 commits. Option names here are public API — the constructor rejects legacy ones like `keepAlive` and `socketTimeout` with `InvalidArgumentError`. Before editing this file, open `lib/dispatcher/client-h1.js` and `lib/dispatcher/client-h2.js` alongside it and confirm any new option is threaded through both protocol paths.

## Change coupling

`lib/web/fetch/request.js` and `lib/web/fetch/response.js` move together in 63% of the quieter file's commits, and `lib/web/fetch/body.js` moves with `lib/web/fetch/index.js` (38%) and `lib/web/fetch/util.js` with `index.js` (37%). This is coupling by design: the four files implement one spec, and body extraction, header lists and the fetch algorithm share invariants. When you change body or header handling in one, open the other three and check the same spec step.

The websocket cluster is tighter still — `receiver.js` with `util.js` (62%), `receiver.js` with `websocket.js` (50%), `connection.js` with `websocket.js` (57%) — because frame parsing, the handshake and the public object share state and close semantics. When you touch frame or close handling, open `lib/web/websocket/receiver.js`, `connection.js` and `websocket.js` together; `websocket.js` has no covering test in the analyzed tree, so verify by running the websocket WPT suite.

`lib/dispatcher/client-h2.js` and `lib/dispatcher/client.js` (35%) reflect the protocol split leaking into the shared client: h2-specific options and stream ceilings live in both. When adding an option, add it in `client.js` and wire the h2 branch in the same change rather than letting the two drift.

`lib/handler/cache-handler.js` and `lib/interceptor/cache.js` (50%), and the wider `lib/interceptor` ↔ `lib/util` seam (43%), show cache store state shared across the handler, interceptor and `lib/util/cache.js`. When you change cache key or store semantics, check all three and move the shared logic into `lib/util/cache.js` rather than duplicating it.

`index.js` with `types/index.d.ts` (55%) and the `docs/docs` ↔ `types` seam (39%) are the public surface: every export change needs its type and its doc page. When you add or change an export, update the `.d.ts` and the matching page under `docs/docs` in the same commit.

## What to read first

1. `lib/core/symbols.js` — 79 lines naming the internal state keys 31 files read; read it before any dispatcher work or the field names elsewhere are opaque.
2. `lib/core/errors.js` — the error taxonomy and the `Symbol.hasInstance` branding pattern that makes `instanceof` work across copies.
3. `lib/core/util.js` — the shared helpers for URLs, bodies and headers that almost every other file imports.
4. `lib/dispatcher/client.js` — the connection lifecycle and the public option contract, including which legacy options are rejected.
5. `lib/web/fetch/index.js` — the fetch algorithm, with spec step comments that explain the structure of the whole `lib/web/fetch/` directory.
6. `types/dispatcher.d.ts` — the declared shape of the dispatcher API, touched by 23 authors and the reference for what is public.
7. `lib/util/cache.js` — the cache store contract shared by the cache handler and interceptor.
