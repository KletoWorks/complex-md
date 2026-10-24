# complex-md

[![npm](https://img.shields.io/npm/v/complex-md)](https://www.npmjs.com/package/complex-md) [![CI](https://github.com/KletoWorks/complex-md/actions/workflows/ci.yml/badge.svg)](https://github.com/KletoWorks/complex-md/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)

complex.md defines and generates COMPLEX.md, a markdown file at the root of a
repository that tells a coding agent where the structural risk in the codebase
lives. Computed from the dependency graph and the commit history, not written
from memory. Spec at
https://complex.md/spec.

```sh
npx complex-md
```

One run computes the signals, writes COMPLEX.md, and wires it in: the
integration block in the agent files and a rule per hot path carrying that
file's own brief. `--hooks` adds the PreToolUse and Stop hooks. The briefs
go where each agent or review bot the repository uses reads them: Claude
Code, Cursor, Copilot code review and cloud agent, OpenHands, Antigravity,
Devin Desktop, Windsurf, Kiro and Cline. A `REVIEW.md` that exists gets an
`@COMPLEX.md` line for Claude Code Review. Before the first write, the run
prints every file it will create or change, and in a terminal it asks once.

With a provider key, one model call writes the prose. Without a key, the run
writes template prose built from the computed numbers, so it still ends with
a wired map. `npx complex-md --via claude` writes the prose with an agent
CLI you already run, under your own login. The package lives in `cli/`.
Without `npx`, the skill does the same by hand: download
https://complex.md/complex-md.skill.md and run it with any coding agent
inside the repo.

If npm answers `No versions available for complex-md`, the repository's
`.npmrc` (or your user config) sets `min-release-age`, npm's guard against
packages published within the last few days. Run
`npm_config_min_release_age=0 npx -y complex-md` once, or wait for the
release to age past the threshold.

## Install the skill as a package

Claude Code:

```sh
claude plugin marketplace add KletoWorks/complex-md
claude plugin install complex-md@complex-md
```

In a session: `/plugin install complex-md --marketplace KletoWorks/complex-md`.

Codex:

```sh
codex plugin marketplace add KletoWorks/complex-md
codex plugin add complex-md@complex-md
```

Gemini CLI:

```sh
gemini extensions install https://github.com/KletoWorks/complex-md
```

Each package carries one skill. The package adds no hooks and no MCP
server. When it runs, the skill can wire hooks into your repository. At
session start each tool loads 74 to 141 tokens: the skill's name and
description, plus a 4 sentence context file for Gemini CLI. The rest of the
skill loads only when it runs.


## Why not just let the agent search?

Because a search that finds nothing and a thing that does not exist look the
same from the outside.

A worked example, and the reason for 0.5.0. An agent was asked whether an HTTP
route existed in a package. It grepped for the route, for the handler, and for
the feature's name, across every file in the package. Nothing matched, twice
over, so it reported the endpoint as unimplemented and proposed building it.
The endpoint existed. It was implemented, routed and mounted.

One module in that package, about 60 kB, carried a single NUL byte at offset
53248: a map key separator written as a literal byte where an escape was
meant. ripgrep, which Claude Code's Grep tool runs, classifies a file
containing a NUL as binary. Searching a directory, it skips that file in
silence: no match, no warning. GNU grep prints "binary file matches" and not
the line. Every search across that package had been stepping over the one
file that answered the question. [bench/repro/nul-byte.sh](bench/repro/nul-byte.sh)
reproduces it with each tool.

COMPLEX.md had ranked that module and written a paragraph about it, because
the signals come from the dependency graph and the commit history rather than
from a text search. The file was in the map the whole time. What the map did
not do was say that the file could not be read by the tools the agent was
using, so the agent had no reason to distrust its own empty result. Since
0.5.0 it says so: such files are named under `blind_spots`, with
`git grep -I --text` as the way to read them.

An agent's picture of a repository is assembled from tools that fail quietly.
Searches skip files, globs miss directories, context windows truncate. A map
computed from structure and history is a second source that does not fail in
the same places, and the most valuable part of it is the part that says where
you cannot see.

What it is not: the map does not read code, it ranks and locates. It will not
tell you what a function does, and `blind_spots` lists the gaps it can detect,
not every gap there is.

## Consequence analysis

`complex-md impact <path>` reports what changing a file costs, decomposed, and
measured against bounds the repository declares.

```
$ complex-md impact src/lib/types.ts
src/lib/types.ts  NOT covered by a test
  reach             31   within bound 40, margin 9
  direct            18   (no bound declared)
  untested_reach    31   OVER bound 5 by 26
  hot_reach          3   within bound 3, margin 0
```

The bounds are yours, in `.complex-md/bounds.json`, and the tool never
supplies them:

```json
{ "reach": 40, "untested_reach": 5, "hot_reach": 3 }
```

With no such file every contribution reports `(no bound declared)` and the
result is `unbounded`, which is a different answer from passing and is not
rendered as one. `--strict` exits 1 when a declared bound is exceeded, so the
same command works in CI.

Two properties are deliberate. A consequence is reported as contributions
rather than a single number, because "reaches 31 modules" is trivia and
"reaches 31, none of them covered by a test" is a decision. And the tool ranks
but does not judge: deciding what is acceptable is the engineer's, which is
the division of labour set out in Dempsey and Wrage, *AI-Augmented AADL in
Visual Studio Code* (CMU SEI, DOI 10.58012/4c2e-xd64), whose warning this
follows: without that first row, a clean and analyzable model can still answer
the wrong question.

## See the map as a page

```sh
npx complex-md report
```

This command reads COMPLEX.md at the repository root and writes
`.complex-md/report.html`. Then it prints the path. Open the file in any
browser. The page shows:

- a treemap of the hotspots. Tile area is lines of code, and color is bug fixes in the commit window. A table view holds the same rows.
- each hot or load bearing file with the "Before editing this file" sentence from its paragraph, and the files that change with it.
- the co-change pairs and the directories that move together.
- the blind spots, including each file that text search tools skip because it holds a NUL byte.

The page is one HTML file with no external fonts, scripts or requests, so you
can attach it to an issue or open it offline. It reads the map and the origin
remote only, never the history. Without a COMPLEX.md, the command tells you how
to make one and exits 2.

## Check that the map is current

```sh
npx complex-md verify
```

`verify` recomputes the signals with no model call and compares them with
the committed front matter. Exit 0 means fresh, 1 means drift past
tolerance, and 2 means there is no map or the clone is shallow. A file that
sits at the edge of a list does not flip the result on every commit, so the
command can run in CI on each push.

## Measured, not asserted

Agents follow it. On two repositories with no shared tasks, agents ran the
tests the map names on 14 of 15 risky edits, against 3 of 17 without it
(11 of 11 discordant pairs, p about 0.001). The agent was Claude Opus 5 in
Claude Code. It does not cost correctness: on the real fix's own tests, every
arm with the map passed within one task of the arm without it.

complex-md ships with the benchmark that measured this: real fix commits from
a repository's history, the issue text as the prompt and the commit's parent
as the starting point. Each task runs with and without the map, from the same
commit, and the runs are compared in pairs. After each run the judge runs the
real fix's tests and, in the damage runs, the whole suite as it stood at the
base commit. Tables, method
and raw runs: [bench/RESULTS.md](bench/RESULTS.md).

The map is computed on your machine by `npx complex-md`. The one model call
is the optional prose step at generation time. The CLI sends no telemetry.
Its only network request is that model call, which a provider key or
`--provider` selects, and `cli/test/telemetry.test.js` fails on any other
request.

## Layout

| Path | What |
| --- | --- |
| `prompts/generate.md` | The versioned generation prompt. Single source of truth for the CLI and the skill. |
| `prompts/integration.md` | The normative wiring block appended to AGENTS.md, CLAUDE.md and friends. Served at /integration.md. |
| `cli/` | The `complex-md` npm package: signals engine, generator, wiring, hooks, diff check, drift check, impact, and an opt in MCP server. `npm test` here or inside it. |
| `plugins/complex-md/`, `skills/`, `gemini-extension.json` | The skill as a package for Claude Code, Codex, Gemini CLI and any Agent Skills reader. The build renders each copy from the template. |
| `examples/` | Reference COMPLEX.md files, starting with fastify. This repository carries its own at the root. |
| `bench/` | Collateral damage benchmark on real fix commits, paired arms: does the agent run the tests the map names, pass the fix's tests, and leave the rest of the suite green? `bench/repro/` holds standalone reproductions. |
| `docs/` | Research behind the spec: signal verdicts, agent context-file evidence, wiring mechanics. |
| `content/` | Site pages (markdown, front matter in an HTML comment). |
| `skill/SKILL.tmpl.md` | Template assembled with the prompt into the downloadable skill. |
| `scripts/build.mjs` | Zero dependency static build to `dist/`. |
| `site/` | Stylesheet, the one script, 404. |

## Influences

File ranking by PageRank over the dependency graph follows aider's repo map
(Aider-AI/aider, Apache 2.0). Per path briefs for OpenHands use its path
triggered rule format (All-Hands-AI/OpenHands, MIT). The integration block
can be trained against the benchmark with SkillOpt (microsoft/SkillOpt,
MIT), whose validation gate is the answer to context files that only sound
helpful. The hotspot, churn and coupling signals descend from the software
evolution literature cited in the [spec](https://complex.md/spec).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: the spec changes
by evidence, and every change carries a line in `CHANGELOG.md` saying why.

## License

MIT. Copyright James L. Cowan Jr.

## Build

```sh
npm run build   # writes dist/
```
