---
complex_md: "0.2"
generated: 2026-08-20
commit: 83e69762
tool: complex-md/bench
window_months: 12
files_analyzed: 62
hotspots:
  - path: fastify.js
    loc: 1009
    churn: 45
    churn_w: 35.57
    fixes: 12
    authors: 16
    owner_share: 0.18
    fan_in: 89
    score: 35890
  - path: lib/reply.js
    loc: 1090
    churn: 19
    churn_w: 15.39
    fixes: 10
    authors: 12
    owner_share: 0.26
    fan_in: 25
    score: 16775
  - path: lib/route.js
    loc: 688
    churn: 17
    churn_w: 13.20
    fixes: 8
    authors: 10
    owner_share: 0.24
    fan_in: 12
    score: 9082
  - path: lib/config-validator.js
    loc: 1159
    churn: 8
    churn_w: 6.47
    fixes: 1
    authors: 4
    owner_share: 0.50
    fan_in: 1
    score: 7499
  - path: types/instance.d.ts
    loc: 713
    churn: 8
    churn_w: 6.92
    fixes: 2
    authors: 5
    owner_share: 0.50
    fan_in: 12
    score: 4934
  - path: fastify.d.ts
    loc: 293
    churn: 17
    churn_w: 14.68
    fixes: 6
    authors: 8
    owner_share: 0.29
    fan_in: 89
    score: 4301
  - path: lib/request.js
    loc: 398
    churn: 12
    churn_w: 9.68
    fixes: 10
    authors: 8
    owner_share: 0.33
    fan_in: 28
    score: 3853
  - path: lib/errors.js
    loc: 554
    churn: 8
    churn_w: 6.75
    fixes: 4
    authors: 7
    owner_share: 0.25
    fan_in: 28
    score: 3740
  - path: lib/content-type-parser.js
    loc: 419
    churn: 8
    churn_w: 5.96
    fixes: 4
    authors: 6
    owner_share: 0.25
    fan_in: 5
    score: 2497
  - path: lib/validation.js
    loc: 286
    churn: 6
    churn_w: 5.02
    fixes: 4
    authors: 4
    owner_share: 0.50
    fan_in: 4
    score: 1436
  - path: lib/handle-request.js
    loc: 230
    churn: 8
    churn_w: 6.09
    fixes: 4
    authors: 6
    owner_share: 0.38
    fan_in: 4
    score: 1401
  - path: lib/server.js
    loc: 440
    churn: 5
    churn_w: 3.15
    fixes: 3
    authors: 4
    owner_share: 0.40
    fan_in: 2
    score: 1386
  - path: lib/content-type.js
    loc: 214
    churn: 6
    churn_w: 5.00
    fixes: 4
    authors: 5
    owner_share: 0.33
    fan_in: 7
    score: 1070
  - path: types/logger.d.ts
    loc: 147
    churn: 6
    churn_w: 5.49
    fixes: 3
    authors: 4
    owner_share: 0.33
    fan_in: 14
    score: 807
  - path: lib/four-oh-four.js
    loc: 193
    churn: 5
    churn_w: 3.50
    fixes: 1
    authors: 5
    owner_share: 0.20
    fan_in: 1
    score: 676
co_change:
  - files: [docs/Reference/Server.md, fastify.js]
    count: 13
  - files: [docs/Reference/Server.md, fastify.d.ts]
    count: 9
  - files: [docs/Reference/Warnings.md, fastify.js]
    count: 9
  - files: [fastify.d.ts, fastify.js]
    count: 9
  - files: [fastify.js, lib/route.js]
    count: 9
  - files: [build/build-validation.js, fastify.d.ts]
    count: 8
  - files: [build/build-validation.js, fastify.js]
    count: 8
  - files: [build/build-validation.js, lib/config-validator.js]
    count: 8
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 8
  - files: [fastify.js, lib/warnings.js]
    count: 8
---

