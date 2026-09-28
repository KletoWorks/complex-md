---
complex_md: "0.3"
generated: 2025-09-22
commit: 4e5a3631
tool: complex-md/bench
window_commits: 2000
files_analyzed: 47
profile:
  files_total: 384
  files_in_scope: 47
  loc_in_scope: 9675
  kinds: "test 223, docs 52, source 46, ci 25, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 30, ts 16, json 1"
  dependency_edges: 351
  commits_total: 4097
  commits_analyzed: 1793
  commits_skipped: 207
  half_life_commits: 500
  window_from: 2020-08-30
  window_to: 2025-09-22
  velocity_30d: 32.5
  authors_total: 599
  concentration_50: 5
  hotspot_cut: 8
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 963
    churn: 212
    churn_w: 63.26
    fixes: 52
    authors: 67
    owner_share: 0.46
    fan_in: 6
    tests: 62
    score: 12040
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 44
    churn_w: 14.33
    fixes: 18
    authors: 34
    owner_share: 0.09
    fan_in: 16
    tests: 10
    score: 9745
  - path: lib/reply.js
    kind: source
    loc: 942
    churn: 86
    churn_w: 23.13
    fixes: 36
    authors: 46
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4682
  - path: lib/symbols.js
    kind: source
    loc: 66
    churn: 27
    churn_w: 6.03
    fixes: 12
    authors: 14
    owner_share: 0.15
    fan_in: 18
    tests: 25
    score: 4558
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 19
    churn_w: 5.19
    fixes: 8
    authors: 16
    owner_share: 0.16
    fan_in: 7
    tests: 3
    score: 3611
  - path: lib/request.js
    kind: source
    loc: 369
    churn: 45
    churn_w: 15.63
    fixes: 15
    authors: 28
    owner_share: 0.13
    fan_in: 3
    tests: 12
    score: 3306
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 38
    churn_w: 16.22
    fixes: 11
    authors: 23
    owner_share: 0.16
    fan_in: 5
    tests: 2
    score: 3267
  - path: lib/contentTypeParser.js
    kind: source
    loc: 402
    churn: 47
    churn_w: 16.16
    fixes: 23
    authors: 25
    owner_share: 0.21
    fan_in: 2
    tests: 1
    score: 2646
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
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the request lifecycle: instance assembly in `fastify.js`, the reply and request objects in `lib/reply.js` and `lib/request.js`, body parsing in `lib/contentTypeParser.js`, and the shared vocabulary in `lib/errors.js` and `lib/symbols.js`. Five files hold half the total score, and `fastify.js` alone carries 212 commits with a weighted churn of 63.26 — four times the next file. Bug fixes land hardest in `fastify.js` (52 fixes), `lib/route.js` (42) and `lib/reply.js` (36); `lib/contentTypeParser.js` has 23 fixes against 47 commits, the highest fix ratio among the hotspots. There are no files that nobody touched and everybody depends on, but `lib/symbols.js` and `lib/errors.js` come closest in shape: 18 and 16 dependents, 66 and 505 lines, and both are edited anyway. With 599 committers, ownership is diffuse everywhere except `fastify.js`, whose top committer holds 46% — the one place where a single reviewer holds most of the context.

## Why these files are hot

`fastify.js` builds the server instance: it validates options, constructs the router, reply and request prototypes, the hook store, the schema controller and the 404 handler, then hangs the public API off one object literal keyed by symbols. Every new option, hook name, HTTP method or lifecycle change lands here, which is why 52 of its 212 commits are fixes. Six files depend on it, including `types/instance.d.ts`, so the object literal is the public surface, and 62 test files reach it. Before editing this file, confirm the symbol you touch is still declared in `lib/symbols.js` and run the option and lifecycle suites named in its coverage, starting with `test/body-limit.test.js` and `test/custom-parser.0.test.js`.

`lib/errors.js` is a flat table of `FST_ERR_*` codes built with `@fastify/error`, each with a message template and status code. It has 16 dependents — nearly every module in `lib/` imports codes from it — so a renamed code or changed message breaks callers and user-facing error assertions at once. Its 44 commits are mostly additions, with 18 fixes, and its owner share of 0.09 means no one person tracks the whole table. Before editing this file, treat existing code names, status codes and placeholder counts as frozen, add rather than rename, and run `test/internals/errors.test.js`.

`lib/reply.js` owns response serialization, headers, trailers, streams and the `onSend`/`onError`/`onResponse` hook plumbing. Its 36 fixes across 86 commits cluster where types are sniffed: streams, `Response` objects, ArrayBuffers, content-type and charset defaults in `send`. Only three files import it, but every response passes through it, and the diagnostics-channel tests are its tightest coverage. Before editing this file, open `lib/request.js` alongside it and run the `test/diagnostics-channel/` suite plus the reply tests to check the send-once and hijack invariants still hold.

`lib/symbols.js` is 66 lines of `Symbol()` keys and the widest dependency in the tree with 18 dependents and 25 covering tests. Its 12 fixes are renames and additions that had to be applied in every consumer at once. Before editing this file, grep the repo for the symbol name and update all consumers in the same commit; never remove a key without checking `lib/route.js` and `lib/reply.js`.

`lib/hooks.js` defines the supported hook names and the runner generators that drive them, including the application-boot runner used by `fastify.js`. It changes rarely (19 commits, 8 fixes) but only three test files cover it, so regressions surface indirectly through lifecycle tests. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and keep the `supportedHooks` export in sync with `types/hooks.d.ts`.

## Change coupling

The instance-assembly cluster is coupled by design: `fastify.js` moves with `lib/route.js` (43%), `lib/server.js` (35%) and `lib/errors.js` (34%), and `lib/route.js` moves with `lib/symbols.js` (59%). Adding a route option or method means a symbol, a route-store field and an error code. When you change one, open `lib/route.js` and `lib/symbols.js` together and check the new field reaches the route store.

The type declarations move as a block: `types/instance.d.ts` with `types/hooks.d.ts` (61%) and with `types/route.d.ts` (51%). These mirror runtime shapes by hand. When you change a hook name or route option in `lib/`, update all three declaration files in the same commit.

Docs track code closely: `docs/Reference/Warnings.md` with `lib/warnings.js` at 82%, `docs/Reference/Errors.md` with `lib/errors.js` at 57%, `docs/Reference/Reply.md` with `lib/reply.js` at 35%. The codes and warnings are documented API. When you add a code or warning, add its row to the matching reference page in the same change.

`lib/reply.js` and `lib/request.js` co-change at 38% because reply reads request state through shared symbols. Read both before changing either's symbol-backed properties.

## What to read first

1. `lib/symbols.js` — the shared key vocabulary every other module uses.
2. `fastify.js` — the instance object literal that defines the public API and wires every subsystem.
3. `lib/errors.js` — the frozen error-code table 16 files import.
4. `lib/hooks.js` — the hook names and runners that define request lifecycle order.
5. `lib/reply.js` with `lib/request.js` — the response and request pair that carries most fixes after the entry point.
6. `lib/route.js` — highest fix count after `fastify.js` (42) and coupled to both the entry point and symbols.
7. `types/instance.d.ts` — the declaration that must follow any change to the instance surface.
