---
complex_md: "0.3"
generated: 2026-02-28
commit: 8fad0727
tool: complex-md/bench
window_commits: 2000
files_analyzed: 48
profile:
  files_total: 385
  files_in_scope: 48
  loc_in_scope: 10224
  kinds: "test 224, docs 52, source 48, ci 23, example 19, generated 9, other 8, asset 1, manifest 1"
  languages: "js 32, ts 16"
  dependency_edges: 365
  commits_total: 4214
  commits_analyzed: 1806
  commits_skipped: 194
  half_life_commits: 500
  window_from: 2020-12-01
  window_to: 2026-02-28
  velocity_30d: 31.3
  authors_total: 589
  concentration_50: 4
  hotspot_cut: 7
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 985
    churn: 216
    churn_w: 67.71
    fixes: 51
    authors: 69
    owner_share: 0.46
    fan_in: 6
    tests: 63
    score: 12584
  - path: lib/errors.js
    kind: source
    loc: 516
    churn: 43
    churn_w: 13.06
    fixes: 16
    authors: 32
    owner_share: 0.09
    fan_in: 17
    tests: 10
    score: 9589
  - path: lib/symbols.js
    kind: source
    loc: 71
    churn: 26
    churn_w: 6.80
    fixes: 10
    authors: 14
    owner_share: 0.15
    fan_in: 19
    tests: 27
    score: 5070
  - path: lib/reply.js
    kind: source
    loc: 1030
    churn: 87
    churn_w: 24.88
    fixes: 34
    authors: 45
    owner_share: 0.17
    fan_in: 3
    tests: 13
    score: 4868
  - path: lib/hooks.js
    kind: source
    loc: 429
    churn: 18
    churn_w: 4.35
    fixes: 8
    authors: 15
    owner_share: 0.17
    fan_in: 7
    tests: 3
    score: 3333
  - path: lib/request.js
    kind: source
    loc: 391
    churn: 43
    churn_w: 14.96
    fixes: 14
    authors: 25
    owner_share: 0.14
    fan_in: 3
    tests: 12
    score: 3281
  - path: lib/warnings.js
    kind: source
    loc: 57
    churn: 36
    churn_w: 13.68
    fixes: 10
    authors: 21
    owner_share: 0.17
    fan_in: 5
    tests: 2
    score: 3005
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 42
    coupling: 46
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 21
    coupling: 58
  - files: [lib/reply.js, lib/request.js]
    count: 18
    coupling: 42
  - files: [fastify.js, lib/server.js]
    count: 18
    coupling: 39
  - files: [types/instance.d.ts, types/route.d.ts]
    count: 17
    coupling: 45
  - files: [docs/Reference/Routes.md, docs/Reference/Server.md]
    count: 17
    coupling: 40
  - files: [fastify.js, lib/errors.js]
    count: 15
    coupling: 35
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 14
    coupling: 82
  - files: [types/hooks.d.ts, types/instance.d.ts]
    count: 14
    coupling: 58
  - files: [fastify.js, lib/symbols.js]
    count: 14
    coupling: 54
seams:
blind_spots:
  - "9 generated or lock files excluded"
  - "1 credential shaped path left out of every list so a committed map never names them"
---

## Where the risk lives

Risk concentrates in the instance factory and the request lifecycle: four files hold half the total score, and all four sit on the path between `fastify()` and a response being written. `fastify.js` is the public API surface and the assembly point for routing, hooks, schemas, decorators and the server; `lib/reply.js` and `lib/request.js` are serialization and lifecycle state; `lib/errors.js` and `lib/symbols.js` are the shared vocabulary every other module imports. Bug fixes land in `fastify.js` (51 fixes over 216 commits), `lib/route.js` (41 over 92) and `lib/reply.js` (34 over 87) — route building and reply sending are where the defects surface. No file qualified as load-bearing: everything with high fan-in was also touched in the window, so there is no untouched floor, only hot shared code. With 589 committer identities the normal pattern is diffuse ownership (`lib/errors.js` at 0.09, `lib/route.js` at 0.10); `fastify.js` is the exception at 0.46, so its history is one maintainer's shape and a reviewer there is worth finding.

## Why these files are hot