## Where the risk lives

Change risk concentrates in the request lifecycle: `fastify.js` assembles the instance and its public API, `lib/route.js` builds routing and per-route contexts, and `lib/reply.js` serializes and writes responses. These three carry the highest scores and the widest reach; `fastify.js` alone has fan_in 89 and 16 authors. Bug fixes land most often in `fastify.js` (12 fixes), `lib/reply.js` (10) and `lib/request.js` (10) — start there when hunting a lifecycle or serialization bug. Ownership is diffuse on the hot files: `fastify.js` has owner_share 0.18 across 16 authors, so no single head holds the knowledge, while `lib/config-validator.js` and `lib/validation.js` sit at 0.50 with few authors. The type surface (`fastify.d.ts`, `types/instance.d.ts`) shares that fan_in and moves with the runtime it describes.

## Why these files are hot

`fastify.js` constructs the server object, wires every symbol-keyed internal (`kState`, `kReply`, `kRequest`, content-type parser, error handler) and exposes the route shorthands, hooks, decorators and lifecycle methods. It changes because almost every feature touches instance construction; 12 of its 45 commits were fixes. An edit here tends to break option handling, boot ordering, or the public method set. Before editing this file, run test/types/fastify.tst.ts and keep the symbol table in `lib/symbols.js` in sync with the properties you add.

`lib/reply.js` owns response serialization, header and trailer handling, status codes, stream and web-stream sending, and the onSend hook chain; 10 of 19 commits were fixes, a large share for a file this central. Edits break content-type inference, `send` payload branching, or stream teardown. Before editing this file, run test/internals/reply.test.js and test/types/reply.tst.ts and preserve the payload-type ordering in `send`.

`lib/route.js` converts shorthand and extended route declarations into contexts, validates hooks and body limits, and runs the per-request handler including timeout and abort wiring; 8 of 17 commits were fixes. Edits break prefix and trailing-slash resolution, hook async validation, or 404 exposure. Before editing this file, run test/types/route.tst.ts and trace `route` through `addNewRoute` to confirm prefix handling still holds.

`lib/config-validator.js` is generated by `build/build-validation.js` and must not be hand-edited; its single fix reflects that. Its job is coercing and defaulting server options. Before editing this file, change the schema in the build script and regenerate rather than touching the output.

`types/instance.d.ts` declares the `FastifyInstance` surface — hooks, decorators, content-type parsers, listen options — with owner_share 0.50 across 5 authors. Edits break consumer type inference. Before editing this file, run test/types/instance.tst.ts and mirror any runtime method you add in `fastify.js`.

## Change coupling

`fastify.js` moves with `docs/Reference/Server.md` (13) and `docs/Reference/Warnings.md` (9): the API and its reference documentation, coupled by design. When you change instance options or methods, open the matching Server.md section and update it in the same commit.

`fastify.js`, `fastify.d.ts` and `types/instance.d.ts` co-change (9 each) because runtime and type declarations describe one surface. When one side changes, open the other and reconcile the signature.

`build/build-validation.js`, `lib/config-validator.js` and `fastify.d.ts` cluster (8 each): the generator, its output, and the option types. When option schema changes, run the build script and check the generated validator and the `.d.ts` together — never edit the validator directly.

`fastify.js` and `lib/warnings.js` co-change (8) as deprecations get added and documented. When adding a warning, register it in `lib/warnings.js` and note it in Warnings.md.

## What to read first

1. `lib/symbols.js` — the symbol keys every hot file shares; read before touching instance state.
2. `fastify.js` — instance construction and the public API surface all requests flow through.
3. `lib/route.js` — how routes become contexts and how a request is handled.
4. `lib/reply.js` — response serialization and the send path.
5. `lib/errors.js` — the `FST_ERR_*` codes thrown across route, reply and request.
6. `fastify.d.ts` and `types/instance.d.ts` — the type contract that must track the runtime.
