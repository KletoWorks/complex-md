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
    coupling: 46
  - files: [src/itsdangerous/serializer.py, src/itsdangerous/signer.py]
    count: 10
    coupling: 77
  - files: [src/itsdangerous/serializer.py, src/itsdangerous/url_safe.py]
    count: 8
    coupling: 100
  - files: [src/itsdangerous/_json.py, src/itsdangerous/serializer.py]
    count: 8
    coupling: 80
  - files: [docs/conf.py, docs/index.rst]
    count: 8
    coupling: 42
  - files: [src/itsdangerous/exc.py, src/itsdangerous/timed.py]
    count: 7
    coupling: 88
  - files: [src/itsdangerous/timed.py, src/itsdangerous/url_safe.py]
    count: 7
    coupling: 88
  - files: [src/itsdangerous/encoding.py, src/itsdangerous/serializer.py]
    count: 6
    coupling: 100
  - files: [src/itsdangerous/exc.py, src/itsdangerous/serializer.py]
    count: 6
    coupling: 75
  - files: [src/itsdangerous/exc.py, src/itsdangerous/signer.py]
    count: 6
    coupling: 75
seams:
blind_spots:
  - "1 generated or lock files excluded"
  - "133 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
  - "dependencies not resolved for 1 .bat files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

The ranking rests on structure and history, with 3 files holding half the total score. Risk concentrates in the signing pipeline: the Serializer wraps the Signer and handles the serialization layer. Bug fixes land in serializer.py (3 fixes in the window), timed.py (1 fix), and encoding.py (1 fix). The exc.py file defines all exception types and is depended on by 6 other files; it moves with the signing and timing code at 75 to 88 percent coupling. There are no load-bearing files, no files nobody touches that others depend on. Forty-one contributors have touched the code, and serializer.py and timed.py show distributed ownership across 4 and 6 authors respectively.

## Why these files are hot

serializer.py defines the core Serializer class with generic type support and key rotation. It has 26 commits, 3 of which fixed bugs, and 81 percent of that work was by one author. One test file covers it. url_safe.py and timed.py and the package __init__.py depend on it. Before editing this file, open tests/test_itsdangerous/test_serializer.py and verify key rotation and fallback signer behavior still works.

timed.py implements TimestampSigner and TimedSerializer with expiry and timestamp validation. It has 24 commits across 6 authors, with one fix in the window. One test file covers it. The Serializer and url_safe.py depend on it. It couples at 88 percent with exc.py. Before editing this file, run tests/test_itsdangerous/test_timed.py and check the timezone-aware datetime handling.

exc.py defines BadData, BadSignature, BadTimeSignature, SignatureExpired, BadHeader, and BadPayload. It has only 8 commits by a single author with zero fixes. Four test files import it. Six files depend on it, making it the highest fan_in file. Ownership is fully concentrated. Before editing this file, verify all importing test files still catch the correct exception types.

## Change coupling

serializer.py and url_safe.py have 100 percent coupling over 8 commits: every change to url_safe.py touched the serializer. These files evolve together. When editing one, open the other and check the encoding and serialization contract.

serializer.py and _json.py have 80 percent coupling over 8 commits. The _json module provides serialization helpers that serializer.py uses directly. When changing the serializer interface, update _json.py to match.

serializer.py and signer.py have 77 percent coupling over 10 commits. The Serializer wraps the Signer and passes key rotation parameters through _make_keys_list. When changing how keys are handled, open signer.py and check the key list construction.

timed.py and exc.py have 88 percent coupling over 7 commits. TimestampSigner raises SignatureExpired and BadTimeSignature defined in exc.py. When adding a new exception to exc.py, verify timed.py still handles it correctly.

encoding.py and serializer.py have 100 percent coupling over 6 commits. The encoding module provides want_bytes, base64_encode, and int conversion utilities that serializer.py uses. When changing encoding behavior, open serializer.py and check payload encoding.

## What to read first

Read exc.py first because it defines the exception hierarchy that every other module imports and raises. Six files depend on it and any change there propagates outward.

Read serializer.py second because it is the highest-scoring file, the main public API, and it coordinates between the signer and the serializer. It has only one covering test.

Read timed.py third because it extends the serializer with time-based signatures and couples strongly with exc.py and url_safe.py. Verify the timestamp expiry logic works.

Read signer.py because it is the fourth hotspot and couples at 77 percent with serializer.py. The two files share the key rotation logic.

Read tests/test_itsdangerous/test_serializer.py before making any changes to serializer.py or timed.py. It is the only test for the core Serializer class.