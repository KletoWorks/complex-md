---
complex_md: "0.3"
generated: 2025-12-14
commit: 970c5758
tool: complex-md/bench
window_commits: 2000
files_analyzed: 48
profile:
  files_total: 385
  files_in_scope: 48
  loc_in_scope: 9851
  kinds: "test 223, docs 52, source 47, ci 25, example 18, generated 9, other 8, asset 1, manifest 1, config 1"
  languages: "js 31, ts 16, json 1"
  dependency_edges: 359
  commits_total: 4153
  commits_analyzed: 1787
  commits_skipped: 213
  half_life_commits: 500
  window_from: 2020-10-15
  window_to: 2025-12-14
  velocity_30d: 31.8
  authors_total: 598
  concentration_50: 4
  hotspot_cut: 6
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 976
    churn: 213
    churn_w: 65.73
    fixes: 50
    authors: 68
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12339
  - path: lib/errors.js
    kind: source
    loc: 505
    churn: 43
    churn_w: 13.20
    fixes: 17
    authors: 33
    owner_share: 0.09
    fan_in: 16
    tests: 10
    score: 9359
  - path: lib/symbols.js
    kind: source
    loc: 67
    churn: 27
    churn_w: 6.45
    fixes: 12
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 26
    score: 4946
  - path: lib/reply.js
    kind: source
    loc: 944
    churn: 89
    churn_w: 24.24
    fixes: 36
    authors: 47
    owner_share: 0.15
    fan_in: 3
    tests: 13
    score: 4788
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 20
    churn_w: 4.87
    fixes: 8
    authors: 17
    owner_share: 0.15
    fan_in: 7
    tests: 3
    score: 3502
  - path: lib/request.js
    kind: source
    loc: 374
    churn: 43
    churn_w: 15.26
    fixes: 14
    authors: 25
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3303
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 41
    coupling: 45
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 21
    coupling: 64
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 21
    coupling: 51
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 20
    coupling: 57
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 38
  - files: [lib/reply.js, lib/request.js]
    count: 17
    coupling: 40
  - files: [lib/route.js, lib/symbols.js]
    count: 15
    coupling: 56
  - files: [docs/Reference/Reply.md, lib/reply.js]
    count: 15
    coupling: 34
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 52
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the instance factory and the request lifecycle: `fastify.js`, `lib/reply.js`, `lib/request.js` and `lib/route.js` carry the public API surface, the per-request state machine and the routing table, and four files hold half the total score. A second cluster is the shared vocabulary every module imports: `lib/errors.js` (fan-in 16) and `lib/symbols.js` (fan-in 19) are small and quiet per line but reach almost everything under `lib/`. Bug fixes land overwhelmingly in `fastify.js` (50 fixes of 213 commits), `lib/route.js` (42 of 92) and `lib/reply.js` (36 of 89); `types/instance.d.ts` follows with 35. No file qualified as load-bearing-and-untouched — the floor here is also actively edited. With 598 committer identities, ownership is broad everywhere except `fastify.js`, where one committer holds 46% of commits, so a change there is likely to meet a maintainer with strong opinions. The analysis skips 9 generated or lock files and omits one credential-shaped path from every list.

## Why these files are hot

`fastify.js` builds the instance object: it wires Avvio, the router, the 404 handler, the HTTP server, hooks, schema controller, decorators and every shorthand route method, and it exposes them as one literal plus a block of `Object.defineProperties` getters. Every new option, hook name or public method passes through it, which is why it leads both churn and fixes. Its dependents are few but central (`lib/route.js`, `lib/logger-factory.js`, `types/instance.d.ts`, `types/register.d.ts`), and 63 test files reach it. Before editing this file, confirm whether your change adds a public surface — if so, mirror it in `types/instance.d.ts` and `fastify.d.ts` in the same commit, and run the option-validation tests through `lib/initial-config-validation.js`.

`lib/errors.js` is the single registry of `FST_ERR_*` codes built with `@fastify/error`, each pinning a code string, a message template and a status. 16 files import from it, and callers destructure specific names, so renaming or removing a code breaks them silently at require time. Message strings and status codes are observable behavior for users matching on them. Before editing this file, treat the code name, its `%s` placeholder count and its status code as a public contract, add new codes rather than repurposing old ones, and update `docs/Reference/Errors.md` alongside.

`lib/symbols.js` is 67 lines of `Symbol()` keys naming every piece of hidden instance, request and reply state, imported by 19 files. It has 12 fixes across 27 commits: mistakes here are usually a symbol read under one name and written under another. Before editing this file, only append keys — grep the repo for a symbol's name before renaming or deleting it, since it may be set in one module and read in another.

`lib/reply.js` owns response serialization, headers, trailers, status codes, streams, `Response` objects and the onSend/preSerialization/onError hook chains, and 36 of its 89 commits were fixes — the ordering of send paths is easy to get subtly wrong. Coverage runs through `test/diagnostics-channel/*.test.js` among 13 test files. Before editing this file, trace the full `send` path for the payload type you touch and check that content-type defaulting and the `sent`/hijacked guards still hold.

`lib/hooks.js` defines the supported hook names and the runners that execute them, and 7 files depend on it, including `lib/reply.js`, `lib/route.js` and `lib/handle-request.js`. Only 3 test files reach it, so its runners are mostly exercised indirectly. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and keep the callback-and-promise dual dispatch in every runner — each one accepts both a `done` callback and a returned thenable.

## Change coupling

`fastify.js` and `lib/route.js` share 41 commits (45%): routing is constructed in one and implemented in the other, and `lib/route.js` has 42 fixes with no test files of its own. Open both when changing route options, method support or the router build, and verify through route tests rather than a unit test. `fastify.js` and `lib/symbols.js` (52%), and `lib/route.js` and `lib/symbols.js` (56%), move together because new instance or route state needs a new key — add the symbol in the same commit as its reader and writer. `lib/reply.js` and `lib/request.js` (40%) are the two halves of the per-request pair; when you add state to one, check whether the other's getters expose it. Documentation tracks code closely: `docs/Reference/Warnings.md` with `lib/warnings.js` at 82%, and `docs/Reference/Errors.md` with `lib/errors.js` at 57%. Update the doc in the commit that changes the code. The type declarations form their own cluster — `types/instance.d.ts` with `types/hooks.d.ts` (64%) and with `types/route.d.ts` (51%) — because a hook or route signature change ripples through all three; edit them as one unit.

## What to read first

1. `lib/symbols.js` — the names of all hidden state; nothing else under `lib/` makes sense without it.
2. `lib/errors.js` — the error vocabulary 16 modules import and throw.
3. `fastify.js` — the instance factory and the whole public API in one object literal.
4. `lib/route.js` — route registration and the per-route context, coupled to `fastify.js` and untested on its own.
5. `lib/hooks.js` — hook names and the runner contract shared by reply, request and route.
6. `lib/reply.js` — the response path where a third of commits are fixes.
7. `types/instance.d.ts` — the typed mirror of `fastify.js`; check it before claiming an API change is complete.
