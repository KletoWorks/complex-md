# Changelog

Dated record of notable changes, newest on top: what changed and why. One
entry per change that affects behavior, the published site, or the file
format.

## 2026-10-25  bench: a collateral damage study, pre-registered

**Intent:** no run had shown that the map cuts the tests an agent breaks outside its task. Earlier damage was too rare to compare: 0 of 130 runs on the fastify danger set and 4 of 55 runs with a verdict on undici.

**Change:** `bench/PREREG.md` fixes a study before its first run: Sonnet 5.5 on fastify, mocha and uptime-kuma, a 60 task screen of high fan-in fixes, 15 damaged and 15 clean tasks chosen by a salted hash order, four arms with 2 seeds, and `file` against `none` per task by an exact sign test as the primary comparison.

**Change:** the harness gains `--seeds`, the `stop` arm (the map and the Stop check, no edit gate), a dataset `suite` object for the runner, files and environment, `make-dataset.mjs --min-fan-in` and `--min-tests`, `bench/leak-lines.mjs` for fixed code in readable directories, and `bench/damage.mjs` for scoring, selection, analysis and the advice replay. The TAP reader accepts mocha's lines.

## 2026-10-25  0.11.0: a map on every first run, --via for 12 agent CLIs, open model providers, verify, reversible wiring with unwire, hosted map pages

**Intent:** wire appended a block with a heading but no end, deleted any file in a brief folder whose name had the complex-md- prefix, created CLAUDE.md beside AGENTS.md, and had no way back. A default wire could add 40 or more files to a repository, a rewire never updated an old block, and a Windows checkout could leave mixed line endings.

**Change:** each text wire writes into a file the user owns sits between `<!-- BEGIN complex-md (spec 0.3) -->` and `<!-- END complex-md (spec 0.3) -->` (`#` comments in `.gitattributes` and TOML). Text outside the markers is never changed, and a rewire replaces only the marked text. A file wire writes whole opens with a notice. In a file with front matter, the notice is a YAML comment on line 2.

**Change:** `wire --profile minimal`, the new default, writes one marked line near the top of `AGENTS.md`. It writes the same line in `AGENTS.override.md` when that file exists, and in a `CLAUDE.md` or `GEMINI.md` that does not import `AGENTS.md`. `--profile full`, or naming agents with `--for`, writes the integration block, the CLAUDE.md import, the REVIEW.md include and at most 10 briefs per agent. wire never creates `CLAUDE.md`. OpenHands is detected from `.openhands/` only.

**Change:** wire records each file, marked block, hook entry and MCP entry it writes in `.complex-md/manifest.json`. Each record has a sha256 of the text, line endings read as LF. The manifest holds no clock, and the `.gitignore` entry keeps it committable. wire also keeps a marked block in `.gitattributes` that gives COMPLEX.md, the manifest and each generated file `eol=lf linguist-generated`. JSON settings files keep their own indent and line ending.

**Change:** `complex-md unwire` removes what the manifest records, with the separators wire added, while each hash still matches. A file or section edited since is left in place and named. COMPLEX.md stays. `wire --dry-run` and `unwire --dry-run` print the file plan and write nothing.

**Change:** in a GitHub Actions or GitLab CI build of a pull request, a merge request or a branch other than the default one, `generate` and `wire` print one line and write nothing. `COMPLEX_MD_DEFAULT_BRANCH` overrides the detected default branch.

**Change:** wire and unwire act only on manifest paths that are relative and resolve inside the repository. A cloned repository can carry a hostile manifest; paths that are absolute, contain a `.` or `..` segment or a backslash, or start in `.git` are dropped and logged. The CI rule also recognizes a checkout in `GITHUB_WORKSPACE` or `CI_PROJECT_DIR`.

**Note:** a default rewire of a repository wired by 0.10.0 swaps the old block for one line and removes the old briefs. Run `wire --profile full` to keep them.
**Intent:** a visitor could see a repository's map only after running the tool on a clone. complex.md had no page per repository, no way to find one by pasting an address, and no way for a maintainer to take a page down.

**Change:** `scripts/hosted-pages.mjs --in maps.json --out <dir>` builds one static page per mapped repository at `/OWNER/REPO/`, the raw map at `/OWNER/REPO/COMPLEX.md`, `maps/index.json` and `sitemap-maps.xml`. The same input gives the same bytes. A page leads with the directives. A panel follows that asks the maintainer to commit the file, with the `npx complex-md` command and the one AGENTS.md line agents act on. Then come the treemap, the co-change pairs and the blind spots. A provenance line names the version, the commit and the date, and says that a template wrote the prose. A removal link ends the page. Prose shows only when a template wrote it. Indexable pages are canonical to themselves; the rest carry noindex and a canonical link to the GitHub repository. Owner and repository names must follow GitHub's naming rules. Paths outside a small character set, over 200 characters or with a `..` segment are dropped. Bidi and control characters are stripped, lists are capped, and each page loads only its own origin's files under a policy with no 'unsafe-inline'.

**Change:** `/map` takes owner/name, a github.com URL, a git URL or an SSH remote. It opens the hosted page, links a committed COMPLEX.md, or shows the npx command and a request button. `/map/remove` lists the three ways a page goes away: commit COMPLEX.md, set `hosted: false`, or send the form. Each takes effect within 24 hours. The header and the home page hero link `/map`.

**Change:** the report treemap is SVG, so the local report and a hosted page share one renderer. `site/reserved.json` lists the first path segments that never name an owner, and a test fails the build when a top level name is missing from it.

