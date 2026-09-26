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
integration block in the agent files, path-scoped rules, the PreToolUse and
Stop hooks, and the MCP server. The package lives in `cli/`. Without `npx`,
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
meant. grep classifies a file containing a NUL as binary and skips it in
silence when its output is piped. No match, no warning, exit 0. Every search
across that package had been stepping over the one file that answered the
question.

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

## Layout

| Path | What |
| --- | --- |
| `prompts/generate.md` | The versioned generation prompt. Single source of truth for the CLI and the skill. |
| `prompts/integration.md` | The normative wiring block appended to AGENTS.md, CLAUDE.md and friends. Served at /integration.md. |
| `cli/` | The `complex-md` npm package: signals engine, generator, wiring, hooks, MCP server, diff check. `npm test` here or inside it. |
| `examples/` | Reference COMPLEX.md files, starting with fastify. This repository carries its own at the root. |
| `bench/` | Localization benchmark: does the map get an agent to the right file in fewer tool calls? Real fix history, paired arms. |
| `docs/` | Research behind the spec: signal verdicts, agent context-file evidence, wiring mechanics. |
| `content/` | Site pages (markdown, front matter in an HTML comment). |
| `skill/SKILL.tmpl.md` | Template assembled with the prompt into the downloadable skill. |
| `scripts/build.mjs` | Zero dependency static build to `dist/`. |
| `site/` | Stylesheet, the one script, 404. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: the spec changes
by evidence, and every change carries a line in `CHANGELOG.md` saying why.

## License

MIT. Copyright James L. Cowan Jr.

## Build

```sh
npm run build   # writes dist/
```
