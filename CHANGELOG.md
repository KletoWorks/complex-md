# Changelog

Dated record of notable changes, newest on top: what changed and why. One
entry per change that affects behavior, the published site, or the file
format.

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
**Change:** `jameslcowan/complex-md` is public under MIT. Defaults are
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
