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
   fan-in, covering tests.
2. Writes the front matter itself (numbers verbatim) and makes one model call
   for the prose. The first configured provider wins: `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`,
   `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`,
   `MOONSHOT_API_KEY` (Kimi), `DASHSCOPE_API_KEY` (Qwen), `ZAI_API_KEY`
   (GLM), `MINIMAX_API_KEY`, `FIREWORKS_API_KEY`, `CEREBRAS_API_KEY`. These
   work only with `--provider`: `huggingface` (`HF_TOKEN`), `ollama`,
   `lmstudio` (LM Studio on localhost:1234), and any OpenAI-compatible
   endpoint (`COMPLEX_MD_BASE_URL`). Pick explicitly with `--provider <name>`
   or `--model <provider>/<id>`. The Anthropic default is
   `claude-sonnet-5-5`. Qwen uses the international DashScope endpoint. For
   another endpoint, set `COMPLEX_MD_BASE_URL` and `COMPLEX_MD_API_KEY` and
   pass `--provider custom --model <id>`.

   Without any key, it writes COMPLEX.md with template prose built from the
   computed numbers, marked `prose: template` in the front matter, and wires
   it. It also writes `.complex-md/prompt.md`, so the agent you are already
   using can replace the prose. Template prose never replaces prose that a
   model or a person wrote; `--template` does. A keyed call that fails (a
   network error, a non 2xx status, a stop at the output cap, a refusal, or
   a reply that is not a map) also lands template prose. The run then exits
   0 and prints one warning line with the reason. The reply itself is never
   written.

   Before the first write, the run prints every file it will create or
   change. On a keyed run, the wiring lines come under "After the model
   call". In a terminal it asks once, and `--yes` skips the question. A
   stdin that is not a terminal never blocks the run. `.complex-md/*` goes
   into `.gitignore` when a run writes there, and `.complex-md/bounds.json`
   stays committable.
3. Wires the map in, idempotently. Each text it writes into a file you own
   sits between `<!-- BEGIN complex-md (spec 0.3) -->` and
   `<!-- END complex-md (spec 0.3) -->`, and text outside the markers is
   never changed. A file it writes whole opens with a notice that says so.
   The default profile, `minimal`, writes:
   - one line near the top of `AGENTS.md`, after its title, that sends an
     agent to COMPLEX.md before it edits a listed file; the same line in
     `AGENTS.override.md` when it exists, in a `CLAUDE.md` or `GEMINI.md`
     that does not import `AGENTS.md`, and in
     `.github/copilot-instructions.md` when there is no `AGENTS.md`. With
     none of these files, it creates `AGENTS.md`. It never creates
     `CLAUDE.md`;
   - a marked block in `.gitattributes` that gives `COMPLEX.md`, the
     manifest and each generated file `eol=lf linguist-generated`;
   - `.complex-md/manifest.json`, the record of each file and block it
     wrote, with a hash of each. It is small, holds no clock, and is meant
     to be committed.

   `--profile full`, or naming agents with `--for`, also writes:
   - the integration block in place of the line, and an `@COMPLEX.md`
     import in `CLAUDE.md`;
   - at most 10 briefs, one per hot path, scoped to that path, where each
     agent or review bot looks: Claude Code (`.claude/rules/complex-md/`),
     Cursor (`.cursor/rules/complex-md/`), Copilot code review and cloud
     agent (`.github/instructions/complex-md/`, when
     `.github/copilot-instructions.md` or `.github/instructions/` exists),
     OpenHands (`.agents/skills/`, when `.openhands/` exists), Antigravity
     (`.agents/rules/`), Devin Desktop (`.devin/rules/`), Windsurf
     (`.windsurf/rules/`), Kiro (`.kiro/steering/`), Cline (`.clinerules/`);
   - an `@COMPLEX.md` line in an existing `REVIEW.md`, for Claude Code
     Review; wire never creates `REVIEW.md`.

   In either profile:
   - with `--hooks` only: Claude Code `PreToolUse` and `Stop` in
     `.claude/settings.json`, Cursor `preToolUse` and `stop` in
     `.cursor/hooks.json`, merged beside your own entries;
   - OpenClaw and Hermes are wired only when asked (`--for openclaw,hermes`):
     they get the portable skill `.agents/skills/complex-md/SKILL.md`, and
     `--mcp` also registers the server through their own CLIs.