`fastify.js` builds the instance object: the shorthand route methods, the `Object.defineProperties` block of getters, hook registration, schema and serializer setters, `inject`, `ready`, close and Avvio wiring. It changes because every new capability lands as another property or option here, and the 51 fixes reflect how much behavior hangs off option validation and shutdown ordering. Six files depend on it and 63 test files cover it, so a broken invariant here fails broadly rather than locally. Before editing this file, open `lib/route.js` alongside it (they share 42 commits) and keep the property set on the returned `fastify` object and its getters intact — anything added there is public API.

`lib/errors.js` is the `FST_ERR_*` code table built with `@fastify/error`, plus `appendStackTrace` and `AVVIO_ERRORS_MAP`. It has the widest reach in the repo, 17 dependents, and it changes whenever a module needs a new failure mode. Codes, messages, status codes and constructor types are all observable behavior: renaming a code or changing a status breaks user error handling. Before editing this file, run `test/internals/errors.test.js` and update `docs/Reference/Errors.md` in the same commit — add codes rather than repurposing existing ones.

`lib/symbols.js` is 71 lines of `Symbol()` keys and the most depended-on module, with 19 dependents and 27 test files reaching it. It is hot because each new internal state slot starts as a key here, and its 10 fixes are usually a symbol added or moved to fix state leaking between contexts. Deleting or renaming a key silently turns reads into `undefined` in unrelated modules. Before editing this file, grep the whole tree for the key name and add new keys instead of removing old ones.

`lib/reply.js` is the largest hotspot at 1030 lines: header and trailer handling, status codes, `send`, serialization compilation and caching, stream and web-stream sending, and the onSend/onError/onResponse runners. 34 of its 87 commits are fixes, mostly in the payload type branches and stream teardown. `lib/four-oh-four.js` and `lib/plugin-override.js` depend on it, but the real coupling is `lib/request.js` (42%) via the shared timeout and abort symbols cleared in `hijack`. Before editing this file, run the `test/diagnostics-channel/*.test.js` suite and preserve the content-type inference order in `send` — string, buffer, stream, Response, then JSON.

`lib/hooks.js` defines the supported hook names and every hook runner. It has only 18 commits but 7 dependents and just 3 covering test files, so it is under-tested for its reach; the runners encode error propagation for both callback and promise styles. Before editing this file, run `test/internals/hook-runner.test.js` and `test/internals/hooks.test.js`, and keep `supportedHooks` and the `lifecycleHooks` order in sync with the validation in `fastify.js`.

## Change coupling

The core wiring cluster is `fastify.js` with `lib/route.js` (46%), `lib/symbols.js` (54%), `lib/server.js` (39%) and `lib/errors.js` (35%). This is coupling by design: a feature needs a symbol, a route option, an error code and a factory property. When you change one, open the other three and check that each new symbol has a reader and each new error code a thrower.

Docs track code closely: `docs/Reference/Warnings.md` with `lib/warnings.js` at 82% and `docs/Reference/Errors.md` with `lib/errors.js` at 58%. These tables are the published contract. When you add a code or warning, edit the matching doc in the same commit.

`lib/reply.js` and `lib/request.js` move together 42% of the time because they share lifecycle symbols rather than an interface — this is leakage. When you touch timeout, abort or signal handling in one, read the symbol use in the other and prefer moving the shared teardown into one place over duplicating it.

The types cluster — `types/instance.d.ts` with `types/route.d.ts` (45%) and `types/hooks.d.ts` (58%) — trails the JavaScript rather than driving it, and no test file in the signals reaches these declarations. When you change an instance method, hook signature or route option, update all three and verify with the repo's type tests rather than a unit test.

## What to read first

1. `lib/symbols.js` — the internal state vocabulary; nothing else reads cleanly without it.
2. `lib/errors.js` — the error contract, imported by 17 files.
3. `fastify.js` — the instance factory and public API surface; read the returned object and the getter block before changing behavior.
4. `lib/route.js` — route construction, 41 fixes and no covering test file in the signals; the partner to almost every `fastify.js` change.
5. `lib/reply.js` — the send and serialization path, where response bugs live.
6. `lib/hooks.js` — the runners that define hook error propagation, thinly tested for their reach.
7. `docs/Reference/Errors.md` and `docs/Reference/Warnings.md` — the published side of the two tables you are most likely to extend.
