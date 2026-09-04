# complex-md

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
