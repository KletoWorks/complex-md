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

The highest risk file is flag.go, a 1421-line command-line flag parser that defines core data structures and parsing logic. This file fixes 34 issues, the most in the repository, and appears in half the analyzed commits (148 churn). Bug fixes land here most often, then in string_slice.go (8 fixes), text.go (5 fixes), golangflag.go (5 fixes), and ip_slice.go (4 fixes). No file has zero dependents yet, but flag.go also has zero fan_in, meaning nothing imports or depends on it structurally. The map does not cover 1 generated or lock file, which may contain additional runtime dependencies.

## Why these files are hot

flag.go implements a flag set and flag definitions with parsing, validation, help, and deprecated/handling behavior. It changes frequently (148 commits, 41.54 weighted churn), and 34 of those commits fix issues, so every edit risks breaking existing flag usage. Two test files cover it: example_test.go and flag_test.go. Before editing this file, run go test -v -run TestFlag parsing examples to verify all existing behaviors match.

golangflag.go adapts Go's standard flag package to pflag, wrapping values and exposing methods like PFlagFromGoFlag and AddGoFlagSet. It changes 14 times with 5 fixes, indicating ongoing alignment with upstream flag package behavior. Two test files cover it. Before editing this file, open golangflag_test.go and run all examples for AddGoFlagSet and CopyToGoFlagSet to confirm integration behavior.

string_slice.go parses comma-separated strings into a []string using the CSV parser, supporting both append and replace semantics. It changes 18 times, and 8 of those are fixes, so behavior edge cases are common. Two test files cover it. Before editing this file, open string_slice_test.go and verify the test for appending multiple values preserves the intended merge semantics.

string_to_string.go parses key=value pairs into a map[string]string with CSV-like quoting rules. Its documentation shows complex parsing rules, and its 1 fix shows edge cases exist. Two test files cover it. Before editing this file, read the string_to_string_test.go examples that include quoted keys and values with commas.

ip_slice.go parses comma-separated IP addresses into []net.IP, with validation on each parsed value. It has 4 fixes out of 7 commits, indicating parsing failures were common. Two test files cover it. Before editing this file, run ip_slice_test.go with invalid IP strings to confirm error messages remain consistent.

## Change coupling

The bool.go file couples 100% with float32.go, float64.go, int.go, int32.go, int64.go, int8.go, uint.go, uint8.go: whenever bool.go changes, all those files also change. This coupling is by design: each file adds a single value type to the flag system, and changes to one type usually require similar changes to others. When you change bool.go, open all boolean-like flag files and check for new validation, help text, or parsing rules.

uint16.go couples 100% with uint32.go: they always appear together in commits. These define unsigned integer flag types. When you edit one, open the other to ensure consistent overflow checks, default values, and help text.

float32.go couples 100% with float64.go: they always appear together in commits. These define floating-point flag types. When you edit one, open the other to ensure consistent parsing, rounding, and help text.

## What to read first

1. flag.go — the main flag set and flag definition types; read before changing any flag parsing logic.
2. golangflag.go — how Go's standard flag package is integrated; read before modifying integration code.
3. string_slice.go — the reference implementation for slice-like flag parsing; read before adding new slice types.
4. string_to_string.go — the reference implementation for map-like flag parsing; read before adding new map types.
5. ip_slice.go — an example of complex validation in a slice flag; read before modifying IP-related code.