**Change:** a brief's partner line now reads "4 commits together, 100% of
the less active file's commits". It said "100% of this file's commits",
which overstated coupling whenever the brief's file was the busier one of
the pair.

**Change:** zod moves from 3.25 to 4.6.7 and the MCP SDK lock moves to
1.32.2. `npm audit` reported 18 advisories in the lock file (1 critical, 5
high), among them zod GHSA-mrhx-c7xc-m3w5, a memory exhaustion while
validating oversized collections. It now reports 0. The 6 MCP tools keep the
same input schemas, and an out of range argument is still refused.

**Intent (2026-10-24):** the benchmark maps were 8 to 12 KB, above the
8,192 bytes the spec recommends, and a campaign had no way to stop after a
fixed number of runs or to run parallel workers on one map cache.

**Change:** `bench/run.mjs` keeps each map at 8,192 bytes or less. It cuts
front matter list rows from the end, gives the model a byte budget for the
prose, retries a long reply twice, and records a map still over the cap as
the row's error. `--map-cap` sets the cap (0 turns it off). Each row records
`map_bytes` and `map_cap`. `--max-runs` stops a pass after that many rows,
and `--maps-only` builds the maps before parallel workers share a cache.

**Fix (2026-10-24):** the agent sandbox gave the agent no stdin, so every
real benchmark run in it ended at 0 steps with "Input must be provided
either through stdin". `bench/comply.mjs` did not find maps named after
their month and commit, so it scored no run made since that name.

**Intent:** a first run with no key ended with a prompt file and no map, a
keyed run whose call failed ended the same way, and a default wire wrote
hooks into committed settings. Users of an agent CLI with no API key had no
path to a written map. A committed map could go stale with no signal. The
benchmark let an agent see commits after its task, and the repository had
no private report path, no conduct rules and no AI policy.

**Change:** a run with no provider key writes COMPLEX.md with template prose
built from the computed numbers, marks it `prose: template` in the front
matter, and wires it. Each hotspot paragraph gives the file's commits, fixes,
importers and covering tests and ends with a "Before editing this file,"
directive. The same commit gives byte identical output, and the prose stays
under 700 words. Template prose never replaces prose that a model or a
person wrote; `--template` does. A keyed call that fails (a network error, a
non 2xx status, a stop at the output cap, a refusal, or a reply that is not
a map) also lands template prose, exits 0 and prints one warning line with
the reason. The prompt bundle is still written, so an agent can replace the
prose.

**Change:** a run prints its file plan before the first write: one line per
file it will create, change or remove. The wiring lines come from a dry run
of the wiring itself, and on a keyed run they come under "After the model
call". In a terminal the run asks once; `--yes` skips the question, and a
stdin that is not a terminal never blocks. `.complex-md/*` goes into
`.gitignore` when generate or report writes there, and
`.complex-md/bounds.json` stays committable. A run ends with one computed
fact and https://complex.md/?utm_source=cli. The plan also lists the files a
global target such as openclaw writes into the repository. A first argument
that is a flag runs generate, so `npx complex-md --yes` works.

**Change:** `generate --via <cli>` writes the prose with an agent CLI the
user already runs: claude, codex, gemini, opencode, qwen, kimi, crush, goose,
cursor-agent, copilot, hermes or openclaw. It runs the user's own binary once
in its print mode, under the user's own login, with an argument array and no
shell, and in a read only or plan mode where the CLI has one. The reply is
written only if it keeps the computed front matter, has the four sections and
names no path the repository lacks. A backticked code name such as
`ky.create` or `json.dumps` does not count as a path. A CLI that writes
COMPLEX.md itself has the previous file put back. The run stops after 600 s
(`--via-timeout`), and Ctrl-C stops the agent CLI too. A bare `--via` is
refused before any provider is picked. hermes runs as `hermes chat --source
tool`, which keeps the run out of the user's session list.

**Change:** six providers detect from their key: `moonshot`, `qwen` (the
international DashScope endpoint), `zai`, `minimax`, `fireworks` and
`cerebras`. `huggingface` and `lmstudio` work only with `--provider`, like
`ollama`. The Anthropic default model is `claude-sonnet-5-5`. The Anthropic
call asks for 16,000 output tokens instead of 4,000, with a 300 s timeout
instead of 120 s. A reply that stops at the cap, or that is refused, is never
written; the same holds for `finish_reason: length` on OpenAI compatible
providers.

**Change:** `complex-md verify` checks a committed map against the code with
no model call. Exit 0 is fresh, 1 is drift past tolerance, 2 is no map or a
shallow clone, and `--json` prints each change. A file joins a list only at
125% of the fresh cut and leaves only under 75% of it, and a pair also needs
10 points of coupling past the 34% floor. On a history where two files swap
the last hotspot place, a plain list comparison flips 9 times in 10 commits
and verify stays fresh. verify passes the front matter's commit to git only
when it is a hex SHA.

**Change:** `wire` writes no hooks by default. `--hooks` writes them to
`.claude/settings.json` and `.cursor/hooks.json`, and `--hooks --local`
writes the Claude Code hooks to `.claude/settings.local.json` and adds that
path to `.git/info/exclude`. On the fastify runs the hooks arm cost about 50%
more per run at the median and passed no more fix tests than the briefs
alone. A rewire leaves hooks that an earlier version wrote and logs one line.
This repository no longer commits its own hooks or `.mcp.json`.

