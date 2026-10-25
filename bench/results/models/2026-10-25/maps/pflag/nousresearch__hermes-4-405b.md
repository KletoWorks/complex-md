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
# COMPLEX.md

## Where the risk lives
Change risk concentrates in flag.go, the core of the pflag library. This 1421-line file handles command-line flag parsing and is the most frequently changed file (148 commits, 34 fixes). Other hotspots are type-specific flag implementations like golangflag.go (Go flag compatibility), string_slice.go, string_to_string.go, ip_slice.go, text.go, and time.go. These files handle different data types for flags. The repository has no load-bearing files that are rarely changed but widely depended on. Ownership is distributed across many authors (107 total), with no single dominant contributor for most hotspots.

## Why these files are hot
Flag.go defines the core FlagSet and Flag types and handles flag parsing logic. It is the largest file at 1421 lines and has been changed 148 times (34 fixes). Before editing this file, run the flag_test.go and example_test.go test files to verify parsing behavior.

Golangflag.go provides compatibility with Go's native flag package. It has been changed 14 times (5 fixes) and wraps Go flag values for pflag. Before editing this file, run the golangflag_test.go and example_test.go test files to ensure compatibility.

String_slice.go implements string slice flags that accept comma-separated values. It has been changed 18 times (8 fixes). Before editing this file, run the string_slice_test.go and example_test.go test files to validate CSV parsing.

String_to_string.go handles string-to-string map flags that accept key=value pairs. It has been changed 7 times (1 fix). Before editing this file, run the string_to_string_test.go and example_test.go test files to verify map parsing.

Ip_slice.go implements IP slice flags that accept comma-separated IP addresses. It has been changed 7 times (4 fixes). Before editing this file, run the ip_slice_test.go and example_test.go test files to validate IP parsing.

Text.go provides text flags that implement encoding.TextUnmarshaler. It has been changed 6 times (5 fixes). Before editing this file, run the text_test.go and example_test.go test files to ensure proper text unmarshaling.

Time.go implements time flags that accept various time formats. It has been changed 5 times (1 fix). Before editing this file, run the time_test.go and example_test.go test files to validate time parsing.

## Change coupling
The files uint16.go and uint32.go are always changed together (8 shared commits, 100% coupling). These files likely contain similar code for different integer types. When changing one, open and check the other for parallel updates.

The file bool.go is always changed with float32.go, float64.go, int.go, int32.go, int64.go, int8.go, uint.go, and uint8.go (7 shared commits each, 100% coupling). This suggests these basic type flag files are maintained together. When changing any of these, open and check all related type flag files for consistency.

The files float32.go and float64.go are always changed together (7 shared commits, 100% coupling). These files likely contain similar code for different float types. When changing one, open and check the other for parallel updates.

## What to read first
1. flag.go: The core flag parsing logic and FlagSet/Flag definitions
2. golangflag.go: Go flag compatibility layer
3. string_slice.go: String slice flag implementation
4. string_to_string.go: String-to-string map flag implementation
5. ip_slice.go: IP slice flag implementation
6. text.go: Text flag implementation
7. time.go: Time flag implementation
```