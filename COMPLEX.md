---
complex_md: "0.3"
generated: 2026-10-24
commit: 6be919f
tool: complex-md/0.10.0
window_commits: 135
files_analyzed: 43
profile:
  files_total: 798
  files_in_scope: 43
  loc_in_scope: 6804
  kinds: "data 451, other 159, docs 74, source 39, asset 36, test 29, ci 2, generated 2, manifest 2, markup 2, config 1, style 1"
  languages: "js 22, mjs 13, py 3, html 2, sh 1, yaml 1"
  dependency_edges: 159
  commits_total: 135
  commits_analyzed: 122
  commits_skipped: 13
  half_life_commits: 50
  window_from: 2026-09-04
  window_to: 2026-10-24
  velocity_30d: 79.8
  authors_total: 1
  concentration_50: 4
  hotspot_cut: 3
  pair_min: 3
  confidence: "structure+history, single author"
hotspots:
  - path: cli/src/signals.js
    kind: source
    loc: 414
    churn: 8
    churn_w: 2.90
    fixes: 4
    authors: 1
    owner_share: 1.00
    fan_in: 8
    tests: 8
    score: 3130
  - path: cli/src/complexmd.js
    kind: source
    loc: 238
    churn: 7
    churn_w: 3.40
    fixes: 5
    authors: 1
    owner_share: 1.00
    fan_in: 7
    tests: 4
    score: 2853
  - path: cli/src/targets.js
    kind: source
    loc: 471
    churn: 17
    churn_w: 9.49
    fixes: 4
    authors: 1
    owner_share: 1.00
    fan_in: 2
    tests: 2
    score: 1960
load_bearing:
co_change:
  - files: [cli/bin/complex-md.js, cli/src/targets.js]
    count: 7
    coupling: 44
  - files: [content/index.html, scripts/build.mjs]
    count: 5
    coupling: 50
  - files: [README.md, bench/RESULTS.md]
    count: 4
    coupling: 80
  - files: [cli/README.md, content/index.html]
    count: 4
    coupling: 50
  - files: [cli/README.md, content/spec.md]
    count: 4
    coupling: 50
  - files: [content/index.html, content/spec.md]
    count: 4
    coupling: 50
  - files: [site/site.css, site/site.js]
    count: 3
    coupling: 100
  - files: [content/index.html, site/site.css]
    count: 3
    coupling: 50
  - files: [content/spec.md, skill/SKILL.tmpl.md]
    count: 3
    coupling: 50
  - files: [scripts/build.mjs, site/site.css]
    count: 3
    coupling: 50
seams:
  - dirs: [cli/bin, cli/src]
    count: 12
    coupling: 75
  - dirs: [scripts, site]
    count: 5
    coupling: 71
  - dirs: [content, scripts]
    count: 5
    coupling: 56
  - dirs: [content, site]
    count: 4
    coupling: 57
  - dirs: [cli, content]
    count: 4
    coupling: 50
  - dirs: [content, skill]
    count: 3
    coupling: 50
blind_spots:
  - "2 generated or lock files excluded"
  - "1 files over 1 MB not read for dependencies"
  - "1 source file contains a NUL byte, so ripgrep, which Claude Code's Grep tool runs, skips it with no match and no warning, and GNU grep prints a binary file notice and no line: cli/src/resolve.js. Search with git grep -I --text, and fix the byte: it is almost always a separator that should have been written as an escape."
  - "one committer identity: authors and owner_share carry no information on this repository"
---

## Where the risk lives

Change risk concentrates in the CLI core under cli/src: the signals computation, the parser that reads a map back, and the target table that writes a map into each agent harness. cli/src/targets.js changed most, in 17 commits, because each new agent harness added an entry there. Bug fixes land most in cli/src/complexmd.js and bench/run.mjs, with 5 each, then in cli/src/signals.js, cli/src/targets.js and cli/src/wire.js, with 4 each. There are no load-bearing files: every file that many files depend on changed in the 135-commit window. A NUL byte in cli/src/resolve.js hides that file from ripgrep, so search it with `git grep -I --text`.

## Why these files are hot

cli/src/signals.js computes every number in the front matter: the commit window, churn, fixes, co-change pairs, seams, load-bearing files and the profile. It also exports TABLE_HEAD and rowToArray, which cli/src/generate.js and cli/src/mcp.js use to print the signals table. 8 files depend on it, among them 4 bench scripts and the bin, so a renamed export breaks the benchmark and the CLI at once. 4 of its 8 commits were fixes, and 8 test files reach it. Before editing this file, run `cd cli && npm test`, which runs all 8 covering test files.

cli/src/complexmd.js reads a COMPLEX.md back into its front matter and its prose, with no YAML library. It indexes the prose so that a tool can give an agent the paragraph and the directive for 1 file. 7 files depend on it, and a parse that returns null silences every hook and brief at once. 5 of its 7 commits were fixes: CRLF line ends, an inline list, route paths with brackets, and paragraphs given to the wrong file. 4 test files cover it, among them cli/test/complexmd.test.js and cli/test/basic.test.js. Before editing this file, open frontMatter in cli/src/generate.js, because parseFrontMatter reads exactly the shape it writes.

cli/src/targets.js holds 1 entry per agent harness: how wire detects the harness and where it writes rules, hooks and MCP entries. cli/src/wire.js writes from its BRIEF_SPECS table and cli/src/check.js reads the table back, so a changed header changes both. isOurs and LEGACY_HOOK recognize the hook commands that earlier versions wrote, so that wire adds no duplicate. 4 of its 17 commits were fixes, 2 of them for hook commands. cli/test/invocation.test.js and cli/test/truth.test.js cover it, and cli/test/channels.test.js exercises the `--for` targets. Before editing this file, run `cd cli && node --test test/invocation.test.js test/truth.test.js test/channels.test.js`.

## Change coupling

cli/bin/complex-md.js and cli/src/targets.js shared 7 commits, at 44 percent, and the cli/bin and cli/src seam is at 75 percent. Part of this coupling is decay: the bin help text lists the `--for` target names by hand, and targets.js exports the same names as TARGET_NAMES. The 2 lists differ today, because the help text omits the roo entry. Build the `--for` list in the help text from TARGET_NAMES.

The site shell moves as 1 unit. site/site.css and site/site.js moved together at 100 percent, and content/index.html and scripts/build.mjs each moved with site/site.css at 50 percent. This coupling is by design: scripts/build.mjs writes the page shell that links site.css and site.js. When you change the shell markup or a class name, open site/site.css and site/site.js, then run `npm run build`.

The public texts move in pairs: cli/README.md, content/index.html and content/spec.md at 50 percent each, and content/spec.md with skill/SKILL.tmpl.md at 50 percent. By design, each text describes the same CLI behavior. cli/test/truth.test.js checks the public texts against the code. When CLI behavior changes, run `cd cli && node --test test/truth.test.js` to find each stale public text.

README.md and bench/RESULTS.md moved together at 80 percent, by design: the README section "Measured, not asserted" quotes the benchmark that RESULTS.md records. When bench/RESULTS.md changes, update the figures in that README section.

## What to read first

1. content/spec.md: what every field and section means; the code implements this text.
2. cli/src/signals.js: how the tool computes every front matter number, and the DEFAULTS that cut the lists.
3. cli/src/complexmd.js: the parser that reads a map back, and its shape contract with cli/src/generate.js.
4. cli/src/git.js: the seam between the tool and git, where every failure outside a repository passes.
5. cli/src/targets.js: the table of agent harnesses that wire writes into and check reads back.
6. cli/bin/complex-md.js: the command surface, flags and exit codes.