**Change:** classification and graph fixes. testing.py, test_utils.py,
conftest.py, helpers.py and spec_helper.rb are no longer covering tests
unless pytest's `python_files` names them; on flask, src/flask/testing.py is
now source and 6 test files cover it. `python_files` applies only under the
`testpaths` of the same config, so `python_files = *.py` no longer makes
every module a test. test.<ext> and tests.<ext>, such as a Rust tests.rs,
stay tests. Code under data/ ranks. build/ and out/ count as generated only
when a package.json or a tsconfig names them as output. Python `from M import
x` resolves to the submodule x, also in commented, continued and trailing
comma lists; on flask the fan_in of `__init__.py` goes from 9 to 5.
`require('..')`, `'.'` and `'../lib/'` resolve through package.json main,
then the index file. A blobless clone reads history with exact renames only:
0.48 s instead of 10.2 s on a fresh flask clone. A treeless clone skips
history and adds a blind spot with the refetch command. Brief scopes escape
`[ ] { } * ?` and commas, so `app/[id]/page.tsx` scopes to itself. Quoted
front matter values read back without escapes, a top level `@types/` path no
longer splits a commit, and `--help` builds its `--for` list from the target
table. With the graph fixed, the selector backtest's direct list names 35% of
fix tests at 6% of the suite, where 0.10.0 reported 29% at 3%. No selector
meets the bar.

**Change:** the skill installs as a package in four tools from one template,
with no hooks and no MCP server: a Claude Code plugin with its own
marketplace, an Agent Plugins manifest for Codex, a Gemini CLI extension, and
an Agent Skills folder. At session start each tool loads 74 to 141 tokens.
Each package keeps the generation prompt in `references/generate.md`, so its
SKILL.md is about 4,490 tokens, under the 5,000 that Agent Skills recommends.
The site download stays one file.

**Change:** the benchmark isolates each agent run. Each run gets a fresh
repository at the task's base with no remotes, tags or reflog, and the
harness refuses a run that holds any later object. Each agent runs in its own
network, mount and PID namespaces, reaches only the model API through a
proxy, and gets `--disallowedTools WebFetch,WebSearch` and no MCP servers or
connectors. The agent command is resolved on PATH before the mounts are
masked, so an install whose PATH entry is a symlink still starts. One
recorded agent had fetched upstream main with a Node `fetch`. A seeded leak
test plants a marker in every later commit, ref and on a loopback server, and
no route reaches it. Each month's map is built at the oldest base in that
month; before, 8 of 30 undici tasks got a map built after their own fix. A
budget, turn or time cap is judged as a stop, not dropped. `--arms gold`
judges the real fix with no agent, and the `mcp` arm is retired. The node
install's built in undici remains readable to an agent, so undici results
carry that limit. `bench/models.mjs` scores maps from 15 models on 3 pinned
repositories with 6 deterministic checks. It prices the run before the first
call and refuses a `--budget` or `--max-tokens` that is not a number and a
model with no fixed price.

**Change:** the repository has a security policy with a private report path
and a 7 day first answer, the Contributor Covenant 2.1, issue forms for a
wrong map, a new language and a benchmark task with their own labels, and a
pull request template. CONTRIBUTING.md states the AI assistance policy:
disclose the tool in the pull request, add an `Assisted-by:` or a
`Co-Authored-By:` trailer, and have a person read the diff and answer the
review. Every workflow action runs from a full commit SHA, Dependabot
proposes new ones weekly, the release installs npm 11.21.1 instead of
`npm@latest`, and OpenSSF Scorecard runs weekly. `cli/test/telemetry.test.js`
fails on any network request other than the model call a key selects.

## 2026-10-24  0.10.0: texts match the code, six CLI fixes, briefs for review bots, a report page, scored claims

**Intent:** several public texts said things the code or the finished runs
contradict, six defects gave agents wrong or no advice, review bots never saw
the map, and two claims about the map had no measurement behind them.

**Change:** the README, the CLI README, the site, the spec, the skill and
`bench/RESULTS.md` now say what the code does and what the runs show. Without
a key, the CLI sends nothing. With a key, its one model call carries the
signals and excerpts of up to ten hotspot files, about 60,000 characters of
code at most. RESULTS.md reports the three finished runs: on two repositories
with no shared tasks, agents ran the tests the map names on 14 of 15 risky
edits, against 3 of 17 without it (11 of 11 discordant pairs, p about 0.001),
with Claude Opus 5 in Claude Code. Success on the real fix's own tests stayed
within one task in every run. The scorer also counts advice that names a test
directory, and the cost lines separate the arms. The NUL byte blind spot now
names ripgrep, which Claude Code's Grep tool runs and which skips such a file
with no match and no warning; GNU grep prints a binary file notice and no
line. `bench/repro/nul-byte.sh` shows what each tool does. MCP is documented
as an opt in (`--mcp`), and `--help` lists `impact`, `report` and `--mcp`.
`cli/test/truth.test.js` fails when a public text brings back a sentence the
code or a run contradicts.

**Change:** a map paragraph matches a path only as a whole name, with a
boundary on each side, and a shorter suffix such as the basename counts only
when no other mapped path shares it. Before this, a monorepo with two mapped
`index.ts` files gave the second file the first file's paragraph and
directive. A file that an earlier paragraph named as a partner got that
paragraph instead of its own. A paragraph that names the full path now
ranks ahead of one that names a suffix, and the earliest mention wins
within each kind. Route
paths with brackets, parentheses or a plus sign (`app/[slug]/page.tsx`) still
match. That text reaches the edit gate, the Stop report, `check`, the briefs
and the MCP lookup.

