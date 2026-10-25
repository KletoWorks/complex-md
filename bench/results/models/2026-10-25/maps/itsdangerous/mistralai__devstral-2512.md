```markdown
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

Change risk concentrates in the serialization and signing logic. `serializer.py` holds the core serialization and signing integration with 26 commits and 3 fixes. `timed.py` adds time-based signing with 24 commits and 1 fix. `exc.py` defines the exception hierarchy used by 6 files but has no fixes. Bug fixes land in `serializer.py` with 3 fixes and `timed.py` with 1 fix. No load-bearing files exist. Ownership is shared for `serializer.py` and `timed.py`.

## Why these files are hot

`serializer.py` is the central hub for serializing and signing data. It changes often because it integrates the serializer with the signer and handles payload loading and dumping. 3 of its 26 commits were fixes. It is depended on by `timed.py`, `url_safe.py` and `__init__.py`. The single test file is `test_serializer.py`. Before editing this file, run `test_serializer.py`.

`timed.py` extends the signer with timestamp support for expiration. It changes often because it manages time validation and signature aging. 1 of its 24 commits was a fix. It is depended on by `url_safe.py` and `__init__.py`. The single test file is `test_timed.py`. Before editing this file, run `test_timed.py`.

`exc.py` defines the exception hierarchy for all error cases in the library. It is stable with only 8 commits but has 6 dependents. It has 4 test files covering it. Before editing this file, run the tests in `test_encoding.py`, `test_serializer.py`, `test_signer.py` and `test_timed.py`.

## Change coupling

`serializer.py` and `url_safe.py` move together with 100 coupling because `url_safe.py` wraps `serializer.py`. Open `url_safe.py` when editing `serializer.py`.
`serializer.py` and `encoding.py` move together with 100 coupling because `serializer.py` uses encoding utilities. Open `encoding.py` when editing `serializer.py`.
`timed.py` and `exc.py` move together with 88 coupling because `timed.py` raises time-based exceptions. Open `exc.py` when editing `timed.py`.
`serializer.py` and `signer.py` move together with 77 coupling because `serializer.py` uses `signer.py`. Open `signer.py` when editing `serializer.py`.
`exc.py` and `serializer.py` move together with 75 coupling because `serializer.py` raises exceptions from `exc.py`. Open `exc.py` when editing `serializer.py`.

## What to read first

1. `src/itsdangerous/exc.py` to understand the exception hierarchy used everywhere.
2. `src/itsdangerous/serializer.py` to see the core serialization and signing integration.
3. `src/itsdangerous/timed.py` to see how time-based signing extends the base signer.
4. `tests/test_itsdangerous/test_serializer.py` to see how the serializer is tested.
5. `tests/test_itsdangerous/test_timed.py` to see how the timed signer is tested.
```