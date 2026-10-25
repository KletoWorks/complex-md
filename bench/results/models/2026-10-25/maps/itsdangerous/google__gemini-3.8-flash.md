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

Risk concentrates in data serialization and token expiration logic across `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py`. Bug fixes land primarily in `src/itsdangerous/serializer.py` with 3 fixes and `src/itsdangerous/timed.py` with 1 fix. The repository contains no load-bearing files because the codebase has no untouched internal dependencies. One core maintainer authors over 70% of the commits to key modules despite 41 total contributors. The analysis excludes 133 bot commits and omits dependency resolution for 1 Windows batch file.

## Why these files are hot

`src/itsdangerous/serializer.py` converts data structures into signed byte strings and verifies signatures with fallback keys. The file changes often to update type annotations, key rotation, and payload decoders, with 3 commits recorded as bug fixes. `src/itsdangerous/timed.py` and `src/itsdangerous/url_safe.py` subclass it directly, so interface changes cascade. `tests/test_itsdangerous/test_serializer.py` covers the module. Before editing this file, run `tests/test_itsdangerous/test_serializer.py` and verify `src/itsdangerous/url_safe.py`.

`src/itsdangerous/timed.py` attaches timestamps to signatures and validates maximum token age. Past churn addressed timestamp serialization, integer overflows, and timezone updates, with 1 commit recorded as a bug fix. `src/itsdangerous/url_safe.py` subclasses the timed serializer to expose URL-safe tokens. `tests/test_itsdangerous/test_timed.py` covers the file. Before editing this file, run `tests/test_itsdangerous/test_timed.py` and preserve timezone-aware UTC datetime objects.

`src/itsdangerous/exc.py` defines the exception class hierarchy for all signature and payload errors. It has a fan-in of 6, and 4 test suites import it. Changes to exception attributes break error inspection across the entire package. Test suites in `tests/test_itsdangerous/` test every error class thoroughly. Before editing this file, run the test suite and verify `payload` and `date_signed` attributes on custom exceptions.

## Change coupling

`src/itsdangerous/serializer.py` and `src/itsdangerous/url_safe.py` share 8 commits with 100% coupling. `src/itsdangerous/timed.py` and `src/itsdangerous/url_safe.py` share 7 commits with 88% coupling. This coupling exists by design because URL-safe wrappers mirror constructor arguments and serialization methods. Open `src/itsdangerous/url_safe.py` and synchronize method signatures when you change serializer interfaces.

`src/itsdangerous/serializer.py` and `src/itsdangerous/signer.py` share 10 commits with 77% coupling. `Serializer` delegates signature generation, verification, and key rotation directly to `Signer`. Changes to signature parameters or fallback signer handling require parallel edits across both files. Open `src/itsdangerous/signer.py` and verify constructor arguments when you update signer dispatch.

`src/itsdangerous/exc.py` co-changes with `src/itsdangerous/timed.py` in 7 commits at 88% coupling. It also co-changes with `src/itsdangerous/serializer.py` and `src/itsdangerous/signer.py` at 75% coupling across 6 commits each. This coupling occurs because exception payloads and dates attach to specific validation failures. Check error construction sites across all signers and serializers when you alter exception arguments.

## What to read first

1. `src/itsdangerous/exc.py` - Read first to learn the exception hierarchy that all modules raise and catch.
2. `src/itsdangerous/signer.py` - Read next to understand cryptographic signature generation, verification, and key rotation.
3. `src/itsdangerous/serializer.py` - Read to inspect payload serialization, data conversion, and fallback signer dispatch.
4. `src/itsdangerous/timed.py` - Read to see how timestamps attach to signatures to enforce token expiration.
5. `src/itsdangerous/url_safe.py` - Read to see how the public API encodes tokens for web transport.