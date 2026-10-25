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

## Where the risk lives

Change risk concentrates in flag.go: 148 commits touched it, 34 were fixes, and 60 authors changed it. Flag.go holds the core FlagSet struct, the Value interface, the parser, and the top-level API. Bug fixes land there and in string_slice.go (8 fixes). The Value interface and its implementers (stringSliceValue, stringToStringValue, ipSliceValue, textValue, timeValue) form a contract that all flag types must satisfy. Ownership is evenly distributed: no single author holds more than 43% of any hotspot. There are no load-bearing files; fan_in is 0 for every hotspot because callers import this library, not individual files.

## Why these files are hot

flag.go defines the FlagSet, the Value interface, and the parsing logic. It absorbs 23% of all commits. Its history shows 34 fix commits, indicating persistent bugs in edge-case handling (negatives, interspersed args, shorthand combinations). Tests in example_test.go and flag_test.go cover it. Before editing this file, run `go test` to verify the parser behavior.

golangflag.go wraps Go's standard flag package for interoperability. It has 5 fixes and 14 commits, most around the Value wrapper and the type switch in CopyToGoFlagSet. Tests are in example_test.go and golangflag_test.go. Before editing this file, run `go test` to check Go flag round-trip behavior.

string_slice.go implements CSV parsing for repeated string arguments. It has 8 fixes, the highest fix count after flag.go, indicating repeated bugs in CSV edge cases. Tests are in example_test.go and string_slice_test.go. Before editing this file, run the string_slice tests to check comma and quote handling.

string_to_string.go implements key=value map parsing with CSV and quoting rules. Its churn (4.80) is high relative to its 7 commits because each commit made significant changes. Tests are in example_test.go and string_to_string_test.go. Before editing this file, run the string_to_string tests to check key=value parsing.

ip_slice.go parses comma-separated IP addresses into []net.IP. It has 4 fixes and 7 commits, with bugs around net.ParseIP failures and CSV quoting. Tests are in example_test.go and ip_slice_test.go. Before editing this file, run the ip_slice tests to check IP parsing.

text.go wraps encoding.TextMarshaler for custom flag types. It has 5 fixes in 6 commits, the highest fix density of the slice types. Tests are in example_test.go and text_test.go. Before editing this file, run the text tests to check text marshaling round-trips.

time.go adapts time.Time for flag parsing with configurable formats. It has 1 fix and 5 commits, the lowest churn of the top hotspots. Tests are in example_test.go and time_test.go. Before editing this file, run the time tests to check format parsing.

## Change coupling

uint16.go and uint32.go change together in 8 commits with 100% coupling. These two files likely derive from a shared generator or template. When editing one, open the other and check that the type-specific logic stays in sync.

bool.go pairs with every scalar type file (float32, float64, int, int32, int64, int8, uint, uint8) in 7 commits each with 100% coupling. float32.go and float64.go also pair at 100%. This pattern suggests a code generator that produces all scalar type files from bool.go as a template. Before editing any scalar type file, check whether the change belongs in bool.go and should regenerate the others, or whether the type needs a custom deviation.

## What to read first

1. flag.go — read the FlagSet struct, the Value interface, and the Parse method. These define the contract that every flag type implements.
2. flag_test.go — see how the parser handles edge cases: negatives, shorthand stacking, interspersed args, the -- terminator.
3. golangflag.go — see how pflag wraps Go's standard flag.Value and what the CopyToGoFlagSet type switch expects.
4. string_slice.go and string_to_string.go — see the CSV parsing pattern used across the collection types. Check for duplication with ip_slice.go.
5. bool.go — read this before any scalar type file to understand the template that generates the others.
6. example_test.go — see how every flag type is used end-to-end. This file covers all hotspots.