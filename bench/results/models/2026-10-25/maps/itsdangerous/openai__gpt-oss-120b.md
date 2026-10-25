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
load_bearing: []
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
seams: []
blind_spots:
  - "1 generated or lock files excluded"
  - "133 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
  - "dependencies not resolved for 1 .bat files: their fan_in and covering tests are undercounted"
---

## Where the risk lives

Change risk concentrates in the serialization and signing subsystem of the library.  
The subsystem includes Serializer, TimedSerializer, Signer, and the exception hierarchy.  
Bug fixes land most often in src/itsdangerous/serializer.py (3 fixes) and src/itsdangerous/timed.py (1 fix).  
No load‑bearing files are listed; every core file has at least one dependent.  
Ownership is shared; the top three hotspots have 4‑6 different authors and an owner share above 0.7.

## Why these files are hot

Serializer wraps a Signer to serialize and sign data.  
It is imported by __init__, timed, and url_safe.  
It changed 26 times and three commits fixed bugs (13 % of its changes).  
One test file covers it.  
Before editing this file, run tests/test_itsdangerous/test_serializer.py.  

TimedSerializer builds on Serializer to add timestamped signatures.  
It is imported by __init__ and url_safe.  
It changed 24 times and one commit fixed a bug (4 % of its changes).  
One test file covers it.  
Before editing this file, run tests/test_itsdangerous/test_timed.py.  

exc.py defines the exception hierarchy used by the whole package.  
Six other source files depend on it, giving it the highest fan‑in of 6.  
It changed 8 times with no recorded fixes.  
Four test files cover its behavior.  
Before editing this file, run the four exception tests.  

## Change coupling

Serializer and url_safe.py changed together in every commit that touched url_safe.py (100 % coupling).  
When changing serializer.py, also review url_safe.py.  

Serializer and signer.py co‑changed in 77 % of signer.py commits.  
When editing serializer.py, open signer.py to verify compatibility.  

Serializer and timed.py co‑changed in 46 % of timed.py commits.  
When updating serializer.py, run the timed serializer tests.  

exc.py and timed.py co‑changed in 88 % of timed.py commits.  
When fixing exc.py, check timed.py for dependent exception handling.  

encoding.py and serializer.py co‑changed in 100 % of encoding.py commits.  
When modifying encoding.py, run serializer tests to ensure encoding functions still work.  

## What to read first

- src/itsdangerous/serializer.py – core of serialization and signing.  
- src/itsdangerous/timed.py – timestamped signatures built on Serializer.  
- src/itsdangerous/exc.py – central exception definitions used everywhere.  
- src/itsdangerous/signer.py – underlying signer used by Serializer and TimedSerializer.  
- docs/conf.py – documentation configuration that co‑changes with the index.