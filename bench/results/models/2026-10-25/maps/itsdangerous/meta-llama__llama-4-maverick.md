```yaml
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
Change risk concentrates in the `src/itsdangerous` directory, particularly in files related to serialization and signing. Bug fixes land in `src/itsdangerous/serializer.py` 3 times and `src/itsdangerous/timed.py` 1 time. The exception handling in `src/itsdangerous/exc.py` is used by 6 other files. Ownership is concentrated: 1 author wrote `src/itsdangerous/exc.py`, and 4 authors wrote `src/itsdangerous/serializer.py` with 1 author owning 81% of the commits. The map does not cover 1 generated or lock file and 133 commits by bots.

## Why these files are hot
The `src/itsdangerous/serializer.py` file implements a serializer that securely signs data. It changed 26 times, with 3 fixes, likely due to updates in serialization or signing logic. It is depended on by `src/itsdangerous/timed.py` and `src/itsdangerous/url_safe.py`. Before editing this file, run `tests/test_itsdangerous/test_serializer.py`.

The `src/itsdangerous/timed.py` file adds timestamping to the signer. It changed 24 times, with 1 fix, likely due to updates in timestamp handling. It is depended on by `src/itsdangerous/url_safe.py`. Before editing this file, run `tests/test_itsdangerous/test_timed.py`.

The `src/itsdangerous/exc.py` file defines custom exceptions for the library. It changed 8 times, with no fixes, likely due to updates in error handling. It is used by 6 other files, including `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py`. Before editing this file, check the callers in `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py`.

## Change coupling
The `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py` files move together 11 times, with 46% coupling, likely due to related changes in serialization and timestamping. Before editing `src/itsdangerous/serializer.py`, check `src/itsdangerous/timed.py`. The `src/itsdangerous/serializer.py` and `src/itsdangerous/signer.py` files move together 10 times, with 77% coupling, likely due to related changes in signing logic. Before editing `src/itsdangerous/signer.py`, check `src/itsdangerous/serializer.py`. The coupling between `src/itsdangerous/exc.py` and other files is by design, as it provides exceptions used throughout the library.

## What to read first
1. `src/itsdangerous/serializer.py` to understand the serialization logic and its dependencies.
2. `src/itsdangerous/timed.py` to understand how timestamping is integrated with serialization.
3. `src/itsdangerous/exc.py` to understand the custom exceptions used by the library.
4. `src/itsdangerous/signer.py` to understand the signing logic used by the serializer.
5. `tests/test_itsdangerous/test_serializer.py` to understand how the serializer is tested.