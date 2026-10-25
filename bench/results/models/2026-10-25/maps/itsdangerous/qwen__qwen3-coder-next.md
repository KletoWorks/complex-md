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

This repository has a public signing library with hotspots in serialization, timing, and exceptions. The top three hotspots—`serializer.py`, `timed.py`, and `exc.py`—handle the core contract of secure data serialization with signature verification. Change risk concentrates on the `Serializer` and `TimedSerializer` classes, which define the public API for `dumps` and `loads`. The `exc.py` file defines all exception types and is depended on by every core module. Bug fixes land mostly in `serializer.py` (3 fixes) and `timed.py` (1 fix). No load-bearing files exist: all core modules have been touched in the window. The high ownership share in `serializer.py` (81%) and `encoding.py` (100%) shows one author drove most changes.

## Why these files are hot

`src/itsdangerous/serializer.py` defines the main `Serializer` class with methods to serialize, sign, unsign, and verify payloads. Its 26 commits include key rotation support and fallback signers. It depends on `signer.py`, `timed.py`, and `url_safe.py`. Its single covering test is `tests/test_itsdangerous/test_serializer.py`. Before editing this file, run `pytest tests/test_itsdangerous/test_serializer.py`.

`src/itsdangerous/timed.py` defines `TimestampSigner` and `TimedSerializer` for time-based signatures and expiration. Its 24 commits include timezone-aware timestamp handling. It depends on `serializer.py` and `url_safe.py`. Its single covering test is `tests/test_itsdangerous/test_timed.py`. Before editing this file, run `pytest tests/test_itsdangerous/test_timed.py`.

`src/itsdangerous/exc.py` defines all exception classes: `BadSignature`, `BadTimeSignature`, `SignatureExpired`, `BadHeader`, and `BadPayload`. It is depended on by six core files and has four test files covering it. Its owner is a single author with one commit in the window, so changes are rare. Before editing this file, run `pytest tests/test_itsdangerous/ -k "exc or exception"` to ensure all exception tests pass.

## Change coupling

`serializer.py` and `timed.py` co-change 46% of the time, indicating `TimedSerializer` extends `Serializer` and its methods override `loads` and `dumps`. Before editing `timed.py`, open `serializer.py` to verify compatibility. `serializer.py` and `signer.py` co-change 77% of the time, showing tight coupling between signing and serialization. Before editing one, open the other to check key and salt handling. `serializer.py` and `url_safe.py` co-change 100% of the time, meaning `URLSafeSerializer` is built directly on `Serializer`. Before editing `url_safe.py`, open `serializer.py` to ensure `dump_payload` and `load_payload` invariants hold. `exc.py` and `timed.py` co-change 88% of the time, showing `BadTimeSignature` and `SignatureExpired` are tightly bound to time-based logic. Before editing `exc.py`, open `timed.py` to verify error semantics. `exc.py` and `serializer.py` co-change 75% of the time, so new exception types require updates to error handling in `serializer.py`.

## What to read first

- `src/itsdangerous/serializer.py`: This file defines the core serialization and signing contract; all other source files depend on it.
- `src/itsdangerous/timed.py`: This file adds time-based validation and is used whenever expiration is required.
- `src/itsdangerous/exc.py`: This file defines all public exceptions; changes here affect every module that handles failures.
- `src/itsdangerous/signer.py`: This file implements the base signing algorithm and is coupled tightly to `serializer.py`.
- `src/itsdangerous/url_safe.py`: This file implements URL-safe serialization and changes to it require `serializer.py` changes.
- `tests/test_itsdangerous/test_serializer.py`: This test file covers the core serializer and must pass before any change to `serializer.py`.
- `tests/test_itsdangerous/test_timed.py`: This test file covers the timed serializer and must pass before any change to `timed.py`.