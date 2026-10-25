---
complex_md: "0.3"
generated: 2025-06-14
commit: 672971d
tool: complex-md/0.10.0
window_commits: 303
files_analyzed: 11
profile:
  files_total: 50
  files_in_scope: 11
  loc_in_scope: 1283
  kinds: "docs 18, source 11, test 6, other 5, ci 4, asset 3, data 1, manifest 1, generated 1"
  languages: "py 9, sh 1, bat 1"
  dependency_edges: 38
  commits_total: 436
  commits_analyzed: 171
  commits_skipped: 132
  half_life_commits: 76
  window_from: 2011-06-24
  window_to: 2025-06-14
  velocity_30d: 1.8
  authors_total: 41
  concentration_50: 3
  hotspot_cut: 3
  pair_min: 3
  confidence: "structure+history"
hotspots:
  - path: src/itsdangerous/serializer.py
    kind: source
    loc: 404
    churn: 26
    churn_w: 11.48
    fixes: 3
    authors: 4
    owner_share: 0.81
    fan_in: 3
    tests: 1
    score: 2780
  - path: src/itsdangerous/timed.py
    kind: source
    loc: 228
    churn: 24
    churn_w: 12.42
    fixes: 1
    authors: 6
    owner_share: 0.71
    fan_in: 2
    tests: 1
    score: 1917
  - path: src/itsdangerous/exc.py
    kind: source
    loc: 106
    churn: 8
    churn_w: 2.95
    fixes: 0
    authors: 1
    owner_share: 1.00
    fan_in: 6
    tests: 4
    score: 1815
load_bearing:
co_change:
  - files: [src/itsdangerous/serializer.py, src/itsdangerous/timed.py]
    count: 11
    coupling: 46%
  - files: [src/itsdangerous/serializer.py, src/itsdangerous/signer.py]
    count: 10
    coupling: 77%
  - files: [src/itsdangerous/serializer.py, src/itsdangerous/url_safe.py]
    count: 8
    coupling: 100%
  - files: [src/itsdangerous/_json.py, src/itsdangerous/serializer.py]
    count: 8
    coupling: 80%
  - files: [docs/conf.py, docs/index.rst]
    count: 8
    coupling: 42%
  - files: [src/itsdangerous/exc.py, src/itsdangerous/timed.py]
    count: 7
    coupling: 88%
  - files: [src/itsdangerous/timed.py, src/itsdangerous/url_safe.py]
    count: 7
    coupling: 88%
  - files: [src/itsdangerous/encoding.py, src/itsdangerous/serializer.py]
    count: 6
    coupling: 100%
  - files: [src/itsdangerous/exc.py, src/itsdangerous/serializer.py]
    count: 6
    coupling: 75%
  - files: [src/itsdangerous/exc.py, src/itsdangerous/signer.py]
    count: 6
    coupling: 75%
seams:
blind_spots:
  - "1 generated or lock files excluded"
  - "133 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
  - "dependencies not resolved for 1 .bat files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Change risk concentrates in the serialization and signature contract that serializer.py and timed.py define. Bug fixes land most often in serializer.py (3 fixes) and in timed.py and encoding.py (1 fix each). The exception hierarchy in exc.py supports 6 dependents and has not changed in the window. Ownership spreads across 41 authors; the primary hotspot shows a single author at 0.81 share. Bot commits and 1 generated file were excluded from the analysis.

## Why these files are hot

src/itsdangerous/serializer.py defines the Serializer class that wraps Signer with payload encoding, key rotation, and fallback unsigning. It changed 26 times; 3 of those commits fixed bugs. Three files import it directly: __init__.py, timed.py, and url_safe.py. The test file tests/test_itsdangerous/test_serializer.py covers it. Before editing this file, run the tests in tests/test_itsdangerous/test_serializer.py and open timed.py alongside it.

src/itsdangerous/timed.py defines TimestampSigner and TimedSerializer, which add timestamp attachment and max_age validation to the base flow. It changed 24 times; 1 commit fixed a bug. Two files depend on it: __init__.py and url_safe.py. The test file tests/test_itsdangerous/test_timed.py covers it. Before editing this file, verify that loads raises SignatureExpired when age exceeds max_age and run tests/test_itsdangerous/test_timed.py.

src/itsdangerous/exc.py defines the exception hierarchy that the rest of the library raises. It changed 8 times and carries 0 fixes. Six files depend on it, which makes it the most imported module in the set. Four test files cover it. Before editing this file, check that all 6 dependents still raise the correct exception types.

## Change coupling

serializer.py and url_safe.py moved together in 8 commits at 100% coupling. URLSafeSerializer extends Serializer, so this coupling is by design. When you change serializer.py, open url_safe.py and verify the subclass still works.

serializer.py and encoding.py moved together in 6 commits at 100% coupling. serializer.py imports want_bytes and base64 helpers from encoding.py. When you change encoding.py, run the serializer tests to confirm the import chain.

serializer.py and signer.py moved together in 10 commits at 77% coupling. Serializer wraps Signer, so changes to the Signer interface propagate upward. When you change signer.py, run tests/test_itsdangerous/test_serializer.py.

exc.py and timed.py moved together in 7 commits at 88% coupling. timed.py raises BadTimeSignature and SignatureExpired, both defined in exc.py. When you add or rename an exception in exc.py, search timed.py for all raise statements that use it.

## What to read first

1. src/itsdangerous/exc.py — the exception types that every other module imports and raises.
2. src/itsdangerous/serializer.py — the core serialization and signature contract.
3. src/itsdangerous/signer.py — the signing primitive that Serializer wraps.
4. src/itsdangerous/timed.py — the timestamp extension built on Serializer and Signer.
5. src/itsdangerous/encoding.py — the byte and base64 helpers that serializer.py and timed.py call.