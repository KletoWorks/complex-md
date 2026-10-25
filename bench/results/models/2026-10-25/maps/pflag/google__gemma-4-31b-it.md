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

Risk concentrates in flag parsing logic and type-specific value handlers. The core parsing engine and `FlagSet` state live in `flag.go`. Bug fixes land primarily in `flag.go` with 34 fixes. No load-bearing files exist. Ownership is distributed across many authors. The map does not cover generated or lock files.

## Why these files are hot

`flag.go` implements the POSIX/GNU flag parsing engine and `FlagSet` management. It has high churn and 34 fixes due to complex parsing rules for shorthands and interspersed arguments. It is covered by `flag_test.go` and `example_test.go`. Before editing this file, run `go test -v flag_test.go`.

`golangflag.go` provides compatibility wrappers between `pflag` and the standard library `flag` package. It changes when compatibility requirements or reflection-based type approximations shift. It is covered by `golangflag_test.go` and `example_test.go`. Before editing this file, run `go test -v golangflag_test.go`.

`string_slice.go` handles comma-separated string lists using `encoding/csv`. High churn and 8 fixes suggest edge cases in CSV parsing or slice appending. It is covered by `string_slice_test.go` and `example_test.go`. Before editing this file, run `go test -v string_slice_test.go`.

`string_to_string.go` parses `key=value` pairs into maps. It changes to handle complex quoting or multi-value merging. It is covered by `string_to_string_test.go` and `example_test.go`. Before editing this file, run `go test -v string_to_string_test.go`.

`ip_slice.go` converts comma-separated strings to `net.IP` slices. Churn relates to IP parsing and quote removal logic. It is covered by `ip_slice_test.go` and `example_test.go`. Before editing this file, run `go test -v ip_slice_test.go`.

## Change coupling

Basic type handlers move together with 100% coupling. `bool.go` co-changes with almost every primitive type file, including `int.go`, `uint.go`, and `float32.go`. This coupling is by design as these files implement a common `Value` interface. `uint16.go` and `uint32.go` also move together 100% of the time. Open all affected type files when modifying the `Value` interface.

## What to read first

1. `flag.go` to understand the `FlagSet` and `Flag` structures.
2. `flag.go` to study the `Parse` and `parseArgs` logic.
3. `golangflag.go` to see how the package interacts with the standard library.
4. `string_slice.go` as a reference for how custom types implement the `Value` interface.