**Change:** `check --base <ref>` exits 2 when the ref is not in the checkout,
and the message says to fetch the history (`fetch-depth: 0`). Before this, a
missing ref gave an empty diff, the report said "clean", and `--strict` exited
0 on every shallow CI checkout.

**Change:** COMPLEX.md parses with CRLF line ends and a leading byte order
mark. Before this, a Windows checkout (`core.autocrlf=true`) parsed the map
to null and every hook went silent.

**Change:** wired hooks run `node_modules/.bin/complex-md` first, then a
`complex-md` on PATH, then `npx -y --prefer-offline complex-md@<version>`.
Before this, every edit ran an unpinned `npx -y complex-md`: 0.76 s per call,
whatever version was published last, and with the registry unreachable it
waited out the 30 s hook timeout. With a project install a hook takes 84 ms,
and the pinned npx answers from the cache in 0.73 s, measured on one machine.
Running `wire` again rewrites the hooks that 0.9.2 and earlier wrote and keeps
their flags. The skill's hand written hooks are built from the same command.

**Change:** the NUL byte blind spot names only files with a source, style or
markup extension outside fixture and data directories. Before this,
compressed test corpora, `.mo` catalogs and archives under `tests/` were
listed as source files to fix; in the ripgrep repository the list goes from
7 to 0. Commits that a bot authored or committed no longer count toward
churn, fixes, authors or co-change, and a blind spot line states how many
were left out (3 in the ripgrep repository).

**Change:** `wire` writes one brief per hot file where review bots and more
agents read them. Copilot code review and the Copilot cloud agent get
`.github/instructions/complex-md/<slug>.instructions.md`, with `applyTo` set to
that one path. Antigravity gets `.agents/rules/complex-md-<slug>.md` with a
glob trigger. Devin Desktop and Windsurf get `trigger: glob` rules in
`.devin/rules/` and `.windsurf/rules/`, Kiro gets `inclusion: fileMatch`
steering files, and Cline gets conditional rules with a `paths:` list. Each
channel turns on only when its own config exists, or with `--for`;
`.github/` alone does not turn Copilot on. A `REVIEW.md` that exists gets one
`@COMPLEX.md` line, so Claude Code Review includes the map; `wire` never
creates one. `--for openclaw,hermes` did nothing without `--mcp`; it now
writes the portable skill `.agents/skills/complex-md/SKILL.md`, and a
`.agents/` folder that holds only that skill does not turn OpenHands on.

**Change:** the integration block loads once per agent. Before this, a
CLAUDE.md or GEMINI.md that imports AGENTS.md got a second copy, and rule
files that held only the block (Claude Code, Cursor, OpenHands, Windsurf,
Cline, Roo) repeated it. Claude Code and Roo get no such file now. Cursor,
OpenHands, Windsurf and Cline get one only when AGENTS.md does not carry the
block, and a rewire removes the old copies. `check` names
any generated brief in the change that differs from what `wire` writes,
because Copilot review reads instructions from the pull request's head
branch. A single `.clinerules` file no longer makes `wire` fail. The spec's
Stage 3 and the skill describe all of this. The benchmark's `file` arm wires
through the same code, so a rerun no longer gets
`.claude/rules/complex-md.md`; new rows record `cli_version` and
`cli_commit`.

**Change:** `complex-md report` renders COMPLEX.md as a local page at
`.complex-md/report.html` and prints its path. The page is one self contained
HTML file. It shows a treemap of the hotspots (area by lines, color by bug
fixes, with a table view), the directive for each hot or load bearing file,
the co-change pairs and seams, and the blind spots. It names each file that
search tools skip. The page loads nothing over the network, escapes every
file name, follows the system light or dark theme and fits a 390 px screen.

**Change:** the benchmark scores three claims from committed runs and fix
history, with no model call. `bench/comply.mjs` reproduces the compliance
result above from the transcripts. `bench/partners.mjs` asks whether agents
miss a co-change partner less often with the map. Under the definition set
before the analysis (a Read or an edit of the partner), the result is null for
the file arm: 7 pairs for the map against 2, pooled, p 0.18. The hooks arm on
fastify gives 6 against 0, p 0.031. A wider definition, chosen after that
result was known, gives 16 against 1; it is exploratory and decides nothing.
`bench/selectors.mjs` backtests five test selectors on 360 fixes in undici,
fastify and nodemon. In the band of files with 1 to 5 importers, the direct
importers the map names today find 29% of the tests a fix changed, at 3% of
the suite. The full reverse closure finds 97% at 80%, and the cuts at 15% of
the suite find 70% to 73%. The bar was 80% recall at 15% of the suite or
less, in both the 1 to 5 and the 6 to 20 importer bands. No selector reached
it, so the map keeps naming direct importers. Method and
tables: `bench/SELECTORS.md`. Results: `bench/results/partners.json` and
`bench/results/selectors/`.

### Also in 0.10.0

- The generation prompt (0.4.0) writes the prose to the sentence rules of
  ASD-STE100, the controlled language of aerospace maintenance manuals, with
  the repository's own vocabulary allowed: one topic per sentence, 25 words
  for a description and 20 for an instruction, active voice, imperative
  instructions, one name per thing, no modal hedges. Earlier maps already
  read this way most of the time; the rules make it the contract, so a
  paragraph an agent quotes is one it can act on.
