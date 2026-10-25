---
complex_md: "0.3"
generated: 2026-10-25
commit: b9f802f
tool: complex-md/0.10.0
window_commits: 307
files_analyzed: 77
profile:
  files_total: 1017
  files_in_scope: 77
  loc_in_scope: 12018
  kinds: "data 457, other 159, docs 153, test 107, source 70, asset 35, generated 22, ci 5, markup 4, config 2, manifest 2, style 1"
  languages: "js 37, mjs 28, html 4, py 3, sh 2, yaml 2"
  dependency_edges: 371
  commits_total: 318
  commits_analyzed: 292
  commits_skipped: 15
  half_life_commits: 77
  window_from: 2026-09-04
  window_to: 2026-10-25
  velocity_30d: 180.3
  authors_total: 1
  concentration_50: 7
  hotspot_cut: 7
  pair_min: 3
  confidence: "structure+history, single author"
hotspots:
  - path: cli/src/targets.js
    kind: source
    loc: 666
    churn: 28
    churn_w: 10.52
    fixes: 9
    authors: 1
    owner_share: 1.00
    fan_in: 5
    tests: 6
    score: 4301
  - path: cli/src/signals.js
    kind: source
    loc: 435
    churn: 11
    churn_w: 1.90
    fixes: 5
    authors: 1
    owner_share: 1.00
    fan_in: 14
    tests: 12
    score: 3560
  - path: bench/run.mjs
    kind: source
    loc: 448
    churn: 26
    churn_w: 6.66
    fixes: 13
    authors: 1
    owner_share: 1.00
    fan_in: 4
    tests: 3
    score: 2831
  - path: cli/src/complexmd.js
    kind: source
    loc: 249
    churn: 8
    churn_w: 1.34
    fixes: 6
    authors: 1
    owner_share: 1.00
    fan_in: 10
    tests: 7
    score: 2438
  - path: cli/src/generate.js
    kind: source
    loc: 319
    churn: 11
    churn_w: 3.69
    fixes: 5
    authors: 1
    owner_share: 1.00
    fan_in: 5
    tests: 9
    score: 2419
  - path: cli/src/wire.js
    kind: source
    loc: 291
    churn: 17
    churn_w: 9.00
    fixes: 7
    authors: 1
    owner_share: 1.00
    fan_in: 3
    tests: 17
    score: 2419
  - path: cli/src/graph.js
    kind: source
    loc: 576
    churn: 11
    churn_w: 3.01
    fixes: 9
    authors: 1
    owner_share: 1.00
    fan_in: 4
    tests: 3
    score: 2244
load_bearing:
co_change:
  - files: [cli/bin/complex-md.js, cli/src/targets.js]
    count: 10
    coupling: 36
  - files: [cli/src/targets.js, cli/src/wire.js]
    count: 9
    coupling: 53
  - files: [cli/README.md, content/spec.md]
    count: 8
    coupling: 62
  - files: [cli/README.md, cli/bin/complex-md.js]
    count: 7
    coupling: 44
  - files: [bench/agent-events.mjs, bench/run.mjs]
    count: 6
    coupling: 86
  - files: [scripts/build.mjs, site/site.css]
    count: 6
    coupling: 60
  - files: [content/spec.md, skill/SKILL.tmpl.md]
    count: 6
    coupling: 50
  - files: [content/index.html, content/spec.md]
    count: 6
    coupling: 46
  - files: [cli/README.md, content/index.html]
    count: 6
    coupling: 38
  - files: [plugins/complex-md/skills/complex-md/SKILL.md, skills/complex-md/SKILL.md]
    count: 5
    coupling: 100
seams:
  - dirs: [cli/bin, cli/src]
    count: 27
    coupling: 82
  - dirs: [scripts, site]
    count: 9
    coupling: 82
  - dirs: [cli, content]
    count: 8
    coupling: 50
  - dirs: [content, site]
    count: 7
    coupling: 64
  - dirs: [cli, cli/bin]
    count: 7
    coupling: 44
  - dirs: [content, skill]
    count: 6
    coupling: 50
blind_spots:
  - "22 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "11 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
  - "one committer identity: authors and owner_share carry no information on this repository"
---

## Where the risk lives

Change risk concentrates in the CLI core under cli/src: the harness target table, the signals computation, the map parser and the generator. cli/src/targets.js has the top score, with 28 commits in the 307-commit window, because each new agent harness adds an entry there. The benchmark driver bench/run.mjs changed in 26 commits and imports the signals, generator and wire modules directly. Bug fixes land most in bench/run.mjs with 13, cli/bin/complex-md.js with 10, and cli/src/targets.js and cli/src/graph.js with 9 each. There are no load-bearing files, because every file with many dependents changed in the window. The map leaves out 22 generated or lock files and 11 bot commits.

## Why these files are hot

