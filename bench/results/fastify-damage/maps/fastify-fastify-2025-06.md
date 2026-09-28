---
complex_md: "0.3"
generated: 2025-06-23
commit: e0315b9d
tool: complex-md/bench
window_commits: 2000
files_analyzed: 46
profile:
  files_total: 384
  files_in_scope: 46
  loc_in_scope: 9592
  kinds: "test 222, docs 52, source 45, ci 27, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 29, ts 16, json 1"
  dependency_edges: 350
  commits_total: 4049
  commits_analyzed: 1795
  commits_skipped: 205
  half_life_commits: 500
  window_from: 2020-07-30
  window_to: 2025-06-23
  velocity_30d: 33.5
  authors_total: 595
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 962
    churn: 208
    churn_w: 62.53
    fixes: 51
    authors: 67
    owner_share: 0.47
    fan_in: 5
    tests: 62
    score: 10612
  - path: lib/errors.js
    kind: source
    loc: 500
    churn: 43
    churn_w: 14.28
    fixes: 17
    authors: 34
    owner_share: 0.07
    fan_in: 16
    tests: 10
    score: 9627
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 86
    churn_w: 23.74
    fixes: 36
    authors: 47
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4759
  - path: lib/symbols.js
    kind: source
    loc: 66
    churn: 28
    churn_w: 6.51
    fixes: 12
    authors: 15
    owner_share: 0.14
    fan_in: 17
    tests: 24
    score: 4582
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 5.61
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3740
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 46
    churn_w: 16.78
    fixes: 15
    authors: 29
    owner_share: 0.13
    fan_in: 3
    tests: 12
    score: 3421
  - path: lib/warnings.js
    kind: source
    loc: 47
    churn: 36
    churn_w: 15.24
    fixes: 10
    authors: 22
    owner_share: 0.17
    fan_in: 4
    tests: 2
    score: 2575
  - path: lib/contentTypeParser.js
    kind: source
    loc: 409
    churn: 45
    churn_w: 14.25
    fixes: 21
    authors: 26
    owner_share: 0.18
    fan_in: 2
    tests: 1
    score: 2447
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 38
    coupling: 41
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 23
    coupling: 59
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 23
    coupling: 52
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 19
    coupling: 56
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 39
  - files: [lib/route.js, lib/symbols.js]
    count: 16
    coupling: 57
  - files: [types/hooks.d.ts, types/route.d.ts]
    count: 15
    coupling: 38
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 36
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 35
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 50
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: the instance factory (`fastify.js`), the reply and request objects (`lib/reply.js`, `lib/request.js`), the router (`lib/route.js`), and the two shared vocabularies everything else imports, `lib/errors.js` and `lib/symbols.js`. Five files hold half the total score, so most change lands in a small core while 222 test files sit around it. Bug fixes cluster in `fastify.js` (51 fixes of 208 commits), `lib/route.js` (44 of 92) and `lib/reply.js` (36 of 86); `lib/contentTypeParser.js` is fix-heavy for its size at 21 of 45. No file qualified as load-bearing-and-untouched: the high fan-in files (`lib/symbols.js` at 17, `lib/errors.js` at 16) are also actively edited. Ownership is diffuse across 595 committers — `lib/errors.js` (0.07) and `lib/route.js` (0.09) have no owner, while `fastify.js` is the one file with a dominant committer at 0.47. Two hot files are thinly covered: `lib/contentTypeParser.js` has 1 covering test and `lib/route.js` has 0.

## Why these files are hot

`fastify.js` is the instance factory: it validates every server option, wires the router, logger, 404 handler, schema controller and content-type parser onto one object keyed by symbols, and exposes the public API (route shorthands, `addHook`, `setErrorHandler`, `inject`, `ready`, `listen`). It changes because every new option or instance method lands here, and a quarter of those commits were fixes. Five files depend on it, including `lib/route.js`, and 62 test files reach it. Before editing this file, open `lib/symbols.js` and `lib/route.js` alongside it and run the covering suites for the area you touch (`test/async-dispose.test.js`, `test/custom-parser.*.test.js`, `test/constrained-routes.test.js`).