A rule file that would only repeat the block is not written while
`AGENTS.md` carries it. A rewire removes a file the previous wire wrote and
this one does not, such as a brief for a path the map dropped, while its
hash matches the manifest. It never deletes or overwrites a file it did not
write.

In GitHub Actions and GitLab CI, `generate` and `wire` write only on the
default branch. A pull request or merge request build, or a build of
another branch, prints one line and writes nothing. The default branch comes
from the CI event, or from `COMPLEX_MD_DEFAULT_BRANCH`.

`--no-wire` writes only COMPLEX.md. A default run writes no hooks.
`--hooks` writes them to the committed settings files. `--hooks --local`
writes the Claude Code hooks to `.claude/settings.local.json` and adds that
path to `.git/info/exclude`. Cursor has no per user hooks file in the
project, so `--local` skips it.

## Use the agent CLI you already run

No API key? Pass `--via` with the agent CLI you already have:

    npx complex-md --via claude
    npx complex-md --via codex --model <id>   # --model is passed to the CLI

complex-md computes the front matter, then runs that CLI once in its print
mode, in this repository. It runs your own, unmodified binary under your
own login and plan, and it reads none of the CLI's credentials. The bundle
goes on stdin, or in `.complex-md/prompt.md` for opencode, kimi and
cursor-agent; for those three the file plan lists the bundle files too.
Supported: claude, codex, gemini, opencode, qwen, kimi, crush, goose,
cursor-agent, copilot, hermes, openclaw.

complex-md starts each CLI with an argument array and no shell, and uses a
read only or plan mode where the CLI has one. goose, kimi, crush, hermes and
openclaw document no read only mode. hermes runs with `--source tool`, so
the run stays out of your hermes session list. If a CLI writes COMPLEX.md
itself, complex-md puts the previous file back, and it lists any other path
the CLI changed.

complex-md writes the reply only if it keeps the computed front matter, has
the four sections and names no file the repository lacks. Otherwise the
run lands template prose, or keeps a map that a model or a person wrote.
The run stops after 600 s; change this with `--via-timeout <seconds>`.
Ctrl-C stops the agent CLI too. Limit: on Windows, a CLI installed as a
`.cmd` shim cannot start without a shell, so use its native `.exe` or WSL.

## The hooks

In-context instructions are followed roughly half the time when an agent is
editing existing code late in a session, which is exactly when a hotspot gets
edited. Hooks make the two rules that matter deterministic. They are opt
in: on the fastify benchmark runs the hooks arm cost about 50% more per run
at the median and passed no more of the real fixes' tests than the briefs
alone (`bench/RESULTS.md`).

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

A wired hook runs the project's own install (`node_modules/.bin/complex-md`)
when there is one. Otherwise it runs a `complex-md` found on PATH, and
otherwise `npx -y --prefer-offline complex-md@<version>`, pinned to the
version that wired it. With a local install, a hook takes about 80 ms per
edit. Hooks written by 0.9.2 and earlier ran an unpinned `npx -y complex-md`;
run `npx complex-md wire --hooks` again to rewrite them in the pinned form.
A run without `--hooks` leaves them as they are and says so.

## Is the map still current?

    npx complex-md verify [--json]

`verify` recomputes the signals with no model call and compares them with
the committed front matter. Exit 0 means fresh, 1 means drift past
tolerance, and 2 means there is no map or the clone is shallow. A file joins
a list only at 125% of the fresh cut and drops off only under 75%, so two
files that trade the last place never flip the result. In CI, check out the
full history (`fetch-depth: 0`) and run `npx complex-md verify`.