- `wire()` accepts a replacement integration block for one call, keeping the
  heading that marks it. The benchmark uses it (`--skill <file>`) to try
  candidate wordings against the same map and tasks, and `bench/skillopt/`
  trains that block with SkillOpt against the collateral damage score.
- The benchmark measures collateral damage: the suite as it stood at the base
  commit runs again after the agent's patch, and a test that passed before and
  fails after, on two runs, in a file the real fix did not change, is a
  regression. Tasks can be selected for it (`make-dataset --danger`).

## 2026-09-27  0.9.2: a commit sha is always a string

**Change:** the front matter reader kept a commit sha as a string even when
every character is a digit. Previously such a sha was read as a number and
the map compared unequal to its own HEAD, reporting itself stale. 0.9.1 did
not publish; this release carries its changes.

## 2026-09-27  0.9.1: the CLI reads its prompts from the repository when the packaged copy is absent

**Change:** `cli/prompts/` is a copy synced at prepack; inside the repository
the site build rewrites it while the test suite runs files in parallel, and a
test could read it in the moment between removal and rewrite. The CLI now
falls back to the repository's `prompts/`, which is byte identical and always
present, so the 0.9.0 release run's single failure cannot recur. The
published package is unaffected: only the copy exists there and nothing
rewrites it. 0.9.0 did not publish; this release carries its changes.

## 2026-09-27  Credential shaped paths are never named in a map

**Change:** a path whose name has the shape of a credential file (`.env`,
`*.pem`, `id_rsa`, `credentials.json` and kin, templates like `.env.example`
excepted) is left out of every list the map carries and counted under
`blind_spots`. A committed map naming `.env.production` would tell a reader
where the secrets are and an agent to open them. The practice follows
repomix (MIT), which checks contents; this checks names. The spec and the
skill no longer describe the MCP server.

## 2026-09-27  0.9.0: structural rank, and briefs for OpenHands

**Change:** every file in the signals table carries `rank`, its structural
importance by PageRank over the import graph, scaled so the file the most
importance flows to is 100. Where `fan_in` counts direct importers, `rank`
weights each importer by its own importance, so a hub that the important
modules depend on outranks a file that merely has many leaves importing it.
It appears beside `fan_in` in the table, the TSV and each per path brief.

**Change:** OpenHands receives a brief per hot path as a path triggered rule
in `.agents/skills/`, injected when the agent touches that file. Only files
prefixed `complex-md-` are ever cleared on a rewire.

Influences: the ranking follows aider's repo map (Apache 2.0); the path
triggered rule format is OpenHands' (MIT).

## 2026-09-26  0.8.0: per outcome statistics in the benchmark; MCP server opt in

**Change:** `bench/stats.mjs` adds the Wilcoxon signed rank test, a trimmed
mean, the sign test and a power calculation, and the report applies them per
outcome. Token accounting distinguishes fresh, cache read and cache write.
The MCP server is now opt in (`--mcp`): benchmarking showed it adds tool
calls without improving any outcome on the reference dataset.

## 2026-09-25  0.7.1: inline lists in hand written maps

**Change:** the front matter parser reads inline flow sequences, so a hand
written map may use `co_change: []` or `files: [a.js, b.js]`. Wiring and the
brief builder accept a malformed map by skipping what they cannot read.

## 2026-09-25  Consequence analysis, against bounds the repository declares

**Intent:** the map ranked files and never said what changing one costs, and
it never asked what the engineer considers acceptable. Dempsey and Wrage
(DOI 10.58012/4c2e-xd64) divide the work four ways and this engine had two of
the four: nothing calculated consequences, and nothing carried the engineer's
review criteria. Their warning is about the second gap, not the first:
without it, a clean and analyzable model can still answer the wrong question.

**Change:** `complex-md impact <path>` computes transitive reach through the
dependency graph and decomposes it into contributions: total reach, direct
importers, how much of the reach no test covers, how much of it the map
itself ranks, and, where a boundary function is supplied, how much crosses
one. Each is reported against a bound declared in `.complex-md/bounds.json`,
with margin. That file is the engineer's and is never generated; with none
present every contribution reports no bound declared and the result is
`unbounded`, which is distinct from passing and is not rendered as passing. A
malformed bounds file is refused rather than read as an absence of bounds.
`--strict` exits 1 when a declared bound is exceeded. Depth is recorded per
reached file and cycles terminate.

**Change:** where a repository has submodules or workspace packages, crossing
one of those boundaries is its own contribution. Reaching twelve files inside
a package and reaching twelve across four packages are different consequences
and were the same number. This is not cross repository analysis: pairing
commits between a superproject and a submodule needs a decision about what
counts as one change, and that decision is not made here.

## 2026-09-25  Per path briefs, and a recorded answer for a fixed repository

**Intent:** two gaps. Wiring delivered a pointer where it should have
delivered an answer, and nothing in the test suite asserted the engine's whole
output, so a scoring change could reorder every user's hotspots and pass.

**Change:** wiring writes one rule per briefed path, in `.claude/rules/complex-md/`
and `.cursor/rules/complex-md/`, each scoped to that path and carrying that
file's own numbers, its paragraph from "Why these files are hot", its
co-change partners with their coupling, and its directive. Previously a single
rule listed every hot path and its body said to go and read COMPLEX.md at the
root, so the trigger was local and the payload was not. Putting the briefs
into one file instead would push every paragraph into context the moment any
one path is touched, which is why they are separate files. The directory is
cleared on each run: a brief for a path the map no longer lists is advice
nothing recomputes. A path that appears only as a co-change partner is
described as one and is not called risky.

