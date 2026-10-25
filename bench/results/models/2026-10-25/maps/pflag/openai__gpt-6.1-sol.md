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

Change risk centers on `flag.go`, which defines the public flag contracts, parser state, and command-line syntax.
The type adapters add compatibility, CSV, and default-value contracts within the same package.
Fix commits touched `flag.go` 34 times, `string_slice.go` 8 times, and `golangflag.go` 5 times.
Ownership is diffuse: `flag.go` had 60 authors, and its top committer supplied 16% of its commits.
The analysis found no untouched load-bearing files.
The map excludes 1 generated or lock file.

## Why these files are hot

`flag.go` defines `FlagSet`, `Flag`, `Value`, and `SliceValue`; it also provides name normalization, argument parsing, and help output.
Its 148 commits span these shared contracts.
The adapters use these contracts within package pflag, despite 0 measured file dependents.
Parser edits can alter shorthand groups, unknown flags, and the `--` terminator.
`example_test.go` and `flag_test.go` cover this file.
Before editing this file, review `flag_test.go` for the argument syntax that your change affects.

`golangflag.go` bridges Go flags and pflag through value wrappers, shorthand conversion, and flag-set copies.
Its history includes 5 fixes across 14 commits.
Edits affect callers that mix both flag packages, although the graph records 0 dependents.
Boolean conversion sets `NoOptDefVal`; the reverse copy selects concrete types for help output.
`example_test.go` and `golangflag_test.go` cover this file.
Before editing this file, review `golangflag_test.go` for conversion behavior in both directions.

`string_slice.go` implements CSV values and the `SliceValue` methods.
Its history includes 8 fixes across 18 commits.
The first `Set` replaces defaults; later calls append values.
`ip_slice.go` directly uses its CSV helpers, despite 0 measured dependents.
CSV edits therefore affect more than string flags.
`example_test.go` and `string_slice_test.go` cover this file.
Before editing this file, open `ip_slice.go` to check the shared CSV contract.

`string_to_string.go` parses map flags and emits sorted CSV text.
Its history includes 7 commits and 1 fix.
A single equals sign permits commas within the value; multiple equals signs select the CSV parser.
`GetStringToString` returns the internal map, so callers observe shared mutations; the graph records 0 dependents.
`example_test.go` and `string_to_string_test.go` cover this file.
Before editing this file, preserve the single-record CSV check before any mutation of the map.

`ip_slice.go` validates IP values before it replaces defaults or appends later values.
Its history includes 4 fixes across 7 commits.
It shares CSV helpers with `string_slice.go` and implements `SliceValue`.
Edits affect IP flag callers through `Set`, `Replace`, and typed retrieval; the graph records 0 dependents.
`example_test.go` and `ip_slice_test.go` cover this file.
Before editing this file, review `ip_slice_test.go` for invalid inputs that must leave the previous value intact.

## Change coupling

`uint16.go` and `uint32.go` shared 8 commits at 100% coupling.
`bool.go` paired with the listed numeric adapters across 7 commits at 100% coupling.
`float32.go` and `float64.go` also shared 7 commits at 100% coupling.
These counts show coordinated maintenance, but the supplied excerpts do not establish design coupling or duplicated defects.
The analysis excluded `flag.go` and `flag_test.go` as convention files, so their absence does not establish independence.
Compare the paired adapters for equivalent public behavior before a type-specific API change.

## What to read first

1. `flag.go`: Read the public interfaces and `FlagSet` state before changes to any adapter.
2. `flag_test.go`: Read the executable cases for argument syntax and parser behavior.
3. `golangflag.go`: Read the bridge between Go flags and pflag before compatibility changes.
4. `string_slice.go`: Read the shared CSV helpers and the first-call replacement rule.
5. `string_to_string.go`: Read the map alias contract and CSV validation before changes to map flags.
6. `ip_slice.go`: Read validation before mutation and the shared CSV calls before changes to slice behavior.