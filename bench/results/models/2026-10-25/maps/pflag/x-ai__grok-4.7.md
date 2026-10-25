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

Change risk concentrates in FlagSet, the POSIX argument parser, and the typed Value files.
Those files all have fan_in 0, because they share package pflag and do not import one another.
Bug fixes land most often in flag.go (34), then string_slice.go (8), then golangflag.go, text.go, and count.go (5 each).
flag.go has 60 authors and owner_share 0.16, so no single owner holds the parse contract.
No load-bearing file exists in this window.
The map omits 1 generated or lock file.

## Why these files are hot

flag.go implements FlagSet, Flag, and the package Parse helpers. It accepts long options, combined boolean shorthands, NoOptDefVal, and the terminator --. 148 commits touched it. 34 of those commits were fixes. No file imports it. Other files in the package call Var, VarP, AddFlag, or getFlagType. flag_test.go and example_test.go cover it. Before editing this file, run flag_test.go.

golangflag.go adapts a Go flag.Value to the pflag Value interface. PFlagFromGoFlag sets Shorthand for a one-letter name and sets NoOptDefVal to true for a bool flag. DefValue comes from Value.String, not from the Go DefValue field. CopyToGoFlagSet switches on a fixed set of concrete types and uses goflag.Var for every other type. ParseSkippedFlags sends only arguments with the prefix -test. to goflag.Parse. 14 commits touched it. 5 of those commits were fixes. golangflag_test.go and example_test.go cover it. Before editing this file, run golangflag_test.go.

string_slice.go defines stringSliceValue plus readAsCSV and writeAsCSV. Set reads one CSV record, replaces the slice on the first call, and appends on each later call. String wraps the CSV text in brackets. stringSliceConv strips those brackets, then calls readAsCSV. A comma separates values, unlike a string array flag. 18 commits touched it. 8 of those commits were fixes. ip_slice.go calls readAsCSV and writeAsCSV. string_slice_test.go and example_test.go cover it. Before editing this file, run string_slice_test.go.

string_to_string.go defines stringToStringValue for a map[string]string flag. One equals sign means one pair. More equals signs mean one CSV record, and a second record is an error. The first Set clears default keys. A later Set merges keys. String sorts keys and panics when the CSV write fails. GetStringToString returns the live map, so the caller and the flag share memory. 7 commits touched it. 1 of those commits was a fix. string_to_string_test.go and example_test.go cover it. Before editing this file, run string_to_string_test.go.

ip_slice.go defines ipSliceValue for a []net.IP flag. Set removes quotes, calls readAsCSV, and accepts only values that net.ParseIP accepts. The first Set replaces the slice. A later Set appends. ipSliceConv splits on commas and does not use the CSV reader. 7 commits touched it. 4 of those commits were fixes. ip_slice_test.go and example_test.go cover it. Before editing this file, run ip_slice_test.go.

## Change coupling

Scalar flag files change together by design. uint16.go and uint32.go share 8 commits at coupling 100%. bool.go shares 7 commits at coupling 100% with float32.go, float64.go, int.go, int32.go, int64.go, int8.go, uint.go, and uint8.go. float32.go and float64.go share 7 commits at coupling 100%. Each file is a parallel Value type with the same method shape. flag.go and flag_test.go appear in more than 25% of commits, so pair analysis excludes them. No directory seam exists. Keep Set, String, and Type the same across each 100% pair.

## What to read first

1. flag.go — FlagSet, Parse, Value, SliceValue, and the shorthand rules.
2. flag_test.go — tests for the parse contract that flag.go owns.
3. golangflag.go — the Go flag bridge and the concrete type switch in CopyToGoFlagSet.
4. string_slice.go — CSV helpers that ip_slice.go calls.
5. string_to_string.go — map merge rules and the single-record CSV limit.
6. ip_slice.go — quote removal, net.ParseIP, and a converter that skips CSV.
7. example_test.go — public call examples for the same flag types.