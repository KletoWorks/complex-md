---
complex_md: "0.4"
generated: 2026-10-20
commit: "77aa01b"
generator:
  name: complex-md
  version: 0.10.0
window_commits: 2000
files_analyzed: 640
profile:
  files_total: 4210
  files_in_scope: 640
  confidence: "structure+history"
hotspots:
  - path: packages/billing/src/handlers/billing-controller.ts
    kind: source
    loc: 900
    churn: 120
    churn_w: 40.25
    fixes: 30
    authors: 12
    owner_share: 0.40
    fan_in: 40
    tests: 15
    score: 40000
  - path: packages/catalog/src/handlers/catalog-controller.ts
    kind: source
    loc: 860
    churn: 114
    churn_w: 38.25
    fixes: 29
    authors: 12
    owner_share: 0.41
    fan_in: 38
    tests: 14
    score: 37600
  - path: packages/checkout/src/handlers/checkout-controller.ts
    kind: source
    loc: 820
    churn: 108
    churn_w: 36.25
    fixes: 28
    authors: 11
    owner_share: 0.42
    fan_in: 36
    tests: 13
    score: 35200
  - path: packages/identity/src/handlers/identity-controller.ts
    kind: source
    loc: 780
    churn: 102
    churn_w: 34.25
    fixes: 27
    authors: 11
    owner_share: 0.43
    fan_in: 34
    tests: 12
    score: 32800
  - path: packages/search/src/handlers/search-controller.ts
    kind: source
    loc: 740
    churn: 96
    churn_w: 32.25
    fixes: 26
    authors: 10
    owner_share: 0.44
    fan_in: 32
    tests: 11
    score: 30400
  - path: packages/billing/src/models/billing-repository.ts
    kind: source
    loc: 700
    churn: 90
    churn_w: 30.25
    fixes: 25
    authors: 10
    owner_share: 0.45
    fan_in: 30
    tests: 10
    score: 28000
  - path: packages/catalog/src/models/catalog-repository.ts
    kind: source
    loc: 660
    churn: 84
    churn_w: 28.25
    fixes: 24
    authors: 9
    owner_share: 0.46
    fan_in: 28
    tests: 9
    score: 25600
  - path: packages/checkout/src/models/checkout-repository.ts
    kind: source
    loc: 620
    churn: 78
    churn_w: 26.25
    fixes: 23
    authors: 9
    owner_share: 0.47
    fan_in: 26
    tests: 8
    score: 23200
  - path: packages/identity/src/models/identity-repository.ts
    kind: source
    loc: 580
    churn: 72
    churn_w: 24.25
    fixes: 22
    authors: 8
    owner_share: 0.48
    fan_in: 24
    tests: 7
    score: 20800
  - path: packages/search/src/models/search-repository.ts
    kind: source
    loc: 540
    churn: 66
    churn_w: 22.25
    fixes: 21
    authors: 8
    owner_share: 0.49
    fan_in: 22
    tests: 6
    score: 18400
  - path: packages/billing/src/services/billing-service.ts
    kind: source
    loc: 500
    churn: 60
    churn_w: 20.25
    fixes: 20
    authors: 7
    owner_share: 0.50
    fan_in: 20
    tests: 5
    score: 16000
  - path: packages/catalog/src/services/catalog-service.ts
    kind: source
    loc: 460
    churn: 54
    churn_w: 18.25
    fixes: 19
    authors: 7
    owner_share: 0.51
    fan_in: 18
    tests: 4
    score: 13600
  - path: packages/checkout/src/services/checkout-service.ts
    kind: source
    loc: 420
    churn: 48
    churn_w: 16.25
    fixes: 18
    authors: 6
    owner_share: 0.52
    fan_in: 16
    tests: 3
    score: 11200
  - path: packages/identity/src/services/identity-service.ts
    kind: source
    loc: 380
    churn: 42
    churn_w: 14.25
    fixes: 17
    authors: 6
    owner_share: 0.53
    fan_in: 14
    tests: 2
    score: 8800
  - path: packages/search/src/services/search-service.ts
    kind: source
    loc: 340
    churn: 36
    churn_w: 12.25
    fixes: 16
    authors: 5
    owner_share: 0.54
    fan_in: 12
    tests: 1
    score: 6400
