---
complex_md: "0.3"
generated: 2026-10-19
commit: d26a4dc
tool: complex-md/0.10.0
window_commits: 296
files_analyzed: 45
profile:
  files_total: 90
  files_in_scope: 45
  loc_in_scope: 6611
  kinds: "source 45, test 33, other 5, docs 3, ci 2, manifest 1, generated 1"
  languages: "go 42, sh 3"
  dependency_edges: 42
  commits_total: 296
  commits_analyzed: 296
  commits_skipped: 0
  half_life_commits: 74
  window_from: 2012-04-26
  window_to: 2026-10-19
  velocity_30d: 1.7
  authors_total: 107
  concentration_50: 12
  hotspot_cut: 7
  pair_min: 3
  confidence: "structure+history"
hotspots:
  - path: flag.go
    kind: source
    loc: 1421
    churn: 148
    churn_w: 41.54
    fixes: 34
    authors: 60
    owner_share: 0.16
    fan_in: 0
    tests: 2
    score: 740
  - path: golangflag.go
    kind: source
    loc: 160
    churn: 14
    churn_w: 6.93
    fixes: 5
    authors: 9
    owner_share: 0.29
    fan_in: 0
    tests: 2
    score: 222
  - path: string_slice.go
    kind: source
    loc: 175
    churn: 18
    churn_w: 4.92
    fixes: 8
    authors: 10
    owner_share: 0.39
    fan_in: 0
    tests: 2
    score: 191
  - path: string_to_string.go
    kind: source
    loc: 204
    churn: 7
    churn_w: 4.80
    fixes: 1
    authors: 6
    owner_share: 0.29
    fan_in: 0
    tests: 2
    score: 183
  - path: ip_slice.go
    kind: source
    loc: 188
    churn: 7
    churn_w: 3.96
    fixes: 4
    authors: 5
    owner_share: 0.43
    fan_in: 0
    tests: 2
    score: 177
  - path: text.go
    kind: source
    loc: 80
    churn: 6
    churn_w: 4.24
    fixes: 5
    authors: 4
    owner_share: 0.33
    fan_in: 0
    tests: 2
    score: 162
  - path: time.go
    kind: source
    loc: 123
    churn: 5
    churn_w: 2.96
    fixes: 1
    authors: 4
    owner_share: 0.40
    fan_in: 0
    tests: 2
    score: 136
load_bearing:
co_change:
  - files: [uint16.go, uint32.go]
    count: 8
    coupling: 100
  - files: [bool.go, float32.go]
    count: 7
    coupling: 100
  - files: [bool.go, float64.go]
    count: 7
    coupling: 100
  - files: [bool.go, int.go]
    count: 7
    coupling: 100
  - files: [bool.go, int32.go]
    count: 7
    coupling: 100
  - files: [bool.go, int64.go]
    count: 7
    coupling: 100
  - files: [bool.go, int8.go]
    count: 7
    coupling: 100
  - files: [bool.go, uint.go]
    count: 7
    coupling: 100
  - files: [bool.go, uint8.go]
    count: 7
    coupling: 100
  - files: [float32.go, float64.go]
    count: 7
    coupling: 100
seams:
blind_spots:
  - "1 generated or lock files excluded"
---

## Where the risk lives

Change risk concentrates in the core flag parsing engine `flag.go` and the type-specific flag value implementations, especially `string_slice.go`, `string_to_string.go`, `ip_slice.go`, `text.go`, and `time.go`. Bug fixes land most often in `flag.go` (34 fixes), `string_slice.go` (8 fixes), and `ip_slice.go` (4 fixes). No files are load-bearing. Ownership is widely distributed across 107 committers; no single author controls more than 16% of the highest-churn file.

## Why these files are hot

`flag.go` implements the FlagSet, flag definition, and command-line parsing. Its 1421 lines receive the most changes (148 commits, 34 fixes) from the most authors. Tests in `example_test.go` and `flag_test.go` cover it. Before editing this file, run `go test ./...` and verify that no existing FlagSet behavior or error‑handling mode changes.

`golangflag.go` bridges Go’s standard `flag` package into pflag. Five of its 14 changes were fixes. Tests in `golangflag_test.go` cover it. Before editing this file, run `go test -run GoFlag` and check that flag wrapping and `AddGoFlagSet` preserve the original behavior.

`string_slice.go` handles comma‑separated string slices with CSV parsing. Its 8 fixes address parsing and serialization edge cases. Tests in `string_slice_test.go` cover it. Before editing this file, run `go test -run StringSlice` and verify that CSV round‑trips and append operations work on all input formats.

`string_to_string.go` provides key=value map flags with CSV‑aware parsing. Its only fix side, but the complex parsing logic has high change weight. Tests in `string_to_string_test.go` cover it. Before editing this file, run `go test -run StringToString` and confirm that all key=value formats from its doc comment still parse correctly.

`ip_slice.go` manages lists of IP addresses with CSV input. Four of its 7 changes were fixes. Tests in `ip_slice_test.go` cover it. Before editing this file, run `go test -run IPSlice` and validate that valid and invalid IP strings produce the expected results.

## Change coupling

Files for primitive flag types (`bool.go`, `int.go`, `int8.go`, `int16.go`, `int32.go`, `int64.go`, `uint.go`, `uint8.go`, `uint16.go`, `uint32.go`, `uint64.go`, `float32.go`, `float64.go`) change together in every commit that touches any of them—coupling is 100%. This is by design: they share the same value wrapper pattern and API surface. When editing one of these files, open all sibling type files and apply the matching change to keep their implementations consistent.

## What to read first

1. `flag.go` — the core FlagSet, parsing, and error handling; the largest and most‑changed file.
2. `golangflag.go` — the adapter that makes standard `flag` flags work inside pflag.
3. `flag_test.go` — the main test suite, which exercises most public API paths.
4. `string_slice.go` — a representative complex flag‑value type with CSV parsing and slice semantics.
5. `byte.go` — a simpler value type (`bytesHex`) that shows the basic Value interface implementation pattern.