**Change:** `cli/test/regression.test.js` records the engine's answer on a
fixture repository built byte for byte identically, including its commit SHA.
Three goldens: the ranked regime, the thin history regime, and the tuning
defaults. The second and third exist because the first was not sufficient. The
regimes produce different files and the fixture pins `thinHistory` to reach
the first, leaving the second uncovered; and a threshold is only caught when a
file sits on it, which no fixture can arrange for all of them, so moving
`thinHistory` from 50 to 9999 passed both regime goldens. Verified by breaking
the engine five ways and confirming each is caught. `UPDATE_GOLDEN=1`
rerecords.

## 2026-09-25  Blind spots name files a NUL byte hides from grep; a created AGENTS.md says what it is

**Intent:** the map's job is to say where you cannot see. A source file that
carries a NUL byte is the sharpest blind spot a repository can have, because
grep classifies it as binary and skips it in silence: no match, no warning,
exit 0. The tool said nothing about it, in either of the two ways it can go
wrong, and a map that stays quiet there is worse than no map, because it is
trusted.

**Change:** `blind_spots` now names those files by path. Two positions, two
different failures, both covered. A NUL inside the first 8 kB used to classify
the file as an asset, so it dropped out of the map without a word. A NUL past
8 kB was never seen at all: the file was read, ranked and described as source,
so the map vouched for a file that no text search in the repository could
reach. The note gives `git grep -I --text` as the way to read it, and says the
byte is almost always a separator that should have been written as an escape.
Detection is one pass over bytes already in memory.

**Change:** when `wire` creates `AGENTS.md` because no primary file exists, the
file now opens by saying it holds one section and is not a full agent
contract, and that repository conventions belong above it. Wiring a repository
that already has a contract appends to it and is unchanged; the preamble never
appears there. complex-md owns the map and its integration block, not a
project's conventions, and a file named `AGENTS.md` that holds only the block
reads as though it owns both.

## 2026-09-04  Sticky blurred header, install copy button, two-row carousel, phone fixes

**Change:** the header is sticky with a frosted backdrop; the install line
carries a copy button and, on phones, is full width and centered with the
buttons; the wide example card wraps on phones instead of clipping and
drops its long label; the header keeps one row down to 375px; the hero
columns are vertically centered; the agent carousel is two rows of larger
marks with different agents, slower, drifting in opposite directions.

## 2026-09-04  Landing page: agent marquee, accordion FAQ, shorter copy, short footer

**Intent:** the page reads in one pass: short sentences, a clear mission,
the agents shown by their marks, questions that open on demand, and the
attribution kept to one footer line with the rest in metadata.
**Change:** a marquee of 25 monochrome agent marks (site/logos, one
currentColor rule for both themes, static and wrapping under reduced
motion) replaces the text chips; the FAQ is a details/summary accordion
with one- or two-sentence answers; About becomes "Why this exists"; the
prose column narrows to about 75 characters; the hero pitch is two short
lines; the footer is one line (author, MIT, GitHub, npm) plus versions,
with no design credit.

## 2026-09-04  Brand mark

**Intent:** one mark identifies the project everywhere a visitor meets it.
**Change:** the owner-supplied mark (monochrome, used exactly as supplied)
sits beside the wordmark in the header and the hero, is the favicon (with a
dark-mode variant), the PNG icons, the social card, and the 404 page.
`site/mark.path` is the single source the build reads.

## 2026-09-04  Site: social card, icons, structured data, sitemap

**Intent:** a shared link renders with an image and a title, the tab has an
icon, and search and answer engines get the same answers the page gives.
The site is deliberately not an installable app: it is a document, and a
document should never be served stale from a cache.
**Change:** `og.png` social card and Twitter card tags; SVG favicon, PNG icons
(192, 512, apple-touch); `robots.txt` and `sitemap.xml`; JSON-LD for the
software (SoftwareApplication), the FAQ (FAQPage, generated from the page's
own answers) and the spec and skill pages (TechArticle). File cards gain a
copy button. A service worker served for a few minutes the same day is
replaced by one that unregisters itself; it stays served until 2026-10-01.

## 2026-09-04  0.4.1: releases publish from a tag

**Intent:** a release is a tag push, verified and published by the workflow,
never a browser step.
**Change:** `release.yml` publishes to npm with provenance through trusted
publishing when a `vX.Y.Z` tag matching `cli/package.json` is pushed; a test
keeps the spec version in agreement across the engine, the prompt and the
spec page. No change to the analysis or the file format.

## 2026-09-04  Public repository sanitized; catalog deferred

**Intent:** the repository carries the project and nothing of the operating
environment; the launch scope is the spec, the skill, the published CLI and
the articles.
**Change:** ops analytics, raw benchmark transcripts and the internal audit
removed; research and benchmark documents rewritten in impersonal register;
the catalog of generated files for known repositories moves out of the launch
scope and its link leaves the spec.

## 2026-09-04  Safe generation, friendly failures, CI, the repository's own map

