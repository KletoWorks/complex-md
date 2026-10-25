```markdown
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

Change risk concentrates in flag.go, the core POSIX/GNU-style flag parsing logic with 34 fixes over 148 commits. Bug fixes land in flag.go with 34 fixes, string_slice.go with 8 fixes, and text.go with 5 fixes. No load-bearing files exist. Ownership is distributed with 60 authors touching flag.go.

## Why these files are hot

flag.go is the main flag parsing implementation with 1421 lines and 148 commits, handling command-line argument parsing and flag registration. It has 34 fixes, showing frequent bug discovery. Tests in example_test.go and flag_test.go cover it. Before editing this file, run the full test suite with `go test -v`.

string_slice.go implements comma-separated string slice flags with 175 lines and 18 commits, containing 8 fixes. It depends on CSV parsing logic and is tested by string_slice_test.go. Before editing this file, verify CSV parsing behavior with the existing tests.

golangflag.go provides Go flag compatibility with 160 lines and 14 commits, containing 5 fixes. It wraps Go's flag.Value interface and is tested by golangflag_test.go. Before editing this file, check compatibility with standard library flag behavior.

## Change coupling

The numeric type files move together in perfect coupling: uint16.go and uint32.go share 8 commits, bool.go pairs with float32.go, float64.go, int.go, int32.go, int64.go, int8.go, uint.go, and uint8.go each with 7 commits at 100 percent coupling. float32.go and float64.go share 7 commits at 100 percent coupling. These are by design as they implement the same Value interface pattern. When editing one numeric type file, open its paired files to keep implementations consistent.

## What to read first

1. flag.go to understand the core flag parsing logic and public API.
2. string_slice.go to see the slice flag implementation pattern.
3. golangflag.go to learn the compatibility layer with Go's standard flag package.
4. example_test.go to see usage examples for all flag types.
```