## Is the map valid?

    npx complex-md lint [path] [--json]

`lint` checks a COMPLEX.md (default `./COMPLEX.md`) against the spec 0.4
draft, with no model call and no network. It validates the front matter
against `spec/0.4/complex-md.schema.json`, which the package carries, and then
the rules the schema cannot state: every path is relative to the repository
root, every listed path exists in the working tree, and the sections and
directives are in place. It prints one line per finding as
`path:line: rule: message` and exits 1 on any error, 0 otherwise. A file over
8,192 bytes gets a warning, which does not fail. `--json` prints
`{"ok": bool, "errors": [...], "warnings": [...]}`.

## Optional: the MCP server (`--mcp`)

The server and its MCP SDK and zod dependencies live in the separate
`complex-md-mcp` package, so a normal `complex-md` install does not download
them. It is off by default. `wire --mcp` registers the package in
`.mcp.json`, `.cursor/mcp.json` and `.codex/config.toml`; those entries use
the same version as `complex-md`, and their ownership and hashes stay in
`.complex-md/manifest.json`. OpenClaw and Hermes keep a machine-level registry,
so `wire --mcp --for openclaw,hermes` registers it through their own CLIs,
with `--root <repo>` pinning it to this repository.

    npx complex-md mcp
    npx complex-md-mcp register

The first command remains a compatibility handoff to the matching, pinned
`complex-md-mcp` package and prints one line to stderr. The second directly
registers the server. The MCP server speaks stdio and exposes six tools:

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
    npx complex-md impact <path> [--json] [--strict]
    npx complex-md report                # write .complex-md/report.html, a page of the map
    npx complex-md wire [--profile minimal|full] [--dry-run] [--hooks [--local]] [--mcp]
                        [--for claude,cursor,openhands,antigravity,codex,copilot,review,devin,windsurf,kiro,cline,openclaw,hermes]
    npx complex-md unwire [--dry-run]    # remove what wire wrote, as its manifest records it
    npx complex-md generate --agent      # write the prompt bundle, no model call
    npx complex-md generate --template   # template prose from the numbers, no model call
    npx complex-md generate --yes        # skip the question after the file plan

`unwire` reads `.complex-md/manifest.json`, where wire records each file and
marked section it wrote with a hash. It deletes those files and cuts out
those sections. A file or section edited since wire wrote it stays, and
unwire names it. COMPLEX.md stays too. `--dry-run` on `wire` or `unwire`
prints the file plan and writes nothing. The manifest is committed, so it
can come from someone else: wire and unwire ignore a listed path that is
absolute, has a `..` segment or starts in `.git`, and they write and
remove nothing that a symbolic link takes outside the repository.

`check --strict` exits 1 on findings, for pre-commit and CI.
`check --base <ref>` exits 2 when the ref is not in the checkout. In GitHub
Actions, check out with `fetch-depth: 0` so `origin/main` exists. `check` also
names a generated brief that differs from what `wire` writes, since review
bots read those files from the pull request. `impact --strict`
exits 1 when a bound in `.complex-md/bounds.json` is exceeded. `wire` detects
which agents a repository already uses from its config directories; `--for`
overrides that.

Run at an old commit and the window anchors to that commit's date, so a map
regenerated for a past release describes the history that existed then.

Agents follow it. On two repositories with no shared tasks, agents ran the
tests the map names on 14 of 15 risky edits, against 3 of 17 without it
(11 of 11 discordant pairs, p about 0.001), with Claude Opus 5 in Claude
Code. Results and method: `bench/RESULTS.md` in
https://github.com/KletoWorks/complex-md.

## Limits, stated plainly

The analysis is text-level: regular expressions and lightweight parsers
over tracked files, plus git. That is what makes it run on any
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
can read it first. With `--via`, the same bundle goes to the agent CLI you
named, which sends it to the model it uses.

The CLI sends no telemetry. Its only network request is the optional model
call that a provider key or `--provider` selects, and
`cli/test/telemetry.test.js` fails on any other request.
