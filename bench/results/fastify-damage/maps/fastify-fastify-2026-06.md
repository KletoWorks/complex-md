---
complex_md: "0.3"
generated: 2026-06-28
commit: 6e6be153
tool: complex-md/bench
window_commits: 2000
files_analyzed: 49
profile:
  files_total: 391
  files_in_scope: 49
  loc_in_scope: 10562
  kinds: "test 228, docs 52, source 49, ci 24, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 33, ts 16"
  dependency_edges: 372
  commits_total: 4323
  commits_analyzed: 1839
  commits_skipped: 161
  half_life_commits: 500
  window_from: 2021-03-08
  window_to: 2026-06-28
  velocity_30d: 31
  authors_total: 594
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1014
    churn: 219
    churn_w: 66.07
    fixes: 51
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12518
  - path: lib/errors.js
    kind: source
    loc: 531
    churn: 45
    churn_w: 14.83
    fixes: 19
    authors: 33
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 10583
  - path: lib/symbols.js
    kind: source
    loc: 73
    churn: 27
    churn_w: 7.66
    fixes: 11
    authors: 15
    owner_share: 0.15
    fan_in: 19
    tests: 29
    score: 5569
  - path: lib/reply.js
    kind: source
    loc: 1084
    churn: 91
    churn_w: 26.44
    fixes: 38
    authors: 46
    owner_share: 0.20
    fan_in: 3
    tests: 14
    score: 5145
  - path: lib/request.js
    kind: source
    loc: 396
    churn: 47
    churn_w: 18.28
    fixes: 19
    authors: 26
    owner_share: 0.15
    fan_in: 3
    tests: 15
    score: 3740
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 17
    churn_w: 3.68
    fixes: 7
    authors: 14
    owner_share: 0.18
    fan_in: 7
    tests: 3
    score: 3087
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.58
    fixes: 11
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 3062
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 24
    coupling: 59
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 38
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 37
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 15
    coupling: 71
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 15
    coupling: 43
  - files: [lib/errors.js, types/errors.d.ts]
    count: 14
    coupling: 93
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 56
  - files: [lib/reply.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle at the repository root and in `lib/`: instance construction and the public API surface (`fastify.js`), the reply serialization and send path (`lib/reply.js`), request decoration and lazy schema compilation (`lib/request.js`), and the two shared vocabularies every other module imports, `lib/errors.js` and `lib/symbols.js`. Four files hold half the total score, so most edits land in a small area. Bug fixes cluster in `fastify.js` (51 fixes), `lib/route.js` (39) and `lib/reply.js` (38); `lib/request.js` and `lib/errors.js` follow at 19 each. Nothing qualifies as load-bearing-and-untouched here: the files with the widest fan-in, `lib/symbols.js` (19 dependents) and `lib/errors.js` (17), are also actively changed. Ownership is diffuse across 594 committer identities — only `fastify.js` has a majority contributor at 0.46, and every other hotspot sits at or below 0.20, so no single reviewer holds the context. The map excludes 9 generated or lock files and one credential-shaped path.

## Why these files are hot

`fastify.js` builds the instance: it assembles the public API object, wires routing, hooks, schema controller, content-type parsers, error handler and 404 router, then defines the getters (`prefix`, `version`, `errorHandler`, `supportedMethods`) callers depend on. It changes because every new server option or public method lands here, and 51 of its 219 commits were fixes. Six files require it, including `lib/route.js` and `types/instance.d.ts`, and 63 test files reach it, so an edit that changes option processing or the shape of the returned object breaks broadly. Before editing this file, run the option and lifecycle suites that cover it (`test/async-dispose.test.js`, `test/body-limit.test.js`, `test/custom-parser.*.test.js`) and keep `processOptions` and the `kState` transitions intact.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built through `@fastify/error`, each with its message template, status code and error subclass. It changes whenever any module needs a new failure mode, which is why 17 files import it. The codes are a public contract — consumers match on `err.code` — so renaming a code or editing a message template is a breaking change, not a cleanup. Before editing this file, open `types/errors.d.ts` and `docs/Reference/Errors.md` in the same change and run `test/internals/errors.test.js`.

`lib/symbols.js` is 73 lines of `Symbol()` keys naming every internal slot on the instance, request, reply and route context. It is the widest dependency in the repo at 19 dependents, and 11 of its 27 commits were fixes, meaning slots are added and retired as internals move. Deleting or renaming a key silently breaks every reader, since symbol lookups fail as `undefined` rather than throwing. Before editing this file, grep for the symbol name across `lib/` and `fastify.js` before removing it, and add rather than repurpose existing keys.

`lib/reply.js` owns the outbound path: header and trailer handling, status codes, serializer compilation and caching, the `onSend`/`preSerialization`/`onError` hook runners, and the stream, web-stream and HTTP/2 write paths. At 1084 lines with 38 fixes in 91 commits it is the most fix-dense file here; the edge cases are aborted sockets, premature stream close and already-sent replies. Before editing this file, run the diagnostics-channel tests that cover it (`test/diagnostics-channel/*.test.js`) and preserve the `sent`/`kReplyHijacked` guards so `send` stays idempotent.

`lib/request.js` builds the per-request object, including the two prototype variants for trust-proxy on and off, the `ip`/`host`/`protocol` getters, and the lazy `WeakMap` caches for compiled validation functions. It keeps changing (19 fixes in 47 commits) because proxy header handling and validation entry points both live here. Before editing this file, check both `buildRegularRequest` and `buildRequestWithTrustProxy` — a property added to one and not the other diverges silently — and run the diagnostics-channel tests alongside `lib/reply.js`.

## Change coupling

`fastify.js` and `lib/route.js` move together in 39 commits (45%): the shorthand methods on the instance delegate straight into `router.prepareRoute`, so route options split across both. Open `lib/route.js` whenever you add or change a routing method or option in `fastify.js`. `lib/errors.js` and `types/errors.d.ts` are the tightest pair at 93% — the declaration file mirrors the registry by hand, and `docs/Reference/Errors.md` follows at 59%. Add a code in all three in one commit. `lib/warnings.js` and `docs/Reference/Warnings.md` couple at 71% for the same reason: each `FSTWRN` code is documented. `lib/reply.js` and `lib/request.js` (38%) share the route context and symbol vocabulary, and `lib/reply.js` pairs with `lib/symbols.js` at 52% because new reply state means a new slot; when you add state to either object, add the symbol first, then read it in one place. Among the types, `types/instance.d.ts` couples to `types/route.d.ts` (43%) and `types/hooks.d.ts` (56%) — the instance interface restates generics from both; when you widen a generic in one, check whether the other still compiles. The documentation pairs are by design and need no action beyond keeping them in the same commit.

## What to read first

1. `lib/symbols.js` — the vocabulary for every internal slot; nothing in `lib/` reads without it.
2. `lib/errors.js` — the public `FST_ERR_*` contract, imported by 17 files.
3. `fastify.js` — instance assembly and the public API surface, and where the most fixes land.
4. `lib/route.js` — where the routing methods on the instance actually resolve; it moves with `fastify.js` 45% of the time.
5. `lib/reply.js` — the outbound serialization and send path, the most fix-dense file in the tree.
6. `lib/request.js` — per-request construction and its two trust-proxy variants.
7. `lib/hooks.js` — the hook runners that `lib/reply.js` and the request path call into.
