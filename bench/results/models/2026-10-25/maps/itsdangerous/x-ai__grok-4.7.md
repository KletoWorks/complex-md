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

Change risk sits in the sign and serialize code under src/itsdangerous. src/itsdangerous/serializer.py, src/itsdangerous/timed.py, and src/itsdangerous/exc.py hold half the score. serializer.py stores secret keys, serializes a payload, and verifies the signature. timed.py adds a timestamp and an age check on the Serializer contract. exc.py defines the exception tree, and 6 modules import it. Bug fixes landed mainly in serializer.py (3 fixes). timed.py, src/itsdangerous/encoding.py, and docs/conf.py each have 1 fix. No load-bearing file exists. Every high-fan-in file has commits in the window. One author owns 81% of commits on serializer.py (4 authors). One author owns 71% of commits on timed.py (6 authors). One author owns all 8 commits on exc.py. 133 bot commits stay out of churn and fixes. Those commits also stay out of authors and co-change. The map excludes 1 generated or lock file. Fan-in for 1 .bat file is undercounted.

## Why these files are hot

src/itsdangerous/serializer.py (404 lines) is the public Serializer. It keeps secret keys from oldest to newest and signs with the last key. It wraps a Signer, defaults to json, and tries fallback signers after a failed unsign. load_payload raises BadPayload on a bad payload. timed.py, src/itsdangerous/url_safe.py, and src/itsdangerous/__init__.py depend on it. 26 commits touched it, and 3 of them are fixes. tests/test_itsdangerous/test_serializer.py covers it. Before editing this file, keep the last key as the sign key and run tests/test_itsdangerous/test_serializer.py.

src/itsdangerous/timed.py (228 lines) defines TimestampSigner and TimedSerializer. TimestampSigner appends a base64 timestamp and splits it off in unsign. An age above max_age, or below 0, raises SignatureExpired. A missing timestamp raises BadTimeSignature. TimedSerializer subclasses Serializer and does not try the next signer after SignatureExpired. The returned timestamp is a UTC-aware datetime. __init__.py and url_safe.py depend on it. 24 commits touched it, and 1 of them is a fix. tests/test_itsdangerous/test_timed.py covers it. Before editing this file, keep SignatureExpired for age failures and run tests/test_itsdangerous/test_timed.py.

src/itsdangerous/exc.py (106 lines) is the exception hierarchy. BadData is the base class. BadSignature adds payload. BadTimeSignature adds date_signed. SignatureExpired subclasses BadTimeSignature. BadPayload subclasses BadData, not BadSignature, and stores original_error. 6 modules import this file. 8 commits touched it, and 0 of them are fixes. One author owns all of those commits. The cover is tests/test_itsdangerous/test_encoding.py, test_serializer.py, test_signer.py, and test_timed.py. Before editing this file, keep SignatureExpired under BadTimeSignature and run the 4 test files.

## Change coupling

src/itsdangerous/url_safe.py shared all 8 of its commits with serializer.py (coupling 100%). It also shared 7 commits with timed.py (coupling 88%). url_safe.py is a thin subclass layer, so the coupling is by design. Open url_safe.py when you change serializer.py or timed.py.

serializer.py and timed.py shared 11 commits (coupling 46%). TimedSerializer overrides loads on Serializer. Open timed.py when you change loads or the fallback signer list.

serializer.py and src/itsdangerous/signer.py shared 10 commits (coupling 77%). Serializer builds a Signer and calls unsign on it. encoding.py shared all 6 of its commits with serializer.py (coupling 100%). Open signer.py and encoding.py when you change serializer.py.

exc.py and timed.py shared 7 commits (coupling 88%). exc.py also shared 6 commits with serializer.py and 6 with signer.py (coupling 75% each). Callers catch BadSignature, and SignatureExpired is a subclass of it. Open exc.py when you change an unsign error.

src/itsdangerous/_json.py and serializer.py shared 8 commits (coupling 80%). Serializer sets default_serializer to the json module. Open _json.py when you change the default serializer.

No directory seam is in the data.

## What to read first

1. src/itsdangerous/exc.py: exception tree with fan-in 6, raised by serializer.py and timed.py.
2. src/itsdangerous/signer.py: Signer base class that serializer.py instantiates.
3. src/itsdangerous/encoding.py: byte, base64, and int helpers on the payload path.
4. src/itsdangerous/serializer.py: public dumps, loads, and secret key order.
5. src/itsdangerous/timed.py: timestamp layout and max_age rules.
6. tests/test_itsdangerous/test_serializer.py: only test file that covers serializer.py.