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
integration block in the agent files, a rule per hot path carrying that
file's own brief, and the PreToolUse and Stop hooks. The package lives in `cli/`. Without `npx`,
the skill does the same by hand: download https://complex.md/complex-md.skill.md
and run it with any coding agent inside the repo.

If npm answers `No versions available for complex-md`, the repository's
`.npmrc` (or your user config) sets `min-release-age`, npm's guard against
packages published within the last few days. Run
`npm_config_min_release_age=0 npx -y complex-md` once, or wait for the
release to age past the threshold.


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
is the optional prose step at generation time.

## Layout

| Path | What |
| --- | --- |
| `prompts/generate.md` | The versioned generation prompt. Single source of truth for the CLI and the skill. |
| `prompts/integration.md` | The normative wiring block appended to AGENTS.md, CLAUDE.md and friends. Served at /integration.md. |
| `cli/` | The `complex-md` npm package: signals engine, generator, wiring, hooks, diff check, impact, and an opt in MCP server. `npm test` here or inside it. |
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