**Intent:** a first run must never make things worse: a bad model reply
cannot overwrite a good file, a repository with no history gets a sentence
instead of a stack trace, and every runtime surface has a test.
**Change:** `generate` validates that the four spec sections came back and
refuses to write otherwise; any model-call failure (network, timeout,
non-2xx, malformed body) falls back to writing the `.complex-md/` prompt
bundle and exits 0 with the reason; both provider calls carry a 120 s
timeout. A repository with no commits, or no repository at all, exits 2
with one line and no raw git output; `hook stop` outside a repository
exits 0 quietly. The spec's wiring block is injected from
`prompts/integration.md` at build time so it cannot drift again; the
by-hand article's example uses the 0.3 front matter. A second `wire` no
longer appends the block to a CLAUDE.md that imports an already-wired
AGENTS.md. The root package is `complex-md-site` (the publishable package
keeps `complex-md`). GitHub Actions runs the CLI tests and the site build
on every push and pull request. The repository carries its own COMPLEX.md,
wired into its agent files, and a reference fastify map under `examples/`.
Tests 36 to 68: MCP tools, hook output shapes, check formatting, generate
fallbacks, CLI exits, skill template placeholders. The site mirrors
agents.md structurally (measured tokens, a headless design gate before
deploy) and its copy is rewritten in plain language.

## 2026-09-03  0.4.0: resolver depth, eleven providers, nine wiring targets, the stated boundary

**Intent:** close the resolution gaps a text-level analyzer can close, work
with whatever model a user already pays for, wire into the harnesses people
actually run, verify the claims with fixtures, and write the limits down
where a reader cannot miss them.
**Change:** dependency resolution gains npm/pnpm workspace packages through
`exports` maps, per-package tsconfig/jsconfig `paths` with single-level
`extends`, `package.json` `imports` (`#` specifiers), vite/webpack
`resolve.alias`, Python package roots derived from `__init__.py` chains, and
correct `require_relative` scoping; 14 declarative resolver fixtures verify
edges and must-not-edges per ecosystem. Model calls go through one provider
table (anthropic, openai, openrouter, gemini, xai, deepseek, mistral, groq,
together, ollama, custom OpenAI-compatible base URL); the first configured
key wins, `--provider` and `--model provider/id` override, and providers
without a pinned default require an explicit model rather than a guess.
Wiring is a per-target table: windsurf, cline and roo rule files join
claude, cursor, openhands and codex; openclaw and hermes are global
registries, opt-in via `--for`, configured through their own CLIs with
`mcp --root <repo>`. The Codex MCP entry uses the computed invocation instead
of a hardcoded npx. The spec gains "The boundary of the analysis". Tests 9 to
36. The site mirrors agents.md (MIT, credited): palette, typography, dark
mode and section order, with 4px radii throughout; author attribution in
metadata, JSON-LD and the footer on every page.

## 2026-09-03  0.3.1: fixes from five unfamiliar repositories; backtest

**Intent:** the 0.3 engine had been tuned on two repositories, so it was run
on repositories it had not seen (requests, express, cobra, a one-commit
snapshot of fastify) and its central claim, that the list points at where the
next fix lands, was backtested against each repository's own history.
**Change:** Go package imports resolve against `go.mod` (a package import
depends on every non-test `.go` file in the package); source files whose
language the graph cannot read are named in `blind_spots` with counts, and a
repository with no resolvable edges reports `history-only`. `examples/`,
`samples/`, `demos/` are a new `example` kind, unranked. Dotfiles are
`other`; `.mdc` rule files are `docs`; `*.crontab` is `config`;
`.webmanifest`, `.vcf`, `.ics` are `data`; a source file in a `doc/`
directory is code. The hotspot cut is capped at a fifth of the rankable
files. `tests: 0` is worded as "no test references this file" everywhere,
and the spec says why. `bulk_commits_skipped` becomes `commits_skipped`.
`bench/backtest.mjs` is new; on five repositories `churn_w * loc` recalls
the next fix's files as well or better than the 0.3 score every time, so
`complex_where_to_look` orders by that, and the spec states the score ranks
blast radius, not fix likelihood.

## 2026-09-03  Spec 0.3: two axes, commit-indexed history, kinds, seams, load-bearing files

**Intent:** the 0.2 signals failed on a large multi-site repository: a
4,229 line stylesheet and a test file outranked a shared database module
with 46 importers, coverage was attributed by substring match, a changelog
updated with every change made seven of the ten co-change pairs, fan-in was
a stem grep, windows were calendar months, and submodules were silently
absent. The analysis had to adapt to what a repository is rather than gate
on time.
**Change:** `cli/src/graph.js` is new: every tracked file gets a kind, and a
one-pass dependency graph resolves ESM and CJS imports, HTML script and link
tags, CSS `@import`, Python, Ruby, PHP, shell `source`, Caddy `import` globs,
and path literals in scripts and configs. Fan-in comes from the graph, with
tests separated as covering tests on exact-stem matches only. `signals.js`
reads the last 2,000 non-merge commits with a per-commit half-life, detects
convention files by frequency and drops them from co-change, reports
`coupling` as the share of the quieter side's commits that touch both, adds
directory `seams`, lists untouched high-fan-in files as `load_bearing`, cuts
hotspots adaptively, and writes a `profile` and `blind_spots`. The score is
`10 * log2(1+loc) * sqrt(churn_w + 0.5*fixes_w + 0.5) * (1+log2(1+fan_in))^2
* kind_weight`. Front matter, parser, bundle, prompt (0.3.0), check, hooks,
wire and MCP (`complex_refs` added) moved to the new shape; when run from a
checkout inside the repository, hooks and MCP call that checkout instead of
`npx`. Spec rewritten to 0.3 with a real fastify run as the example; the
skill's shell fallback is commit-indexed and labels itself.

