# complex-md

`COMPLEX.md` is a computed map of where edits are risky and where bugs get
fixed, generated from a repository's git history for coding agents. This
package generates it, wires it into your agents, and checks each change
against it.

    npx complex-md

Spec, research and the downloadable skill: https://complex.md

## What one run does

1. Computes the spec 0.3 signals locally: lines of code, churn, recency
   weighted churn, bug-fix commits, authors, owner share, co-change pairs,
   fan-in, covering tests. About two seconds on a mid-sized repo.
2. Writes the front matter itself (numbers verbatim) and makes one model call
   for the prose. The first configured provider wins: `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`,
   `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`;
   local Ollama and any OpenAI-compatible endpoint (`COMPLEX_MD_BASE_URL`)
   via `--provider`. Pick explicitly with `--provider <name>` or
   `--model <provider>/<id>`. Without any key it writes
   `.complex-md/prompt.md` for the agent you are already using.
3. Wires the map in, idempotently:
   - appends the integration block to `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
     `.github/copilot-instructions.md` where they exist, plus an
     `@COMPLEX.md` import in `CLAUDE.md`;
   - path-scoped rules keyed to the hotspot files for Claude Code
     (`.claude/rules/`), Cursor (`.cursor/rules/`), OpenHands
     (`.agents/skills/`) and Windsurf (`.windsurf/rules/`), and the block
     for Cline (`.clinerules/`);
   - hooks: Claude Code `PreToolUse` and `Stop`, Cursor `preToolUse` and `stop`.

`--no-wire` writes only COMPLEX.md. `--no-hooks` skips the hooks.

## The hooks

In-context instructions are followed roughly half the time when an agent is
editing existing code late in a session, which is exactly when a hotspot gets
edited. Hooks make the two rules that matter deterministic.

- **PreToolUse gate.** The first edit of a hotspot file in a session is
  denied, and the denial reason is the file's paragraph from COMPLEX.md: what
  it does, what an edit tends to break, the covering tests, the co-change
  partners, and the "Before editing this file" directive. The agent reads it,
  does what it says, re-issues the edit, and every later edit to that file in
  the session goes through. Files that are only co-change partners are never
  held; they get a one-line reminder attached instead.
- **Stop check.** When the agent tries to end its turn, the session's diff is
  checked against the map. If a hotspot was touched or a co-change partner was
  left unchanged, the turn is refused once with the report: the directives,
  the partners with their commit counts, the tests to run.

Modes: `--mode gate` (default), `--mode warn` (let the edit through with the
paragraph attached), `--mode off`. Edit the command in `.claude/settings.json`
or `.cursor/hooks.json`, or set `COMPLEX_MD_GATE`.

## Optional: the MCP server (`--mcp`)

Off by default. `wire --mcp` registers it in `.mcp.json`, `.cursor/mcp.json`
and `.codex/config.toml`. OpenClaw and Hermes keep a machine-level registry,
so `wire --mcp --for openclaw,hermes` registers it through their own CLIs,
with `mcp --root <repo>` pinning it to this repository. `npx complex-md mcp`
runs it on stdio. Six tools:

| Tool | Use it when |
| --- | --- |
| `complex_lookup(path)` | Before editing a file: row, paragraph, directive, partners, covering tests. |
| `complex_where_to_look(keywords?)` | A bug report does not name a file: hotspots ranked by past fixes, re-ranked by the report's words. |
| `complex_impact(path)` | Before changing an interface: the files that import it, partners, tests, test command. |
| `complex_refs(symbol)` | Tracing a name across the repo: definitions and references, hotspots first. |
| `complex_check(files?, base?)` | Before finishing: hotspots touched, partners missed, tests to run. |
| `complex_refresh()` | The map looks stale: recompute the table live from git. |

## Other commands

    npx complex-md check [--staged | --base main] [--json] [--strict]
    npx complex-md signals [--json | --tsv]
    npx complex-md wire [--no-hooks] [--mcp]
                        [--for claude,cursor,openhands,codex,windsurf,cline,openclaw,hermes]
    npx complex-md generate --agent      # write the prompt bundle, no model call

`check --strict` exits 1 on findings, for pre-commit and CI. `wire` detects
which agents a repository already uses from its config directories; `--for`
overrides that. Wiring for Claude Code creates a `CLAUDE.md` that imports
COMPLEX.md when there is none.

Run at an old commit and the window anchors to that commit's date, so a map
regenerated for a past release describes the history that existed then.

Agents follow it. On two repositories with no shared tasks, agents ran the
tests the map names on 14 of 15 risky edits, against 3 of 17 without it
(11 of 11 discordant pairs, p about 0.001), with Claude Opus 5 in Claude
Code. Results and method: `bench/RESULTS.md` in
https://github.com/KletoWorks/complex-md.

## Limits, stated plainly

The analysis is text-level: regular expressions and lightweight parsers
over tracked files, plus git. That is what makes it run in seconds on any
repository with no build or toolchain, and it means the dependency graph is
not a compiler's. Computed imports, dependency injection, reflection and
runtime registration do not resolve; Go fan-in is package-level blast
radius, deliberately conservative. What the graph cannot read is named in
`blind_spots` with counts rather than reported as zero. The score is a sort
order over transparent columns, not a calibrated probability of failure;
the backtest in the repository's `bench/` measures exactly what it does and does not
predict. The spec's "boundary of the analysis" section carries the full
statement.

## Privacy

The signals are computed on your machine by git and Node.js. Without a key
the CLI sends nothing: its one network request is the model call, and it
makes that call only when a key is set.

With a key, the call goes to the provider you chose. It carries the
generation prompt, the computed signals (paths, their numbers, co-change
pairs, the repository profile) and excerpts of up to ten hotspot files:
about 14,000 characters each and 60,000 in all. On undici the request held
five excerpts and 80,000 characters, about 20,000 tokens. `generate --agent`
writes the same request to `.complex-md/prompt.md` and sends nothing, so you
can read it first.
