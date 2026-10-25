```yaml
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
```

## Where the risk lives

Risk concentrates in the central command-line parser and the individual flag type parsers. The codebase is a flat single-package Go library where `flag.go` controls option parsing, shorthand resolution, and flag set state. Bug fixes land primarily in `flag.go` with 34 fixes, `string_slice.go` with 8 fixes, and `golangflag.go` with 5 fixes. No files qualify as load-bearing because all types live in the same package and export directly to consumers. Over 107 contributors touched the repository, and the top committer wrote only 16 percent of `flag.go`. One generated or lock file is excluded from this analysis.

## Why these files are hot

`flag.go` provides the core `FlagSet` parser and the public POSIX command-line interface. It changes frequently because all CLI syntax options, shorthand lookups, normalization functions, and error policies converge here. 34 of its 148 commits were bug fixes. Every type implementation and client application relies on its methods. It is covered by `flag_test.go` and `example_test.go`. Before editing this file, run `go test -run Test.* flag_test.go example_test.go`.

`golangflag.go` adapts the standard Go `flag` package into `pflag.FlagSet` instances. It bridges compatibility gaps such as boolean option reflection, type wrappers, and `go test` flag forwarding. 5 of its 14 commits were bug fixes. Edits risk breaking standard library flag interop in frameworks like Cobra. It is covered by `golangflag_test.go` and `example_test.go`. Before editing this file, verify type wrapper conversions against `golangflag_test.go`.

`string_slice.go` defines slice flag parsing through CSV encoding. It changes often because CSV quote stripping, comma splitting, and repeated flag appending create edge cases. 8 of its 18 commits were bug fixes. Any change to parsing semantics alters how lists parse from command lines. It is covered by `string_slice_test.go` and `example_test.go`. Before editing this file, run `go test -run Test.* string_slice_test.go`.

`string_to_string.go` implements map flag parsing from comma-separated key-value pairs. It handles quote preservation, multi-record CSV checks, and map merging. The parser must preserve commas within values without breaking standard splitting. It is covered by `string_to_string_test.go` and `example_test.go`. Before editing this file, check that key-value parsing handles escaped quotes in `string_to_string_test.go`.

`ip_slice.go` parses comma-separated IP network addresses into `net.IP` slices. 4 of its 7 commits were bug fixes for CSV quotes and IP formatting errors. An edit here alters validation logic across network flag definitions. It is covered by `ip_slice_test.go` and `example_test.go`. Before editing this file, verify slice parsing against invalid IPs in `ip_slice_test.go`.

## Change coupling

Scalar value types move together across commits with 100 percent coupling. Pairs like `uint16.go` and `uint32.go` (8 commits) or `bool.go`, `int.go`, and `float64.go` (7 commits) change simultaneously because each scalar type duplicates the same boilerplate structure. This coupling is structural decay caused by manual code duplication instead of code generation. When you modify method signatures in one scalar type file, check every other primitive scalar file for the same change.

## What to read first

1. `flag.go` defines the central `FlagSet` struct, parsing loop, and the `Value` interface.
2. `golangflag.go` shows how external Go flags convert to internal `pflag.Value` instances.
3. `string_slice.go` demonstrates the reference implementation for slice types and CSV splitting.
4. `string_to_string.go` demonstrates map parsing rules and CSV delimiter handling.
5. `bool.go` provides the baseline implementation pattern used by all primitive scalar flag types.