load_bearing: []
co_change:
  - files: [packages/billing/src/handlers/billing-controller.ts, packages/billing/src/models/billing-repository.ts]
    count: 60
    coupling: 80
  - files: [packages/catalog/src/handlers/catalog-controller.ts, packages/catalog/src/models/catalog-repository.ts]
    count: 56
    coupling: 77
  - files: [packages/checkout/src/handlers/checkout-controller.ts, packages/checkout/src/models/checkout-repository.ts]
    count: 52
    coupling: 74
  - files: [packages/identity/src/handlers/identity-controller.ts, packages/identity/src/models/identity-repository.ts]
    count: 48
    coupling: 71
  - files: [packages/search/src/handlers/search-controller.ts, packages/search/src/models/search-repository.ts]
    count: 44
    coupling: 68
  - files: [packages/billing/src/models/billing-repository.ts, packages/billing/src/services/billing-service.ts]
    count: 40
    coupling: 65
  - files: [packages/catalog/src/models/catalog-repository.ts, packages/catalog/src/services/catalog-service.ts]
    count: 36
    coupling: 62
  - files: [packages/checkout/src/models/checkout-repository.ts, packages/checkout/src/services/checkout-service.ts]
    count: 32
    coupling: 59
  - files: [packages/identity/src/models/identity-repository.ts, packages/identity/src/services/identity-service.ts]
    count: 28
    coupling: 56
  - files: [packages/search/src/models/search-repository.ts, packages/search/src/services/search-service.ts]
    count: 24
    coupling: 53
seams:
  - dirs: [packages/billing, packages/catalog]
    count: 40
    coupling: 60
  - dirs: [packages/catalog, packages/checkout]
    count: 37
    coupling: 56
  - dirs: [packages/checkout, packages/identity]
    count: 34
    coupling: 52
  - dirs: [packages/identity, packages/search]
    count: 31
    coupling: 48
  - dirs: [packages/search, packages/billing]
    count: 28
    coupling: 44
  - dirs: [packages/billing, packages/checkout]
    count: 25
    coupling: 40
blind_spots:
  - "12 generated or lock files excluded"
---

## Where the risk lives

Change risk concentrates in the request handlers of 5 packages: billing, catalog, checkout, identity, search. The handlers hold the most fixes, from 30 down to 26. Each handler moves with its repository file in most commits.

## Why these files are hot

packages/billing/src/handlers/billing-controller.ts handles the billing requests of the public API, and 40 files depend on it. 30 of its 120 commits were fixes, most of them for input checks, and 15 test files reach it. It moves with packages/billing/src/models/billing-repository.ts in 80 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/billing` and open packages/billing/src/models/billing-repository.ts.

packages/catalog/src/handlers/catalog-controller.ts handles the catalog requests of the public API, and 38 files depend on it. 29 of its 114 commits were fixes, most of them for input checks, and 14 test files reach it. It moves with packages/catalog/src/models/catalog-repository.ts in 77 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/catalog` and open packages/catalog/src/models/catalog-repository.ts.

packages/checkout/src/handlers/checkout-controller.ts handles the checkout requests of the public API, and 36 files depend on it. 28 of its 108 commits were fixes, most of them for input checks, and 13 test files reach it. It moves with packages/checkout/src/models/checkout-repository.ts in 74 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/checkout` and open packages/checkout/src/models/checkout-repository.ts.

packages/identity/src/handlers/identity-controller.ts handles the identity requests of the public API, and 34 files depend on it. 27 of its 102 commits were fixes, most of them for input checks, and 12 test files reach it. It moves with packages/identity/src/models/identity-repository.ts in 71 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/identity` and open packages/identity/src/models/identity-repository.ts.

packages/search/src/handlers/search-controller.ts handles the search requests of the public API, and 32 files depend on it. 26 of its 96 commits were fixes, most of them for input checks, and 11 test files reach it. It moves with packages/search/src/models/search-repository.ts in 68 percent of the quieter file's commits. Before editing this file, run `npm test -w packages/search` and open packages/search/src/models/search-repository.ts.

## Change coupling

Each handler moves with the repository file of its package, at 68 to 80 percent, by design: the handler maps a request onto the repository. When a handler changes, open the repository file of the same package and run its tests.

## What to read first

1. packages/identity/src/handlers/identity-controller.ts: every request checks the session here.
2. packages/billing/src/handlers/billing-controller.ts: the handler with the most fixes.
3. packages/checkout/src/services/checkout-service.ts: the only writer of orders.
