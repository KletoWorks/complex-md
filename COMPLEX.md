---
complex_md: "0.3"
generated: 2026-10-25
commit: da42d08
tool: complex-md/0.11.0
window_commits: 382
files_analyzed: 88
profile:
  files_total: 1046
  files_in_scope: 88
  loc_in_scope: 14634
  kinds: "data 459, other 159, docs 156, test 118, source 80, asset 35, generated 23, ci 5, markup 4, config 3, manifest 3, style 1"
  languages: "js 43, mjs 31, py 4, html 4, sh 2, yaml 2"
  dependency_edges: 434
  commits_total: 416
  commits_analyzed: 367
  commits_skipped: 15
  half_life_commits: 96
  window_from: 2026-09-04
  window_to: 2026-10-25
  velocity_30d: 222.5
  authors_total: 1
  concentration_50: 7
  hotspot_cut: 9
  pair_min: 3
  confidence: "structure+history, single author"
hotspots:
  - path: cli/src/signals.js
    kind: source
    loc: 486
    churn: 14
    churn_w: 4.48
    fixes: 7
    authors: 1
    owner_share: 1.00
    fan_in: 13
    tests: 14
    score: 5185
  - path: cli/src/targets.js
    kind: source
    loc: 708
    churn: 31
    churn_w: 9.59
    fixes: 12
    authors: 1
    owner_share: 1.00
    fan_in: 6
    tests: 7
    score: 4855
  - path: cli/src/complexmd.js
    kind: source
    loc: 292
    churn: 10
    churn_w: 2.64
    fixes: 8
    authors: 1
    owner_share: 1.00
    fan_in: 11
    tests: 10
    score: 3589
  - path: cli/src/graph.js
    kind: source
    loc: 932
    churn: 17
    churn_w: 6.62
    fixes: 15
    authors: 1
    owner_share: 1.00
    fan_in: 4
    tests: 3
    score: 3500
  - path: cli/src/generate.js
    kind: source
    loc: 337
    churn: 13
    churn_w: 4.53
    fixes: 7
    authors: 1
    owner_share: 1.00
    fan_in: 5
    tests: 10
    score: 2780
  - path: bench/run.mjs
    kind: source
    loc: 448
    churn: 26
    churn_w: 4.95
    fixes: 13
    authors: 1
    owner_share: 1.00
    fan_in: 4
    tests: 3
    score: 2474
  - path: cli/src/wire.js
    kind: source
    loc: 395
    churn: 18
    churn_w: 6.60
    fixes: 8
    authors: 1
    owner_share: 1.00
    fan_in: 3
    tests: 18
    score: 2255
  - path: cli/src/git.js
    kind: source
    loc: 93
    churn: 5
    churn_w: 1.46
    fixes: 3
    authors: 1
    owner_share: 1.00
    fan_in: 11
    tests: 1
    score: 2030
  - path: cli/src/render.js
    kind: source
    loc: 451
    churn: 5
    churn_w: 1.52
    fixes: 4
    authors: 1
    owner_share: 1.00
    fan_in: 4
    tests: 3
    score: 1558
load_bearing:
co_change:
  - files: [cli/src/targets.js, cli/src/wire.js]
    count: 10
    coupling: 56
  - files: [cli/README.md, content/spec.md]
    count: 8
    coupling: 53
  - files: [cli/README.md, cli/bin/complex-md.js]
    count: 8
    coupling: 40
  - files: [scripts/build.mjs, site/site.css]
    count: 7
    coupling: 64
  - files: [plugins/complex-md/skills/complex-md/SKILL.md, skills/complex-md/SKILL.md]
    count: 6
    coupling: 100
  - files: [bench/agent-events.mjs, bench/run.mjs]
    count: 6
    coupling: 86
  - files: [content/spec.md, skill/SKILL.tmpl.md]
    count: 6
    coupling: 50
  - files: [content/index.html, content/spec.md]
    count: 6
    coupling: 40
  - files: [content/index.html, site/site.css]
    count: 5
    coupling: 45
  - files: [cli/bin/complex-md.js, cli/src/generate.js]
    count: 5
    coupling: 38
seams:
  - dirs: [cli/bin, cli/src]
    count: 28
    coupling: 82
  - dirs: [content, site]
    count: 10
    coupling: 71
  - dirs: [scripts, site]
    count: 10
    coupling: 71
  - dirs: [cli, cli/bin]
    count: 8
    coupling: 40
  - dirs: [cli, content]
    count: 8
    coupling: 40
  - dirs: [cli, cli/src]
    count: 7
    coupling: 35
blind_spots:
  - "23 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "34 commits by bots (author or committer) left out of churn, fixes, authors and co-change"
  - "one committer identity: authors and owner_share carry no information on this repository"
---

## Where the risk lives

Change risk concentrates in the CLI core under cli/src: the signals computation, the harness target table, the map parser, the dependency graph and the generator. cli/src/signals.js has the top score, 5185, because 13 files depend on it and 14 test files reach it. cli/src/targets.js changed in 31 of the 382 window commits, the most of any listed hotspot, because each new agent harness adds an entry there. Bug fixes land most in cli/src/graph.js with 15, bench/run.mjs with 13 and cli/src/targets.js with 12. There are no load-bearing files, because every file with many dependents changed in the window. The map leaves out 23 generated or lock files and 34 bot commits.