## 2026-09-03  Repository public; model defaults current; benchmark pilot

**Intent:** the site links to the source, so the repository is public; the
CLI's default model IDs are verified current; the benchmark pilot ran for
real.
**Change:** `KletoWorks/complex-md` is public under MIT. Defaults are
`claude-sonnet-5` and `gpt-5.6-terra`. Pilot: 8 fastify tasks, `none` vs
`file`, Claude Code headless, stopped at first edit; median 2 tool calls to
the first gold file in both arms, paired 1 win / 5 ties / 2 losses. Recorded
in `bench/README.md` with the reading that fastify is too small and too well
named for localization to cost anything, and the next design targets a large
repository with issue-sourced tasks. A run the harness stops itself no longer
counts as an error.

## 2026-09-03  Doc pages read as documents; author byline; source link; MIT

**Intent:** the spec and skill pages rendered as one unbroken column,
especially on phones; articles carry their author; the source is linked.
**Change:** doc pages regain paragraph rhythm, list markers, underlined
links, a hairline above each h2, a header block with version and raw
markdown links, and an "On this page" list for pages with four or more
sections. Code blocks wrap on phones. The spec's run-in definitions are h3s.
Author is James L. Cowan Jr. in the dateline, the articles index, JSON-LD and
`cli/package.json`. A GitHub link joins the nav; the footer credits source
and MIT. `LICENSE` added.

## 2026-09-03  Localization benchmark harness; anchored windows; wire --for

**Intent:** the effectiveness claim was an inference from the localization
literature; the honest next step is to measure it on a repository's own fix
history.
**Change:** new `bench/` (not published with the CLI): `make-dataset.mjs`
turns fix commits into tasks, `run.mjs` runs Claude Code headless per task
and arm and counts tool calls to the first read of a gold file, `report.mjs`
prints paired tables. Three engine changes: signal windows anchor at HEAD's
commit date when HEAD is older than a week; `wire --for` overrides detection
and targeting Claude Code without a `CLAUDE.md` creates one; check and hook
output show the three strongest co-change partners per changed file rather
than every pair.

## 2026-09-03  The CLI: hooks that gate hotspot edits, an MCP server, a diff check

**Intent:** in-context rules measure about 45% compliance when an agent is
editing existing code; hooks are deterministic.
**Change:** new `cli/` package. `npx complex-md` computes the signals
in-process, writes the front matter itself, makes one model call for the
prose or writes the prompt bundle for the user's agent, then wires: block,
`@COMPLEX.md`, path rules, hooks, MCP. Hooks: Claude Code `PreToolUse` denies
the first edit of a hotspot per session with the paragraph as reason, `Stop`
refuses the turn once with the diff report; Cursor equivalents; `--mode
gate|warn|off`. MCP server with `complex_lookup`, `complex_where_to_look`,
`complex_impact`, `complex_check`, `complex_refresh`. `complex-md check
--strict` for pre-commit and CI.

## 2026-09-03  Spec 0.2 second pass: fixes column, localization rule, OpenHands

**Intent:** a second research pass over the practice corpus found the
localization evidence the first pass missed: RepoGraph, SHERLOC, and the
FixCache line (past fixes predict future fixes).
**Change:** hotspot rows gain `fixes`; the block has four single-sentence
rules, the new one sending an agent with an unlocated bug to the
highest-`fixes` hotspots before a repo-wide search; hotspot paragraphs name
covering tests; Stage 3 writes an OpenHands path-triggered rule. Prompt 0.2.1.

## 2026-09-03  Spec 0.2: evidence based signals, directive prose, path scoped wiring

**Intent:** check the 0.1 signals against the defect-prediction literature
and the 2026 studies of how coding agents consume context files
(docs/RESEARCH-signals-and-wiring.md).
**Change:** hotspot rows gain `churn_w`, `authors` and `owner_share`; `score`
is `round(churn_w * loc)` with a three commit floor; bulk commits skipped;
co-change drops manifests, lockfiles, CI and tests. Every hotspot and
coupling paragraph ends with an instruction, because agents follow
directives and ignore overviews. Wiring: a three-rule block, `@COMPLEX.md`
import in CLAUDE.md, path scoped rules for Claude Code and Cursor keyed to
the hotspot files. Prompt 0.2.0.

## 2026-09-02  Priority wiring: the integration block

**Change:** canonical block in `prompts/integration.md` (served at
/integration.md); the skill gains Stage 3 (append the block verbatim to the
agent files, idempotent by heading); the spec declares the block normative.

## 2026-09-02  Site: header chrome, mobile pass to 320px

**Change:** the brand chip is the home link with a separate download square
beside it; fluid display sizes, wrapping nav, 600px and 380px breakpoints,
zero horizontal overflow verified at 320, 360, 390 and 600 on every page.

## 2026-09-02  Site: agents.md anchored design system

**Change:** artifact-as-hero home with a real fastify file card, monochrome
band layout, heat accents on scores only, self-hosted fonts, llms.txt mirror,
restyled doc pages and 404.

## 2026-09-02  Front door and first two articles

**Change:** home page rebuilt around a real signals excerpt, articles
pipeline in build.mjs with Article JSON-LD and an index, first two articles.

## 2026-09-02  Spec, prompt, skill, static build

**Change:** spec 0.1 at /spec with a raw twin at /spec.md, versioned
`prompts/generate.md` as the single generation source, the skill assembled
at build into /complex-md.skill.md, zero dependency build to dist/.
