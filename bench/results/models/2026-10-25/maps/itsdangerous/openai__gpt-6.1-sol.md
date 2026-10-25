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

`src/itsdangerous/serializer.py`, `src/itsdangerous/timed.py`, and `src/itsdangerous/exc.py` hold half the total score across serialization, signature expiry, and exception contracts.
Fix counts peak in serializer.py at 3; timed.py and `src/itsdangerous/encoding.py` each have 1.
The top committers account for 81% of serializer.py changes and 71% of timed.py changes.
The map excludes 1 generated or lock file.
History metrics exclude 133 bot commits.
Dependency analysis does not resolve 1 `.bat` file, so its dependent and test counts are too low.

## Why these files are hot

serializer.py connects payload conversion, serializer types, keys, salts, and signer configuration. Its 26 commits span this broad contract; 3 were fixes. timed.py and `src/itsdangerous/url_safe.py` depend on it, as does the public export file, `src/itsdangerous/__init__.py`. Changes can break text-versus-bytes results or subclass behavior. `tests/test_itsdangerous/test_serializer.py` covers it. Before editing this file, check test_serializer.py for text, bytes, key rotation, and fallback signer cases.

timed.py adds timestamps and expiry checks through `TimestampSigner` and `TimedSerializer`. Its 24 commits included 1 fix. It rejects future timestamps when `max_age` applies and stops fallback attempts after `SignatureExpired`. url_safe.py and __init__.py depend on it. Changes can alter expiry decisions, UTC timestamps, or exception selection. `tests/test_itsdangerous/test_timed.py` covers it. Before editing this file, check test_timed.py against expiry boundaries, malformed timestamps, and the stop-on-expiry contract.

exc.py defines exception inheritance and fields for payloads, timestamps, and original errors. Its 8 commits included 0 fixes; 6 dependent files make its interface a structural risk. Changes can break exception handlers across signature and payload validation. `tests/test_itsdangerous/test_encoding.py`, test_serializer.py, `tests/test_itsdangerous/test_signer.py`, and test_timed.py cover it. Before editing this file, preserve the exception hierarchy and the payload, date_signed, and original_error fields.

## Change coupling

serializer.py and `src/itsdangerous/signer.py` shared 10 commits, with 77% coupling. Their explicit interface connects key lists, salts, and signer configuration. encoding.py and serializer.py had 100% coupling; serializer.py uses `want_bytes` at the payload boundary. These pairs reflect direct dependencies, not evidence of duplicated logic. Check signer.py and encoding.py against serializer.py's key order, salt handling, and bytes contract.

serializer.py and url_safe.py had 100% coupling; timed.py and url_safe.py had 88% coupling. serializer.py and timed.py had weaker coupling at 46%. The dependency graph places url_safe.py above both serializer classes, so base interface changes can reach the same dependent. Open url_safe.py when either serializer class changes its payload hooks or method signatures.

exc.py and timed.py shared 7 commits, with 88% coupling. exc.py also had 75% coupling with both serializer.py and signer.py. The exception hierarchy supports this shared contract: timed.py catches `BadSignature` but treats `SignatureExpired` separately. Check exception handlers in timed.py, serializer.py, and signer.py when exception inheritance or fields change.

## What to read first

1. exc.py — defines the shared error hierarchy and diagnostic fields.
2. signer.py — supplies the base interface that both serializer classes use.
3. encoding.py — supplies byte conversion and timestamp conversion helpers.
4. serializer.py — defines payload hooks, serializer types, and signer configuration.
5. timed.py — extends the base contracts with timestamp validation and expiry.
6. url_safe.py — depends on both serializer classes and has strong historical coupling with them.