## Why these files are hot

cli/src/signals.js computes every front matter number: the commit window, churn, fixes, co-change pairs, seams, load-bearing files and the profile. It also exports DEFAULTS, FIX_RE, TABLE_HEAD and rowToArray, and cli/src/generate.js prints the signals table with the last 2. 13 files depend on it, among them 7 bench scripts and cli/bin/complex-md.js. A renamed export therefore breaks the benchmark and the CLI together. 7 of its 14 commits were fixes, and 14 test files reach it. Before editing this file, run `cd cli && npm test`.

cli/src/targets.js holds 1 entry per agent harness: how wire detects the harness and where it writes rules, hooks and MCP entries. Its ENTRY_KINDS table finds complex-md entries in user settings files and strips them without loss of other entries. OUR_HOOK and isOurs recognize the hook commands that earlier versions wrote. 12 of its 31 commits were fixes. cli/src/wire.js, cli/src/check.js, cli/src/unwire.js and the bin depend on it. Before editing this file, run `cd cli && node --test test/channels.test.js test/cli.test.js test/generated-notice.test.js test/invocation.test.js test/plan.test.js test/truth.test.js test/upgrade-0.10.test.js`.

cli/src/complexmd.js reads a COMPLEX.md back into front matter and prose, with no YAML library. It indexes the prose so that a hook gets the paragraph and the directive for 1 file. 11 files depend on it, among them cli/src/hook.js, cli/src/check.js and cli/src/render.js. A parse that returns null silences every hook at once. 8 of its 10 commits were fixes: CRLF line ends, an all-digit commit sha, an inline list and paragraphs given to the wrong file. Before editing this file, open frontMatter in cli/src/generate.js, because parseFrontMatter reads exactly the shape that it writes.

cli/src/graph.js computes the structural axis from the working tree: the kind of each file and the files that depend on it. classify tests each path against an ordered list of patterns, and the order decides the kind. buildGraph resolves imports for JavaScript, Python, Rust and other languages. 15 of its 17 commits were fixes, the highest count in the repository. Its comments record a test helper and an empty `__init__.py` that it once named as tests. cli/src/signals.js imports it, so a wrong kind changes every ranked row. Only 3 test files cover it directly: cli/test/basic.test.js, cli/test/classify.test.js and cli/test/resolve.test.js. Before editing this file, run `cd cli && npm test`, because every signals test reads its output.

cli/src/generate.js writes the front matter, builds the model bundle and checks each model reply. normalizeOutput throws on a reply without all 4 REQUIRED_SECTIONS headings, so a refusal never replaces a good map. Its model calls are the only network requests that the CLI permits. 7 of its 13 commits were fixes, and a comment records an old 4000-token cap that cut large maps. bench/run.mjs, cli/src/via.js and the bin depend on it. 10 test files cover it, among them cli/test/generate.test.js. Before editing this file, open parseFrontMatter in cli/src/complexmd.js, because it reads back the exact lines that frontMatter writes.

## Change coupling

The command surface moves with the harness table. cli/src/targets.js and cli/src/wire.js shared 10 commits at 56 percent. The cli/bin and cli/src seam is at 82 percent over 28 commits. This coupling is by design: wire writes what each table entry describes. When targets.js changes, open cli/src/wire.js and cli/bin/complex-md.js and check each target name.

The public texts move together by design, because each text describes the same CLI behavior. cli/README.md and content/spec.md shared 8 commits at 53 percent. content/spec.md moved with skill/SKILL.tmpl.md at 50 percent and with content/index.html at 40 percent. When CLI behavior changes, run `cd cli && node --test test/truth.test.js` to find each stale public text.

bench/agent-events.mjs moved with bench/run.mjs in 6 of its 7 commits, at 86 percent. When agent-events.mjs changes, open run.mjs and check each import from it.

The site moves as 1 unit by design. scripts/build.mjs and site/site.css moved together at 64 percent, and the content and site seam is at 71 percent. After a change to content/, site/ or scripts/build.mjs, run `npm run build` at the root.

plugins/complex-md/skills/complex-md/SKILL.md and skills/complex-md/SKILL.md moved together in 6 of 6 commits. The 2 files hold copies of 1 skill text. After a change to either copy, diff the 2 files.

## What to read first

1. content/spec.md: what every field and section means; the code implements this text.
2. cli/src/signals.js: how the tool computes every front matter number, and the DEFAULTS that cut the lists.
3. cli/src/graph.js: how each file gets its kind and its dependents, the source of 15 fixes.
4. cli/src/complexmd.js: the parser that reads a map back, and its shape contract with frontMatter in cli/src/generate.js.
5. cli/src/git.js: the git wrapper that 11 files import.
6. cli/src/targets.js: the table of agent harnesses that wire writes into.
7. cli/bin/complex-md.js: the command surface, flags and exit codes.
