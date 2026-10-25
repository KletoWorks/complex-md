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
The change risk concentrates in the flag parsing and related value types. The top risk file is `flag.go`, which handles flag definitions and parsing. Bug fixes land primarily in `flag.go` with 34 fixes. The repository has a diverse ownership pattern, with 60 authors contributing to `flag.go` and no single owner having more than 16% of the commits. There are no load-bearing files that many other files depend on but are rarely changed.

## Why these files are hot
`flag.go` is a large file (1421 lines) that has changed 148 times, with 34 of those changes being fixes. It implements POSIX/GNU-style flag parsing and is a core part of the library. Before editing this file, run the tests in `example_test.go` and `flag_test.go` to verify changes. 

`golangflag.go` adapts Go's native flag package to pflag. It has changed 14 times, with 5 fixes, and is covered by `example_test.go` and `golangflag_test.go`. Before editing this file, check the compatibility with Go's native flag package. 

`string_slice.go` implements a string slice flag type. It has changed 18 times, with 8 fixes. Before editing this file, run `string_slice_test.go` to verify the changes.

`string_to_string.go` implements a map flag type. It has changed 7 times. Before editing this file, run `string_to_string_test.go` to verify the changes.

`ip_slice.go` implements an IP slice flag type. It has changed 7 times, with 4 fixes. Before editing this file, run `ip_slice_test.go` to verify the changes.

## Change coupling
The files `bool.go`, `float32.go`, `float64.go`, `int.go`, `int32.go`, `int64.go`, `int8.go`, `uint.go`, `uint8.go`, `uint16.go`, and `uint32.go` are coupled because they implement similar flag types and have been changed together 7 or 8 times. The coupling is by design, as they are part of the same flag type system. When editing one of these files, check the corresponding files for consistency. For example, when editing `bool.go`, check `float32.go` and other related files.

## What to read first
1. `flag.go` - Understand the core flag parsing logic and its tests in `example_test.go` and `flag_test.go`.
2. `golangflag.go` - Understand how Go's native flag package is adapted to pflag.
3. `string_slice.go` - Understand the implementation of string slice flag type and its test in `string_slice_test.go`.
4. Documentation on flag usage - Understand how flags are used in the application.

These files provide a foundation for understanding the flag parsing logic and related value types, which are critical to the library's functionality.