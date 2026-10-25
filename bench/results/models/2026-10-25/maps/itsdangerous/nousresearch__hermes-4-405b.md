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

Risk concentrates in the serialization layer. The top three hotspots are `src/itsdangerous/serializer.py` (score 2780), `src/itsdangerous/timed.py` (score 1917), and `src/itsdangerous/exc.py` (score 1815). These files handle core serialization, time-based signatures, and error definitions. Bug fixes land most often in `src/itsdangerous/serializer.py` (3 fixes) and `src/itsdangerous/timed.py` (1 fix). The `src/itsdangerous/exc.py` file is depended on by six other files but has not been fixed in the analysis window. The `src/itsdangerous/serializer.py` file has one dominant owner (81% share). There are no load-bearing files that were not touched in the window. The map does not cover one generated file and one .bat file.

## Why these files are hot

The `src/itsdangerous/serializer.py` file (404 lines) handles data serialization and signing. It changes often (26 commits, 3 fixes). It is depended on by `src/itsdangerous/__init__.py`, `src/itsdangerous/timed.py`, and `src/itsdangerous/url_safe.py`. One test file covers it. Before editing this file, run the tests in `tests/test_itsdangerous/test_serializer.py`.

The `src/itsdangerous/timed.py` file (228 lines) handles time-based signatures. It changes often (24 commits, 1 fix). It is depended on by `src/itsdangerous/__init__.py` and `src/itsdangerous/url_safe.py`. One test file covers it. Before editing this file, run the tests in `tests/test_itsdangerous/test_timed.py`.

The `src/itsdangerous/exc.py` file (106 lines) defines all custom exceptions. It changes less often (8 commits, 0 fixes). It is depended on by six files including `src/itsdangerous/serializer.py`, `src/itsdangerous/signer.py`, and `src/itsdangerous/timed.py`. Four test files cover it. Before editing this file, run all tests that cover it.

## Change coupling

The `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py` files change together in 46% of the quieter file's commits. When you change one, open the other. The `src/itsdangerous/serializer.py` and `src/itsdangerous/signer.py` files change together in 77% of the quieter file's commits. When you change one, open the other. The `src/itsdangerous/serializer.py` and `src/itsdangerous/url_safe.py` files change together in 100% of the quieter file's commits. When you change one, open the other. The `src/itsdangerous/exc.py` and `src/itsdangerous/timed.py` files change together in 88% of the quieter file's commits. When you change one, open the other. The `src/itsdangerous/timed.py` and `src/itsdangerous/url_safe.py` files change together in 88% of the quieter file's commits. When you change one, open the other.

## What to read first

1. `src/itsdangerous/serializer.py`: This is the core serialization logic. Read it to understand how data is signed and verified.
2. `src/itsdangerous/timed.py`: This adds time-based signatures. Read it to understand how expiration works.
3. `src/itsdangerous/exc.py`: This defines all custom exceptions. Read it to understand the error hierarchy.