cli/src/targets.js holds 1 entry per agent harness: how wire detects the harness and where it writes rules, hooks and MCP entries. Its ENTRY_KINDS table finds complex-md entries in user settings files and strips them without loss of other entries. OUR_HOOK and isOurs recognize the hook commands that earlier versions wrote. 9 of its 28 commits were fixes. cli/src/wire.js writes from BRIEF_SPECS, and cli/src/check.js also depends on this file. 6 test files cover it, among them cli/test/invocation.test.js, cli/test/channels.test.js and cli/test/truth.test.js. Before editing this file, run `cd cli && node --test test/channels.test.js test/cli.test.js test/generated-notice.test.js test/invocation.test.js test/plan.test.js test/truth.test.js`.

cli/src/signals.js computes every front matter number: the commit window, churn, fixes, co-change pairs, seams, load-bearing files and the profile. It also exports DEFAULTS, FIX_RE, TABLE_HEAD and rowToArray, and cli/src/generate.js prints the signals table with the last 2. 14 files depend on it, among them 7 bench scripts and the bin. A renamed export therefore breaks the benchmark and the CLI together. 5 of its 11 commits were fixes. Before editing this file, run `cd cli && npm test`, because 12 test files reach it.

bench/run.mjs runs the benchmark: the same issue at the same base commit, with and without COMPLEX.md. It imports computeSignals, buildBundle, normalizeOutput and wire, so a change to those exports breaks it. 13 of its 26 commits were fixes, the highest count in the repository. Its comments record 2 isolation defects: a node_modules link led an agent to future history, and an unknown agent name started a real model run. The script itself drives a real agent and spends account usage. Before editing this file, run `cd cli && node --test test/bench-harness.test.js test/bench-partners.test.js`.

cli/src/complexmd.js reads a COMPLEX.md back into front matter and prose, with no YAML library. It indexes the prose so that a hook gets the paragraph and the directive for 1 file. 10 files depend on it, among them cli/src/hook.js, cli/src/mcp.js and cli/src/check.js. A parse that returns null silences every hook at once. 6 of its 8 commits were fixes: CRLF line ends, an all-digit commit sha, an inline list and paragraphs given to the wrong file. Before editing this file, open frontMatter in cli/src/generate.js, because parseFrontMatter reads exactly the shape it writes.

cli/src/generate.js writes the front matter, builds the model bundle and checks each model reply. normalizeOutput throws on a reply without all 4 REQUIRED_SECTIONS headings, so a refusal never replaces a good map. Its model calls are the only network requests that the CLI permits. 5 of its 11 commits were fixes, and a comment records an old 4000-token cap that cut large maps. 9 test files cover it, among them cli/test/generate.test.js and cli/test/template.test.js. Before editing this file, open parseFrontMatter in cli/src/complexmd.js, because it reads back the exact lines that frontMatter writes.

## Change coupling

The CLI command surface moves with the harness table. cli/src/targets.js and cli/src/wire.js shared 9 commits at 53 percent, and the cli/bin and cli/src seam is at 82 percent over 27 commits. targets.js exports TARGET_NAMES and OFFERED_TARGETS, so a target list that the bin repeats by hand is decay. Build every target list in cli/bin/complex-md.js from OFFERED_TARGETS.

The public texts move together by design, because each text describes the same CLI behavior. cli/README.md and content/spec.md shared 8 commits at 62 percent, and content/spec.md moved with skill/SKILL.tmpl.md at 50 percent. When CLI behavior changes, run `cd cli && node --test test/truth.test.js` to find each stale public text.

bench/agent-events.mjs moved with bench/run.mjs in 6 of its 7 commits, at 86 percent. This coupling is by design: run.mjs reads every agent event through createMeter, newMetrics and behaviour. When agent-events.mjs changes, open run.mjs and check each call to those 3 exports.

The site moves as 1 unit by design. scripts/build.mjs and site/site.css moved together at 60 percent, and the scripts and site seam is at 82 percent. After a change to content/, site/ or scripts/build.mjs, run `npm run build` at the root.

plugins/complex-md/skills/complex-md/SKILL.md and skills/complex-md/SKILL.md moved together in 5 of 5 commits. The 2 files are copies of 1 skill text. After a change to either copy, diff the 2 files.

## What to read first

1. content/spec.md: what every field and section means; the code implements this text.
2. cli/src/signals.js: how the tool computes every front matter number, and the DEFAULTS that cut the lists.
3. cli/src/complexmd.js: the parser that reads a map back, and its shape contract with frontMatter in cli/src/generate.js.
4. cli/src/git.js: the git wrapper that signals.js and targets.js import, with 12 dependents.
5. cli/src/targets.js: the table of agent harnesses that wire writes into.
6. cli/bin/complex-md.js: the command surface, flags and exit codes.
