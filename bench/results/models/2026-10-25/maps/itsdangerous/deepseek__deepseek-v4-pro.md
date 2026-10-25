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
Change risk lives in the serialization and signing pipeline. `src/itsdangerous/serializer.py` and `src/itsdangerous/timed.py` are the two hotspots; they define the core `Serializer` and time‑aware `TimedSerializer` public API. Both change often and carry the most history. `src/itsdangerous/exc.py` changes rarely but is imported by every other source file; a broken exception class can break all dependents. Bug fixes land most often in `src/itsdangerous/serializer.py` (3 fixes), then in `timed.py` and `url_safe.py` (1 each). The exception and encoding modules are each owned by a single author; serializer and timed have a dominant owner (81 % and 71 % of commits). The analysis excludes 133 bot commits, so churn and co‑change counts may be lower than actual.

## Why these files are hot
`src/itsdangerous/serializer.py` (404 lines, 26 commits, 3 fixes) is the base `Serializer` that wraps a `Signer` to sign and serialize arbitrary data. It uses the signer, encoding, and exception modules. The file changed 26 times in the window, 3 of them bug fixes. Three dependents inherit its behavior: `timed.py`, `url_safe.py`, and `__init__.py`. One test file covers it: `tests/test_itsdangerous/test_serializer.py`. Before editing this file, run the suite with `pytest tests/test_itsdangerous/test_serializer.py` and check that `timed.py` and `url_safe.py` still work.

`src/itsdangerous/timed.py` (228 lines, 24 commits, 1 fix) extends the signer and serializer with time‑based expiration via `TimestampSigner` and `TimedSerializer`. It relies on serializer, signer, and encoding. The file was changed 24 times. Its dependents are `url_safe.py` and `__init__.py`. The covering test is `tests/test_itsdangerous/test_timed.py`. Before editing this file, run `pytest tests/test_itsdangerous/test_timed.py` and verify that `url_safe.py` and `serializer.py` stay compatible.

`src/itsdangerous/exc.py` (106 lines, 8 commits, 0 fixes) holds the exception hierarchy from `BadData` to `SignatureExpired`. All six source modules import it. The file changed only 8 times, but any modification to exception signatures or attributes can cascade. Four test files exercise it: `test_encoding.py`, `test_serializer.py`, `test_signer.py`, and `test_timed.py`. Before editing this file, run the full test suite with `pytest tests/` and inspect every dependent for exception handling.

## Change coupling
`serializer.py` and `signer.py` share 10 commits (77 % coupling). When serializer changes, signer often needs adjustment because serializer depends on `Signer` internals. Open `signer.py` alongside `serializer.py` and keep signature methods aligned.

`serializer.py` and `url_safe.py` share 8 commits (100 % coupling). `URLSafeSerializer` is a direct subclass; any interface change to serializer must also update url_safe. Edit both files together.

`serializer.py` and `timed.py` share 11 commits (46 % coupling). `TimedSerializer` overrides serializer methods; changes to the common behavior require coordinated edits. When you touch serializer, open timed.py and check the overrides.

`encoding.py` and `serializer.py` share 6 commits (100 % coupling). Encoding helpers like `want_bytes` and `base64_decode` are used by serializer; a change to encoding forces a serializer update. Open both files in the same edit.

`_json.py` and `serializer.py` share 8 commits (80 % coupling). The `_json` module is the default data serializer; when its `dumps`/`loads` interface shifts, serializer must adapt. Check serializer `load_payload` and `dump_payload` when you edit `_json.py`.

`exc.py` and `timed.py` share 7 commits (88 % coupling). `TimedSigner.unsign` raises `BadTimeSignature` and `SignatureExpired`; changes to these exceptions must be reflected in timed. Open `exc.py` with `timed.py` when modifying exception attributes.

## What to read first
1. `src/itsdangerous/exc.py` — learn the exception classes that every module catches or raises.
2. `src/itsdangerous/encoding.py` — see the byte‑encoding helpers used by all signers.
3. `src/itsdangerous/signer.py` — understand the base `Signer` that serializer wraps.
4. `src/itsdangerous/serializer.py` — read the core `Serializer` that combines signer and encoding.
5. `src/itsdangerous/timed.py` — study the time‑aware `TimestampSigner` and `TimedSerializer`.
6. `tests/test_itsdangerous/test_serializer.py` — the primary test covering the full serialization flow.