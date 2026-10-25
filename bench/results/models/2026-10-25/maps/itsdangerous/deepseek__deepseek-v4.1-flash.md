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

Risk concentrates in 3 source files that form the signing and serialization public API: src/itsdangerous/serializer.py, src/itsdangerous/timed.py, and src/itsdangerous/exc.py. serializer.py and timed.py hold the data and timestamp contracts; exc.py holds the exception hierarchy that 6 modules import. Bug fixes land in serializer.py (3), timed.py (1), and src/itsdangerous/encoding.py (1). The top committer owns 81% of serializer.py commits and 71% of timed.py commits. No load-bearing file appears in the report. The map leaves out 133 bot commits, so the churn numbers undercount those events.

## Why these files are hot

src/itsdangerous/serializer.py wraps a Signer and provides dumps and loads for signed data. It changed in 26 commits, 3 of them fixes, and 4 authors touched it. It depends on signer.py, encoding.py, url_safe.py, and _json.py; an edit to the signer fallback or payload encoding can break those partners. tests/test_itsdangerous/test_serializer.py covers it. Before editing this file, run tests/test_itsdangerous/test_serializer.py and open signer.py when you change the signer path.

src/itsdangerous/timed.py extends Signer and Serializer with timestamped signing and max_age checks. It changed in 24 commits, 1 of them a fix, and 6 authors touched it. It imports exc.py and url_safe.py; an edit to the timestamp split or expiration check can change the exceptions those modules raise. tests/test_itsdangerous/test_timed.py covers it. Before editing this file, run that test file and open exc.py to check SignatureExpired and BadTimeSignature behavior.

src/itsdangerous/exc.py defines BadData, BadSignature, BadTimeSignature, SignatureExpired, BadHeader, and BadPayload. It changed in 8 commits, had 0 fixes, and 1 author touched it. It has 6 dependents, so an edit to an exception field or constructor argument reaches every signing and serialization module. Four test files cover it: tests/test_itsdangerous/test_encoding.py, tests/test_itsdangerous/test_serializer.py, tests/test_itsdangerous/test_signer.py, and tests/test_itsdangerous/test_timed.py. Before editing this file, run those 4 test files because each one asserts exception behavior.

## Change coupling

src/itsdangerous/serializer.py couples tightly with src/itsdangerous/url_safe.py (100%), src/itsdangerous/encoding.py (100%), src/itsdangerous/_json.py (80%), and src/itsdangerous/signer.py (77%). This coupling is by design: the serializer calls each partner for URL-safe encoding, JSON payloads, and signing. Before editing serializer.py, open url_safe.py, encoding.py, _json.py, and signer.py and run tests/test_itsdangerous/test_serializer.py.

src/itsdangerous/exc.py couples with src/itsdangerous/timed.py (88%), src/itsdangerous/signer.py (75%), and src/itsdangerous/serializer.py (75%). This coupling follows the exception hierarchy: a new field or subclass needs matching raises in each caller. Before editing exc.py, open timed.py, signer.py, and serializer.py and run the 4 exception test files.

No directory seams appear in this window.

## What to read first

1. src/itsdangerous/exc.py — the exception hierarchy that 6 modules import.
2. src/itsdangerous/signer.py — base signing logic used by serializer.py and timed.py.
3. src/itsdangerous/serializer.py — dumps and loads path, fallback signers, payload encoding.
4. src/itsdangerous/timed.py — timestamp extension and max_age checks.
5. tests/test_itsdangerous/test_serializer.py — coverage for the hottest file.