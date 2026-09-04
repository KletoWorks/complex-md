---
complex_md: "0.3"
generated: 2026-09-04
commit: fbfb85f
tool: complex-md/0.4.0
window_commits: 67
files_analyzed: 25
profile:
  files_total: 83
  files_in_scope: 25
  loc_in_scope: 3285
  kinds: "source 21, docs 19, data 19, test 9, asset 4, markup 3, other 2, generated 2, manifest 2, ci 1, style 1"
  languages: "js 14, mjs 7, html 3, css 1"
  dependency_edges: 64
  commits_total: 67
  commits_analyzed: 67
  commits_skipped: 0
  half_life_commits: 50
  window_from: 2026-09-02
  window_to: 2026-09-04
  velocity_30d: 1117.9
  authors_total: 1
  concentration_50: 4
  hotspot_cut: 3
  pair_min: 3
  confidence: "structure+history, single author"
hotspots:
  - path: cli/src/signals.js
    kind: source
    loc: 369
    churn: 4
    churn_w: 2.57
    fixes: 2
    authors: 1
    owner_share: 1.00
    fan_in: 7
    tests: 2
    score: 2635
  - path: cli/src/git.js
    kind: source
    loc: 48
    churn: 3
    churn_w: 2.30
    fixes: 2
    authors: 1
    owner_share: 1.00
    fan_in: 5
    tests: 0
    score: 1378
  - path: cli/src/generate.js
    kind: source
    loc: 208
    churn: 6
    churn_w: 4.15
    fixes: 2
    authors: 1
    owner_share: 1.00
    fan_in: 2
    tests: 3
    score: 1198
load_bearing:
co_change:
  - files: [scripts/build.mjs, site/site.css]
    count: 9
    coupling: 82
  - files: [scripts/build.mjs, site/404.html]
    count: 7
    coupling: 100
  - files: [site/404.html, site/site.css]
    count: 7
    coupling: 100
  - files: [content/spec.md, skill/SKILL.tmpl.md]
    count: 5
    coupling: 63
  - files: [content/spec.md, scripts/build.mjs]
    count: 5
    coupling: 42
  - files: [cli/src/check.js, cli/src/hook.js]
    count: 4
    coupling: 100
  - files: [cli/src/check.js, cli/src/signals.js]
    count: 4
    coupling: 100
  - files: [cli/src/hook.js, cli/src/signals.js]
    count: 4
    coupling: 100
  - files: [prompts/generate.md, skill/SKILL.tmpl.md]
    count: 4
    coupling: 100
  - files: [prompts/integration.md, skill/SKILL.tmpl.md]
    count: 4
    coupling: 100
seams:
  - dirs: [scripts, site]
    count: 9
    coupling: 82
  - dirs: [content, scripts]
    count: 7
    coupling: 54
  - dirs: [cli/bin, cli/src]
    count: 6
    coupling: 100
  - dirs: [prompts, skill]
    count: 5
    coupling: 100
  - dirs: [., content]
    count: 5
    coupling: 63
  - dirs: [content, skill]
    count: 5
    coupling: 63
blind_spots:
  - "2 generated or lock files excluded"
  - "one committer identity: authors and owner_share carry no information on this repository"
---

## Where the risk lives

Change risk concentrates in the analysis core under cli/src: the signals computation, the git plumbing beneath it, and the generate step that turns signals into a file. Bug fixes land in cli/src/hook.js (3 of its 5 commits) and in cli/src/signals.js, cli/src/git.js and cli/src/generate.js (2 fixes each). cli/src/git.js is the widest surface for its size: 5 modules depend on its 48 lines and no test file references it directly. There are no load-bearing files; every rankable file was touched in the 67-commit window. Two generated or lock files are excluded, and CHANGELOG.md rides with most commits and is left out of co-change as a convention file.

## Why these files are hot

cli/src/signals.js computes everything in the front matter: the commit window, churn and weighted churn, fixes, co-change pairs, seams, load-bearing files, the profile and the blind spots, and it exports findImporters, findCoveringTests and detectTestCommand for the MCP server and the diff check. Seven files depend on it, including the three bench scripts and the bin, so a renamed export breaks the benchmark and the CLI at once. Every spec refinement lands here first. cli/test/basic.test.js and cli/test/mcp.test.js cover it. Before editing this file, keep TABLE_HEAD and rowToArray in step with buildBundle in cli/src/generate.js and the complex_refresh tool, then run `cd cli && npm test` and confirm the synthetic-repo numbers in cli/test/basic.test.js still hold.

cli/src/git.js wraps spawnSync for git: repoRoot, hasCommits, shortSha, trackedFiles and changedFiles. Five modules depend on it (the bin, check, hook, mcp, signals), and two of its three commits were fixes for what happens outside a repository. No test imports it; cli/test/cli.test.js and cli/test/hook.test.js reach it only by running the bin as a process. Before editing this file, preserve the allowFail contract (callers that pass allowFail: true expect an empty string and never a throw, outside a repository or with no HEAD) and run cli/test/cli.test.js and cli/test/hook.test.js.

cli/src/generate.js writes the front matter, builds the prompt bundle, makes the model call and validates the reply before anything touches COMPLEX.md. Six commits, two of them fixes, because each provider or output edge case lands here. The bin and bench/run.mjs depend on it, and frontMatter's key order is the contract that parseFrontMatter in cli/src/complexmd.js reads back. cli/test/basic.test.js, cli/test/generate.test.js and cli/test/mcp.test.js cover it. Before editing this file, keep frontMatter and REQUIRED_SECTIONS aligned with cli/src/complexmd.js and prompts/generate.md, and run cli/test/generate.test.js.

## Change coupling

The site shell moves as one: scripts/build.mjs with site/site.css (82 percent) and site/404.html (100 percent), and the two site files with each other (100 percent). By design: the build script emits the page shell those files style and mirror. When you change a class name or the shell markup in scripts/build.mjs, open site/site.css and site/404.html, then run `npm run build`.

The spec, the prompts and the skill move together: content/spec.md with skill/SKILL.tmpl.md (63 percent) and scripts/build.mjs (42 percent); prompts/generate.md and prompts/integration.md with the skill template (100 percent). By design: build.mjs injects the prompts into the skill and the wiring block into the spec. When you change a file in prompts/, run `npm run build` and check that dist/complex-md.skill.md and dist/spec.md carry the change; when a rule in the spec changes, update the skill's Stage 3 to say the same thing.

cli/src/check.js, cli/src/hook.js and cli/src/signals.js share four commits each at 100 percent. Half by design (the hooks print the check's report, and both read signals), half by decay: hook.js formats hotspot rows itself in fmtRow instead of through check.js. When you change the findings shape of runCheck or a line of formatCheck, open cli/src/hook.js and cli/src/mcp.js, run cli/test/check.test.js and cli/test/hook.test.js, and move any row formatting you touch into check.js so the two stop drifting.

## What to read first

1. content/spec.md: what every field and section means; the code implements this text.
2. cli/src/signals.js: how every number in the front matter is computed, and the defaults that cut the lists.
3. cli/src/complexmd.js: the parser that reads a map back; the shape contract between generate.js and every consumer.
4. cli/src/git.js: the five-function seam between the tool and git, where every outside-a-repository failure passes.
5. cli/bin/complex-md.js: the command surface, flags and exit codes.
6. scripts/build.mjs: how the site, the skill and cli/prompts are assembled from prompts/.
