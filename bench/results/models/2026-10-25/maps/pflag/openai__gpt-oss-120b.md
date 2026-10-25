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
load_bearing: []
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
seams: []
blind_spots:
  - "1 generated or lock files excluded"
---

## Where the risk lives
Change risk concentrates in flag parsing and value conversion code. The files define flag types, parsing logic, and integration with the Go flag package. Bug fixes land most often in flag.go with 34 fixes, in string_slice.go with 8 fixes, and in ip_slice.go with 4 fixes. No load‑bearing files are listed; all dependents are external to this package. Many contributors edit these files; the top owner holds only 16 % of changes, indicating a dispersed ownership pattern.

## Why these files are hot
flag.go provides the core flag set implementation, defines error handling, and manages flag registration. It has the highest churn and the most fixes, and two tests cover it. Before editing this file, run `go test ./...` and verify `flag_test.go` passes.  
golangflag.go adapts the standard library flag package to the pflag API, wrapping Go flag values. It is changed less often but still has five fixes and two tests. Before editing this file, run `go test ./...` and verify `golangflag_test.go` passes.  
string_slice.go implements a slice of strings flag type, handling CSV parsing and value appending. It sees frequent churn, eight fixes, and two tests. Before editing this file, run `go test ./...` and verify `string_slice_test.go` passes.  
string_to_string.go implements a map flag type, parsing key‑value pairs and handling CSV records. It has low churn but one fix and two tests. Before editing this file, run `go test ./...` and verify `string_to_string_test.go` passes.  
ip_slice.go implements a slice of IP addresses, converting CSV input to net.IP values. It has moderate churn, four fixes, and two tests. Before editing this file, run `go test ./...` and verify `ip_slice_test.go` passes.

## Change coupling
bool.go changes together with every numeric flag file (int.go, uint.go, float32.go, etc.) with 100 % coupling. The files share similar flag‑type implementations and duplicate logic. When changing bool.go, also open and review int.go, uint.go, and float32.go to keep implementations consistent.  
uint16.go and uint32.go change together with 100 % coupling. They provide similar unsigned integer flag types. When modifying uint16.go, also open uint32.go and ensure both maintain the same behavior.  
float32.go and float64.go change together with 100 % coupling. They implement floating‑point flag types. When editing float32.go, also open float64.go and align any shared changes.

## What to read first
1. flag.go – core flag set logic; understand flag registration and parsing.  
2. golangflag.go – integration with the standard flag package; see how wrappers are built.  
3. string_slice.go – slice flag implementation; review CSV handling and value appending.  
4. string_to_string.go – map flag implementation; study key‑value parsing rules.  
5. ip_slice.go – IP slice flag implementation; examine conversion and validation steps.  