`lib/errors.js` is the error-code registry: roughly 130 `createError` definitions grouped by subsystem, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. Sixteen files import it, so a renamed or removed code is a breaking change for users who match on `err.code`, not an internal refactor. Before editing this file, keep existing codes and messages stable, add rather than repurpose, and update `docs/Reference/Errors.md` in the same commit; verify with `test/internals/errors.test.js`.

`lib/reply.js` carries the whole response path: header and trailer handling, status codes, serializer compilation and caching, the `onSend`/`preSerialization`/`onError`/`onResponse` hook wiring, and the stream, web-stream and `Response` send branches. It is 944 lines with 36 fixes in 86 commits — the branching in `send` and `onSendEnd` is where regressions appear. Before editing this file, trace the payload type your change affects through `send` → `preSerializationHook` → `onSendHook` → `onSendEnd`, and run the `test/diagnostics-channel/*.test.js` suite, which exercises the hook ordering end to end.

`lib/symbols.js` is 66 lines of `Symbol` keys and the most depended-on file here (fan_in 17, 24 covering tests). It is hot because every new piece of internal state adds a key; 12 of its 28 commits were fixes, which for a key list means state that was added, moved or removed elsewhere. Before editing this file, add keys rather than rename them, and grep the repo for any key you remove — the consumers are spread across `lib/` and the test helpers.

`lib/hooks.js` defines the supported hook names and the runners that drive them, including `hookRunnerApplication` for boot hooks and the per-request generators. Seven files depend on it and only 3 test files cover it, so its blast radius exceeds its test surface. Before editing this file, preserve the `lifecycleHooks` and `applicationHooks` ordering and the error-shape contract (a rejected hook without an error becomes `FST_ERR_SEND_UNDEFINED_ERR`), and run `test/internals/hooks.test.js` and `test/internals/hook-runner.test.js`.

## Change coupling

`fastify.js`, `lib/route.js` and `lib/symbols.js` form one cluster (41%, 57%, 50%): route registration reads instance state through symbol keys, so a new route option usually needs a key, a factory default and router handling. Open all three when changing route or instance state, and note `lib/route.js` has no covering tests of its own. The type surface moves as a unit — `types/hooks.d.ts` with `types/instance.d.ts` at 59%, `types/instance.d.ts` with `types/route.d.ts` at 52%, `types/hooks.d.ts` with `types/route.d.ts` at 38% — because the declarations are hand-maintained beside the JavaScript and none of them carry tests. When you add a public method or hook, update all three declaration files in the same commit and add a case under `test/types/`. Docs are part of the contract, not commentary: `docs/Reference/Errors.md` tracks `lib/errors.js` at 56% and `docs/Reference/Reply.md` tracks `lib/reply.js` at 36%. Edit the matching doc page in the same commit as the behaviour change. `lib/reply.js` and `lib/request.js` co-change at 39% because both hang off the same route context and symbol keys; when you change one side's context access, check the other for the same key. `fastify.js` with `lib/errors.js` at 35% is the ordinary consequence of new option validation needing a new code — no action beyond the errors-and-docs rule above. No directory seams were detected.

## What to read first

1. `lib/symbols.js` — the 66-line key list that names every piece of internal state; it makes the rest of `lib/` legible.
2. `fastify.js` — the instance factory and public API; shows how options, router, hooks and parsers are assembled.
3. `lib/errors.js` — the error-code contract 16 files import and users match on.
4. `lib/hooks.js` — hook names and runners; the ordering the request path depends on.
5. `lib/reply.js` — the response and serialization path, and the largest concentration of branching.
6. `lib/route.js` — route registration, 44 fixes and no covering tests, so read it before trusting a change there.
7. `docs/Reference/Errors.md` and `docs/Reference/Reply.md` — the documented behaviour these two hot files are expected to match.
