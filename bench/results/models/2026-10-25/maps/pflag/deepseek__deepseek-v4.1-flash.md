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

Risk concentrates in flag.go, the core flag parser, and in the type files that convert command-line strings to typed values. The pflag package is a public API and a drop-in replacement for Go's flag package, so parse order, shorthand rules and error text are contract. Bug fixes land mostly in flag.go (34 fixes), string_slice.go (8) and text.go (5). Every hotspot has fan_in 0 because the package files share one Go package; external callers are the dependents. Ownership is diffuse: flag.go has 60 authors and a top share of 0.16. The map excludes 1 generated or lock file.

## Why these files are hot

flag.go holds FlagSet, Flag, Value and the parse loop. It has 148 commits and 34 fixes, 23% of its commits. No file in the repo imports it; external users import the pflag API, so a change to exported behavior breaks callers. Tests are flag_test.go and example_test.go. Before editing this file, run the tests in flag_test.go and example_test.go to check the parse order and shorthand rules.

golangflag.go bridges Go's flag package to pflag. It has 14 commits and 5 fixes, 36% of its commits. No repo file imports it; the exported bridge functions are the contract for callers that mix flag sets. Tests are golangflag_test.go and example_test.go. Before editing this file, run the tests in golangflag_test.go and example_test.go to check the bridge between flag.Flag and pflag.Flag.

string_slice.go implements the stringSlice Value with CSV input and append-or-replace behavior. It has 18 commits and 8 fixes, 44% of its commits. No repo file imports it; callers use StringSliceVar and StringSlice. Tests are string_slice_test.go and example_test.go. Before editing this file, run the tests in string_slice_test.go and example_test.go to check CSV quoting and the first-Set replace rule.

string_to_string.go implements the stringToString map Value. It has 7 commits and 1 fix. No repo file imports it; callers use StringToStringVar and StringToString. The Set method clears defaults on the first call and merges later key=value pairs; that merge rule is the main contract. Tests are string_to_string_test.go and example_test.go. Before editing this file, run the tests in string_to_string_test.go and example_test.go to check key=value and CSV record rules.

ip_slice.go implements the ipSlice Value for []net.IP. It has 7 commits and 4 fixes, 57% of its commits. No repo file imports it; callers use IPSliceVar and IPSlice. Set removes quotes, reads CSV, and parses each IP; String writes CSV. Tests are ip_slice_test.go and example_test.go. Before editing this file, run the tests in ip_slice_test.go and example_test.go to check quote removal and invalid-IP errors.

## Change coupling

Primitive type files move as one cluster. bool.go, float32.go, float64.go, int.go, int32.go, int64.go, int8.go, uint.go and uint8.go share 7 commits at 100% coupling. uint16.go and uint32.go share 8 commits at 100% coupling. This is by design: each file implements the same Value pattern, so a change to one type often applies to the others. flag.go is a convention file and is excluded from this list. No directory seams were found. When you change one scalar type file, open the other scalar type files and check their Set, Type and String methods for the same change.

## What to read first

1. flag.go — core FlagSet, Flag and Value; read before any parse or API change.
2. flag_test.go — behavior contract for parse order, shorthand and errors.
3. golangflag.go — bridge to Go's flag package; read before flag interop changes.
4. string_slice.go — CSV slice pattern; read before other slice type files.
5. string_to_string.go — map merge and CSV record rules.
6. ip_slice.go — quote removal and net.IP parse rules.