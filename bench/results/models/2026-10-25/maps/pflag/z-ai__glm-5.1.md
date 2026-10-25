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

Change risk concentrates in flag.go, which holds the FlagSet state machine, the Value and SliceValue interfaces, and the command-line parser. Bug fixes land in flag.go (34 fixes), string_slice.go (8 fixes), and golangflag.go (5 fixes). No load-bearing files exist in the ranked set. Ownership is diffuse: 107 authors contributed, and the top committer to flag.go owns only 16 percent of its changes. 1 generated file is excluded from this map.

## Why these files are hot

flag.go defines the FlagSet struct, the Value and SliceValue interfaces, and the parseLongArg, parseShortArg, and Parse methods that walk the argument list. It changed in 148 commits and 34 of those were fixes. The FlagSet fields (actual, formal, shorthands, argsLenAtDash) are mutable state that the parser mutates in place. An edit that changes the order of operations or the unknown-flag path breaks downstream consumers. Tests: flag_test.go, example_test.go. Before editing this file, run `go test` and verify that Parse still handles the unknown-flag and interspersed-argument paths.

golangflag.go bridges the standard library flag package to pflag through PFlagFromGoFlag, AddGoFlagSet, and CopyToGoFlagSet. 5 of its 14 commits were fixes. The wrapFlagValue function and the goBoolFlag interface check cause regressions when the standard library changes. Tests: golangflag_test.go, example_test.go. Before editing this file, open flag.go alongside it and verify that the flagValueWrapper still satisfies the Value interface.

string_slice.go implements the stringSliceValue type with CSV read and write helpers. 8 of its 18 commits were fixes. The Set method appends on repeated calls, and CSV quoting rules interact with shell quoting in ways that regress. Tests: string_slice_test.go, example_test.go. Before editing this file, run string_slice_test.go and verify that comma-separated and quoted inputs still parse correctly.

string_to_string.go implements the stringToStringValue map type with CSV parsing for key=value pairs. The Set method clears defaults on first change and merges on subsequent calls. Tests: string_to_string_test.go, example_test.go. Before editing this file, run string_to_string_test.go and check that the merge-on-repeat behavior stays consistent.

ip_slice.go implements the ipSliceValue type, which parses comma-separated IP strings through readAsCSV and net.ParseIP. 4 of its 7 commits were fixes, mostly around quote stripping and the empty-slice edge case. Tests: ip_slice_test.go, example_test.go. Before editing this file, run ip_slice_test.go and confirm that quoted and unquoted IP arguments produce the same result.

## Change coupling

The scalar type files bool.go, int.go, int8.go, int32.go, int64.go, uint.go, uint8.go, float32.go, and float64.go show 100 percent coupling: every commit that touches one file touches all the others. This coupling is by design; each file follows the same template of value type, Set, Type, String, Var, and convenience functions. The uint16.go and uint32.go pair shows the same pattern at 100 percent coupling over 8 commits. When you change a method in one scalar type file, open every other file in the cluster and apply the same change.

## What to read first

1. flag.go — defines the Value and SliceValue interfaces and the FlagSet parser that every type file plugs into.
2. golangflag.go — shows how the standard library adapter wraps values and reveals the Value contract.
3. string_slice.go — the type file with the most fixes; its CSV pattern is replicated in string_to_string.go and ip_slice.go.
4. bool.go — the simplest scalar type file; read it as a template before you edit any other scalar type.
5. errors.go — defines the error paths that the parser returns and traces the fix-prone areas.