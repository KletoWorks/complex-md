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

Change risk concentrates in the serialization and timing logic. This code handles the transformation of data to signed bytes and the validation of timestamps. Bug fixes primarily land in `src/itsdangerous/serializer.py` with 3 fixes. The map does not cover generated files or bot commits.

## Why these files are hot

`src/itsdangerous/serializer.py` wraps the signer to support data types other than bytes. It changes frequently due to type hint updates and serializer protocol adjustments. It is the core dependency for `src/itsdangerous/timed.py` and `src/itsdangerous/url_safe.py`. Before editing this file, run `tests/test_itsdangerous/test_serializer.py`.

`src/itsdangerous/timed.py` adds timestamp recording to signatures for expiration checks. It evolves to handle timezone-aware datetimes and platform-specific timestamp errors. It depends on the base `Serializer` and `Signer` classes. Before editing this file, run `tests/test_itsdangerous/test_timed.py`.

`src/itsdangerous/exc.py` defines the exception hierarchy for the library. It has high fan-in because almost every other source file imports these errors. It changes when new failure modes are identified in the signing process. Before editing this file, run the four test files that cover it.

## Change coupling

`src/itsdangerous/serializer.py` is strongly coupled to `src/itsdangerous/url_safe.py` and `src/itsdangerous/encoding.py` at 100%. This coupling is by design as those files provide the specific encoding and safe-string logic the serializer uses. Open `src/itsdangerous/encoding.py` when changing serialization formats.

`src/itsdangerous/exc.py` moves with `src/itsdangerous/timed.py` (88%) and `src/itsdangerous/serializer.py` (75%). This coupling exists because changes to signing logic often require new exception types for specific failure states. Open `src/itsdangerous/exc.py` when adding new validation logic to the signer.

## What to read first

1. `src/itsdangerous/signer.py` to understand the basic signing and verification mechanism.
2. `src/itsdangerous/serializer.py` to see how data is transformed before signing.
3. `src/itsdangerous/exc.py` to learn the error states the library produces.
4. `src/itsdangerous/timed.py` to understand how the library handles expiration.