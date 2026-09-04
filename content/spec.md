<!-- meta
title: COMPLEX.md spec 0.3
description: The specification for COMPLEX.md, a computed markdown file that tells coding agents where the structural risk in a codebase lives.
path: /spec
kicker: Spec {{SPEC_VERSION}} &middot; prompt {{PROMPT_VERSION}} &middot; <a href="/spec.md">raw markdown</a> &middot; <a href="https://github.com/KletoWorks/complex-md/blob/main/content/spec.md">history</a>
-->

# COMPLEX.md spec 0.3

COMPLEX.md is a markdown file at the root of a repository that tells a coding
agent where the structural risk in the codebase lives. It is computed from the
repository's own git history and file graph, not written from memory. The
format follows the shape Google uses for DESIGN.md: YAML front matter carries
the machine readable data, prose sections carry the rationale and the
instructions.

AGENTS.md tells an agent how to behave. CLAUDE.md tells an agent what the
project is. COMPLEX.md tells an agent where it is likely to break something,
and what to do about it before it does.

The signals rest on the defect-prediction literature and on the 2026
research into how coding agents actually consume context files; the
evidence and every verdict are in
[docs/RESEARCH-signals-and-wiring.md](https://github.com/KletoWorks/complex-md/blob/main/docs/RESEARCH-signals-and-wiring.md).
The short version: change history carries the signal, descriptive overviews
are ignored by agents while concrete instructions are followed, and a
secondary file gets priority by being imported and path-scoped, not by
claiming it. The analysis has two axes: a dependency graph over the working
tree, so a quiet file that 46 files import can rank, and history indexed by
commit rather than by calendar, so a six-week-old repository and a
six-year-old one are read the same way. Every file has a kind, and the file
says what the analysis could not see. What changed between versions is
recorded in the [changelog](https://github.com/KletoWorks/complex-md/blob/main/CHANGELOG.md).

The efficiency case is specific. Measured on SWE-bench, coding agents spend
about half their turns and over 300k tokens per issue locating the fault
before writing a patch, and two thirds of their localization failures are
picking the wrong file among nearby candidates. Files with a bug-fix
history are where the next fix lands (a ten percent cache of them catches
73 to 95 percent of future faulty files). COMPLEX.md puts that list in the
agent's context before the search starts.

## Where the file lives

Commit `COMPLEX.md` at the repository root, next to `README.md` and any agent
context files. Generation ends by wiring the file into the repository's
primary agent files; see "Wiring it in".

## Two axes

Spec 0.3 computes the map on two axes and says which one it is standing on.

**Structure** comes from the working tree: what kind of file each path is,
and which files depend on it, through an import, a `require`, a script or
link tag, a stylesheet import, a Caddy or shell include, or a path spelled
out in a script or a config file. Structure needs no history. A repository
assembled last month from three open source projects has a full structural
map on day one.

**History** comes from the most recent commits, indexed by commit rather
than by the calendar: the last 2,000 non-merge commits, or all of them when
there are fewer, with recency weights that decay per commit. A team that
ships 600 commits a month and a team that ships 30 are read the same way,
because the unit is the change, not the month. Time is reported as a fact
(the dates the window spans, the velocity) and never used as a threshold.

The front matter carries a `profile` with the repository's shape on both
axes and a `confidence` line: `structure+history` when both carry weight,
`structure-only` when fewer than 50 usable commits exist, `history-only`
when no dependency edge could be resolved, and a `single author` note when
one committer identity makes the authorship columns empty of information.
Everything the analysis could not see goes under `blind_spots`: submodules,
vendored directories, generated files, a shallow clone, a single author.

## Scope: what each file is

Every tracked path is classified into one kind, and the kind decides what
the file can be:

| Kind | What it is | Ranked | Counts as dependent | In co-change |
| --- | --- | --- | --- | --- |
| `source` | Code by extension | yes, weight 1 | yes | yes |
| `config` | Deployment and build configuration: compose, Caddy, Dockerfile, yaml, toml, SQL migrations and seeds | yes, weight 1 | yes | yes |
| `markup` | HTML and templates | yes, weight 0.8 | yes | yes |
| `style` | CSS and preprocessors | yes, weight 0.5 | yes | yes |
| `test` | Test files and directories | no | no: a covering test | no |
| `docs` | Markdown, text, docs directories, agent rule files, licenses, changelogs | no | no | yes |
| `example` | examples, samples, demos directories | no | no | no |
| `data` | JSON, CSV, fixtures, snapshots | no | no | no |
| `manifest` | package.json, Cargo.toml, go.mod and kin | no | no | no |
| `ci` | Workflows and pipeline files | no | no | no |
| `generated` | Build output, lockfiles, files that say they are generated | no | no | no |
| `vendored` | vendor, node_modules, third_party, minified bundles | no | no | no |
| `asset` | Binary and image files | no | no | no |
| `other` | Dotfiles and anything unrecognized | no | no | no |

The reasons follow real runs. A manifest with 631 release bumps and four CI
workflows edited together were once the top co-change pairs on fastify. A
markdown file under `specs/` was a test. A 3,600-line test file was a
hotspot. Twenty-three files under `examples/` filled express's table, and
`.gitignore` was a config hotspot on requests, until they had kinds of their
own. A source file in a `doc/` directory (Go's `doc` package) is code. A stylesheet linked by thirteen pages is a real blast radius but a
smaller one than a module imported by thirteen files, hence the weight.
Documentation stays in co-change because a module that always moves with
its reference page is real coupling. `files_analyzed` counts the rankable
files.

Convention files are detected, not listed: any file that appears in more
than a quarter of the analyzed commits is a ritual (a changelog updated with
every change) and is excluded from co-change, and named in the profile.

## The signals

Every number in COMPLEX.md is computed locally from the repository. Spec 0.3
defines nine per-file signals, two pairwise signals, and a score.

### Kind (`kind`)

The classification above, so a reader knows whether a row is a module, a
deployment contract, a page or a stylesheet without opening it.

### Lines of code (`loc`)

The line count of the file. Size alone is never risk; it is the multiplier
that says how much code an edit lands in, and it enters the score as a
logarithm: a 4,000 line file is not forty times as dangerous as a 100 line
one.

### Churn (`churn`)

The number of analyzed commits that touched the file. Change history is the
best validated predictor of where faults appear, at every scale studied.
Commits that touch more than 30 files are skipped as bulk operations
(renames, formatters, license headers); the profile reports how many.

### Weighted churn (`churn_w`)

The same commits, each weighted by `0.5 ^ (age_in_commits / half_life)`,
where the half-life is a quarter of the window (at least 50 commits). The
newest commit counts one; a commit half a window ago counts a quarter. This
is Graves et al.'s decaying fault potential with the clock replaced by the
commit counter, which is why an actively hot file outranks a file that was
hot a thousand commits ago whatever the calendar says. Two decimals.

### Fixes (`fixes`)

The subset of the file's commits whose message says it fixes something: the
words fix, fixes, fixed, fixing, bug, bugfix, hotfix or regression, matched
case-insensitively as whole words. Issue references (`#123`) are deliberately
not matched, because on squash-merged repositories they label every commit
a fix. This is the Rahman ranking that Google chose over FixCache for being
as accurate and far easier to explain: files fixed before are where the
next fix lands. It is the column an agent hunting a bug sorts by. Fixes
enter the score at half weight on top of the commit they already are.

### Authors (`authors`) and owner share (`owner_share`)

Distinct committer identities on the file in the window, and the top
committer's share of its commits, 0 to 1. Near 1 means one head holds the
knowledge; near `1 / authors` means nobody owns it. On a repository with a
single committer both columns are present, because the shape is fixed, and
the profile says they carry nothing; the prose does not discuss ownership.

### Fan-in (`fan_in`)

How many files depend on the file, from the dependency graph: ES and
CommonJS imports with extension and index resolution, tsconfig and jsconfig
path aliases per package directory with single-level `extends`, npm and
pnpm workspace packages through their `exports` maps (`main` and `module`
as fallbacks), `package.json` `imports` maps (`#` specifiers, nearest
package wins), `resolve.alias` entries in vite and webpack configs, HTML
`script` and `link` tags including root-relative URLs resolved against the
nearest web root, CSS `@import`, Python imports against package roots
derived from `__init__.py` chains (so `src/` layouts resolve without a
hardcoded list), Ruby requires (`require_relative` file-relative, `require`
through `lib/`), PHP requires, shell `source`, Caddy `import` globs, Go
package imports resolved against `go.mod` (a package import depends on
every file in the package), and path literals in scripts and configuration
that name a repository file outright. Languages the graph does not resolve (Rust, Java,
C, and others) are named in `blind_spots` with their file counts, and when
they are most of the repository `confidence` is `history-only`. Tests are
not counted here; they are covering tests. Documentation never counts; a
path in prose describes, it does not depend. Fan-in is not evidence of
defects; it is the blast radius, and it enters the score as the squared
logarithm of the dependent count: each doubling of dependents widens the
radius by a fixed step, and radius compounds with the chance of a mistake.

### Covering tests (`tests`)

The number of test files that reach the file through an import, a path
reference, or an exact stem match in the same area (`a.test.js` beside
`a.js`, or `test/a.test.js` for `src/a.js`). Never a substring match; before exact matching,
that is how `app.js` was reported covered by `admin.test.mjs`. Zero means no
test references the file, which is a finding the paragraph states; it does
not mean untested, because a suite that imports the package root (express's
`test/res.*.js` for `lib/response.js`) is not attributed to the files behind
the entry point.

### Co-change

Pairs of files that appear in the same analyzed commits at least `pair_min`
times, where `pair_min` scales with the window (one per 150 commits, between
3 and 10), with two numbers: `count`, the shared commits, and `coupling`,
the percentage of the quieter file's commits that also touched the other.
"When the seed changes, compose changes 84 percent of the time" is the
sentence an agent needs. Pairs under 34 percent are dropped. Co-change
reveals coupling the dependency graph cannot see: a schema and a
serializer, a config and the code that assumes it, a public API and its
type declaration.

### Seams

The same measure one level up, between areas (the first two path
components), for coupling that lives in a directory rather than a file: a
seed directory and a compose file move together in a third of their commits
although the individual seed file differs every time. Seams are how a
monorepo's contracts show up.

### Load-bearing files

Rankable files that no commit in the window touched and that at least five
files depend on, listed by fan-in. They are not hotspots; they are the floor
everyone stands on, and an agent editing one needs to know that forty files
will feel it. On a repository with thin history every file is untouched, so
this list is empty and structure ranks the hotspots directly.

### Hotspot score (`score`)

```
score = round(10 * log2(1 + loc)
                 * sqrt(churn_w + 0.5 * fixes_w + 0.5)
                 * (1 + log2(1 + fan_in))^2
                 * kind_weight)
```

Size, activity and structure, each on its own scale, multiplied. The
half-point activity floor is what lets a quiet file that everything depends
on rank at all: without it, a shared database module in a 1,300-file
repository, imported by 46 files, ranks twentieth on churn alone. A file with fewer than three commits and fewer than five
dependents is never a hotspot. The hotspot list is cut where scores fall
under a tenth of the top row, between 5 and 15 rows and never more than a
fifth of the rankable files, so a repository with one dominant file shows
six hotspots, a 13-file library shows three, and a monorepo shows fifteen.
The score is a ranking heuristic over transparent columns, not a law: the
columns are the data, the score is the sort order.

What the score predicts, measured. `bench/backtest.mjs` rebuilds the map at
the parent of each recent fix commit and asks whether the fixed files were
on the hotspot list. On five repositories (an 800-file monorepo, fastify,
express, requests, cobra; 40 fixes each) the list recalls 25%, 50%, 73%,
46% and 61% of the files the next fix touched, at 2 to 3 times chance for
a list its size. The plain product `churn_w * loc` does as well or
better on every one of them (35%, 52%, 82%, 56%, 61%). The structural term
in the score does not help find the next fix; it is there so that a quiet
file with 46 importers is on the list an agent is warned about before it
edits. Two questions, two orderings: the score answers "where does an edit
break things", and `complex_where_to_look` orders by `churn_w * loc` to
answer "where is the bug". Neither has been shown to change what an agent
does; that benchmark (`bench/run.mjs`) is a paired, model-in-the-loop run
and its one result so far, on fastify, was a null.

## The boundary of the analysis

Everything above is text-level extraction: regular expressions and
lightweight parsers over tracked files, plus git plumbing. It is not a
compiler, a language server, tree-sitter with resolvers, or a code
intelligence index, and the spec does not pretend otherwise. The line
matters in both directions.

What the text level buys: the whole analysis runs locally in seconds on any
repository in any mix of languages, with no build, no dependency install,
and no toolchain. That is what lets one `npx` run work on a Go module, a
pnpm monorepo and a pile of Caddy configs alike.

What it cannot see: computed and dynamic imports, dependency injection,
reflection, generated registrations, framework conventions that bind by
name at runtime, `extends` chains deeper than one level or via package
names, and export conditions beyond the first level. A file reached only
through one of those mechanisms undercounts on `fan_in` and covering
tests. Go overcounts in the conservative direction: an import targets a
package, so it is recorded as depending on every non-test file in that
directory, which is useful blast radius and inflated file-level fan-in at
the same time. The mechanism for this honesty is `blind_spots`: what the
graph could not read is named with counts, and when unresolved files are
most of the repository, `confidence` drops to `history-only` rather than
presenting a fan-in of zero as a measurement.

The same register applies to the score. "score 843" is a sort position over
the transparent columns above, not a calibrated probability of failure; the
backtest in the previous section is the measurement of what it does and
does not predict, and the structural term is justified by blast radius, not
by fix prediction. Anyone quoting the number as scientific authority is
overreading it, and the file itself should never invite that reading.

## Front matter

The front matter is YAML between `---` fences at the top of the file. All
fields are required; lists may be empty. Numbers are copied verbatim from
the analysis, never estimated. Hotspots are cut as described above, at most
15; load-bearing at most 5; co-change at most 10; seams at most 6.

The example is a real run on fastify/fastify at `af6e2e43`, abridged to two
hotspot rows and four pairs.

```yaml
---
complex_md: "0.3"
generated: 2026-09-02
commit: af6e2e43
tool: complex-md/0.4.0
window_commits: 2000
files_analyzed: 73
profile:
  files_total: 394
  files_in_scope: 73
  loc_in_scope: 12005
  kinds: "test 231, source 67, docs 52, ci 24, generated 9, config 6, other 2, asset 1, data 1, manifest 1"
  languages: "js 49, ts 17, mjs 1"
  dependency_edges: 372
  commits_total: 4426
  commits_analyzed: 1871
  commits_skipped: 129
  half_life_commits: 500
  window_from: 2021-05-25
  window_to: 2026-09-02
  velocity_30d: 31.1
  authors_total: 591
  concentration_50: 3
  hotspot_cut: 6
  pair_min: 10
  confidence: "structure+history"
hotspots:
  - path: fastify.js
    kind: source
    loc: 1009
    churn: 234
    churn_w: 75.49
    fixes: 53
    authors: 66
    owner_share: 0.44
    fan_in: 24
    tests: 63
    score: 29220
  - path: lib/errors.js
    kind: source
    loc: 554
    churn: 45
    churn_w: 15.91
    fixes: 18
    authors: 30
    owner_share: 0.11
    fan_in: 17
    tests: 10
    score: 10806
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
  - files: [docs/Reference/Errors.md, lib/errors.js]
    count: 28
    coupling: 62
  - files: [fastify.d.ts, fastify.js]
    count: 24
    coupling: 35
  - files: [docs/Reference/Warnings.md, lib/warnings.js]
    count: 22
    coupling: 76
seams:
blind_spots:
  - 9 generated or lock files excluded
---
```

| Field | Meaning |
| --- | --- |
| `complex_md` | Spec version this file conforms to, as a string. |
| `generated` | Date of the newest analyzed commit, `YYYY-MM-DD`. |
| `commit` | Short sha of the commit that was analyzed. |
| `tool` | Generator and version, or `by-hand`. |
| `window_commits` | Number of most recent non-merge commits analyzed, before the bulk exclusion. |
| `files_analyzed` | Count of rankable files. |
| `profile` | Repository shape: file and kind counts, languages, dependency edges, history depth, span and velocity, committers, score concentration, the hotspot cut and pair threshold actually used, and `confidence`. |
| `hotspots` | Top files by `score`, highest first, each with all nine signals and the score. |
| `load_bearing` | Untouched files with many dependents, by `fan_in`. |
| `co_change` | File pairs with `count` shared commits and `coupling` percent, highest count first. |
| `seams` | Area pairs, same shape with `dirs`. |
| `blind_spots` | Sentences naming what the analysis could not see. |

## Prose sections

Four sections, all required, in this order. The prose is written from the
computed data plus the actual text of the top hotspot files. Total prose
stays under 600 words. If a section has nothing worth saying, it says so in
one sentence.

The rule that matters most: **each hotspot paragraph and each coupling
paragraph ends with an instruction.** The research is unambiguous that
agents do not benefit from repository overviews and do follow specific
directives. A paragraph that only describes a file is the part of the map
that gets skipped; the sentence that says what to run, open or preserve
before editing is the part that changes behavior.

The 0.3 rule: **the prose reads the profile first.** On `structure-only`
confidence the first sentence says the ranking rests on size and dependents
and that churn, fixes and ownership will mean something once the repository
has history. With one committer, ownership is not discussed. A hotspot with
`tests: 0` is said to be untested, and its instruction is about how to
verify rather than which test to run. Submodules and vendored code named in
`blind_spots` get one sentence saying the map does not cover them.

**`## Where the risk lives`** names where change risk concentrates, in three
to six sentences that each stand alone when quoted. Name the kind of code
(routing, state, serialization, a public API and its types), the two or
three files where bug fixes land with their `fixes` counts, the load-bearing
files if any (what depends on them, and that nobody touches them), and,
where the numbers show it and more than one person committed, the ownership
pattern (one author holds it, or nobody does).

**`## Why these files are hot`** gives one short paragraph per top hotspot,
at most five: what the file does, why it keeps changing, what depends on it
and so what an edit there tends to break, which tests cover it, and then one
imperative sentence
beginning "Before editing this file," that names a concrete action: the test
file or command to run, the partner file to open, the invariant or contract
to preserve. The shape is deliberate: the best measured localization system
on SWE-bench reports each location as root cause, dependencies and testing
impact, not as a bare path, and this paragraph is that finding written down
in advance.

**`## Change coupling`** explains which files and areas move together, using
the coupling percentage as the strength of the claim, and whether the
coupling is by design or by decay, then one imperative sentence per cluster:
what to open and check when one side changes. Coupling by decay gets the
instruction to break it, not to obey it.

**`## What to read first`** is an ordered list of three to seven files an
agent should read before editing anything hot, each with a reason.
Load-bearing files belong here. This section is already an instruction;
keep it that way.

### Example section

```markdown
## Why these files are hot

fastify.js is the public constructor and plugin root: 234 of the last 2,000
commits touched it, 53 of them bug fixes, from 66 authors with the busiest
holding 44 percent, and 24 modules depend on it while 63 test files reach
it. It changes because every option, hook and decorator lands here first.
Edits tend to break lib/route.js, which moves with it in 45 percent of its
commits, and the TypeScript surface in fastify.d.ts (35 percent). Before
editing this file, open lib/route.js and fastify.d.ts alongside it, and run
`npm run test:typescript` and test/internals/initial-config.test.js after.
```

## Generating the file

Three ways to produce a conforming COMPLEX.md:

1. **The CLI**, the reference implementation. `npx complex-md` builds the
   dependency graph and reads the history locally (about a second on a
   1,300-file repository), writes the front matter itself so no number
   passes through a model, and makes one model call for the prose (or hands
   the prompt bundle to the agent you are already using when no API key is
   set). Nothing but the top hotspot files and the signals table leaves the
   machine. The same package provides the hooks and the MCP server described
   under "Enforcement and runtime".
2. **The skill.** Download the [complex-md skill](/skill) and run it with any
   coding agent inside the repo. Where Node is available the skill runs the
   CLI's analysis; where it is not, it computes the history axis with git
   and awk and a fan-in approximation with grep, and sets
   `tool: complex-md-skill` so a reader knows the structural axis is the
   degraded one.
3. **By hand.** Compute the numbers with the CLI or the skill's commands,
   fill the front matter honestly, write the four sections, set
   `tool: by-hand`.

The generation prompt is a single versioned file,
[prompts/generate.md](/complex-md.skill.md), shared by all three paths.

## Wiring it in (priority)

A risk map no agent reads is dead weight. COMPLEX.md is a secondary context
file; coding agents load AGENTS.md, CLAUDE.md, or their tool's equivalent
first. So the final stage of every generation path wires the file into the
repository's primary agent files, automatically and in the same run:
generating a COMPLEX.md is the user's consent to wire it in, and no
generator asks first.

The research on what makes a secondary file get followed drives the shape:

- **Reference from the primary file, and import where the tool supports
  it.** An import in CLAUDE.md transmits a secondary file's instructions
  with no measurable loss, so CLAUDE.md gets the block and an `@COMPLEX.md`
  line that loads the whole map at launch.
- **Do not claim priority; trigger it.** Declared precedence has no measured
  effect on compliance. Concrete triggers tied to named files and named
  situations do. Each rule in the block opens with its trigger: a listed
  file is about to be edited, a coupled file is being edited, a bug's
  location is unknown, the repo is new to the agent.
- **One emphasized line.** Anthropic's guidance for CLAUDE.md is that when
  one instruction keeps being skipped, emphasis on that line alone helps,
  and emphasis on many lines helps none of them. The block spends its one
  `IMPORTANT` on the rule that carries the map's value, reading the hotspot
  paragraph before the edit, and the map itself uses no emphasis anywhere.
- **Few rules.** Each additional independent rule is another place to fail
  partially. Four rules, each a single sentence with one action, and one
  note.
- **Path scope it.** Compliance is lowest when editing existing code late in
  a session, which is exactly when a hotspot gets edited. Claude Code,
  Cursor and OpenHands all load rules only when a matching file is touched,
  so the generator writes a rule whose paths are the hotspot files
  themselves. The directives reappear at the moment they apply.

Stage 3 of generation, in full:

1. Append the block below, verbatim, to each of `AGENTS.md`, `CLAUDE.md`,
   `GEMINI.md`, and `.github/copilot-instructions.md` that exists, separated
   by one blank line; skip any file that already contains the block's
   heading. If none exist, create `AGENTS.md` containing only the block.
2. In `CLAUDE.md` only, add the line `@COMPLEX.md` on its own line directly
   after the block, unless the file already imports it.
3. If `.claude/` exists, write `.claude/rules/complex-md.md` with the front
   matter `alwaysApply: false` and a single line `paths:` listing every
   hotspot and co-change path, comma separated and unquoted (the YAML list
   form does not load), followed by the block.
4. If `.cursor/` exists, write `.cursor/rules/complex-md.mdc` with the front
   matter `description: COMPLEX.md structural risk map`, `alwaysApply: false`
   and `globs:` listing the same paths, followed by the block.
5. If `.openhands/` or `.agents/` exists, write `.agents/skills/complex-md.md`
   with the front matter `name: complex-md` and a `paths:` YAML list of the
   same paths, quoted, followed by the block. OpenHands injects it once, the
   first time a matching file is touched, at zero baseline cost.
6. Install the hooks and register the MCP server (next section) where the
   tool directories exist. `npx complex-md wire` does steps 1 to 7
   idempotently; the skill writes the same files by hand when `npx` is
   unavailable.
7. Regeneration rewrites the rule files (the paths change) and leaves the
   primary files alone.

## Enforcement and runtime

Everything above is in-context instruction, and the measured ceiling for
in-context instruction is low exactly where COMPLEX.md matters: about 45
percent compliance when editing existing code, decaying through a session.
The long-context benchmark authors are explicit that anything critical
belongs in deterministic enforcement outside the model. The spec therefore
defines two mechanisms that the CLI installs and the skill wires by hand.

### Hooks

Two rules become deterministic:

- *Gate.* The first edit of a hotspot file in a session is denied, and the
  denial reason is that file's paragraph from COMPLEX.md together with its
  co-change partners, covering tests and the "Before editing this file"
  directive. The agent reads it, does what it says, and re-issues the edit;
  later edits to that file in the same session go through. Files that are
  only co-change partners are never held; they get a one-line reminder
  attached to the edit instead. This is rule 1 of the block, enforced.
- *Stop check.* When the agent tries to end its turn, the session's diff is
  checked against the map. If a hotspot was touched or a co-change partner
  was left unchanged, the turn is refused once with the report: directives,
  partners with commit counts, tests to run. This is rule 2, enforced, plus
  the test the paragraph named.

Claude Code: `PreToolUse` on `Edit|Write|MultiEdit|NotebookEdit` and `Stop`
in `.claude/settings.json`. Cursor: `preToolUse` and `stop` in
`.cursor/hooks.json`. Both hooks are once per session per file, keyed by the
tool's session id, and take `--mode gate | warn | off`. `warn` lets the edit
through with the paragraph attached, for teams that find the gate too firm.

### MCP server

`npx complex-md mcp` exposes the map and live signals as
tools, so an agent can pull exactly the paragraph, partner list or importer
list it needs mid-task instead of reading the whole file once at launch. The
one intervention shown to lift agent success across frameworks on SWE-bench
is repository structure the agent queries during localization; this is that
shape, at the file level, from the dependency graph and history together.

| Tool | Answers |
| --- | --- |
| `complex_lookup(path)` | Row, paragraph, directive, partners, covering tests for one file. |
| `complex_where_to_look(keywords?)` | Hotspots ranked by recent activity times size (the backtested best predictor of the next fix), re-ranked by words from a bug report. |
| `complex_impact(path)` | Files that depend on it, partners, covering tests, test command. |
| `complex_refs(symbol)` | Where a symbol is defined and every file that references it, hotspots first, before a rename or signature change. |
| `complex_check(files?, base?)` | Hotspots touched and partners missed by a change; tests to run. |
| `complex_refresh()` | The table recomputed live from git; flags a stale `commit`. |

Registered in `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor) and
`.codex/config.toml` (Codex) where those tools are present.

### Diff check

`npx complex-md check [--staged | --base ref] [--strict]`
is the same report on the command line, for pre-commit hooks and CI.

The block is normative: generators and hand authors copy it exactly, because
identical wording across repositories is what makes it recognizable to
agents and quotable by search. Canonical source:
[/integration.md](/integration.md).

```markdown
{{INTEGRATION_BLOCK}}
```

## FAQ

### How is this different from AGENTS.md or CLAUDE.md?

Those files carry
instructions and project context written by a person. COMPLEX.md carries
measurements and the instructions the measurements justify. They complement
each other; COMPLEX.md is referenced from them, not a replacement for them.

### How is this different from DESIGN.md?

DESIGN.md records intent at design
time. COMPLEX.md records reality as of a commit: where change actually
concentrates. Intent and reality diverge, which is exactly what an agent needs
to know.

### Why weighted churn and not just churn?

Because a flat window treats the
newest commit and the oldest one in the window identically, and the best
fault model in the literature does not: a change's contribution decays. 0.3
measures the decay in commits rather than years, so a repository that ships
twenty times a day is not read as if every commit were last week's. Raw
`churn` stays in the row so the number a human quotes ("234 of the last
2,000 commits") is still there.

### Why keep lines of code in the score at all?

The evidence is split. Once
change counts are known, size adds little in some studies and stays
significant in others; among static metrics it is the only one that is not
redundant. It stays because the question COMPLEX.md answers is where an edit
does the most damage, which scales with how much code the edit lands in, and
it is guarded: it enters as a logarithm, and rankable kinds only.

### Why are authors in the table?

Ownership is the strongest signal 0.1
missed: the count of low-ownership contributors predicted defects better
than churn or size in the Windows studies and survives controlling for both.
It is in the columns and the prose, not in the score, because open source
replications are mixed. On a single-committer repository the columns carry
nothing, the profile says so, and the prose leaves ownership alone.

### Why does a file with four commits outrank one with ninety-five?

Because 46 files import it. Ranked by churn times size alone, the shared
database module of a large repository ranks twentieth behind a 4,000 line
stylesheet. Churn says where edits happen; the dependency graph says how far
a mistake travels. Both belong in the score, and structure is what lets the
map say something on a repository that was assembled last month and has no
history to speak of.

### Why a `fixes` column when churn is already there?

Because the two answer
different questions. Churn says where edits are risky; fixes says where bugs
live. Agents on SWE-bench spend about half their turns finding the file to
fix, and when they fail it is usually by choosing the wrong file among
nearby candidates. A ranked list of files by past fixes is the simplest
validated answer to that exact choice, it costs one `git log`, and every
number in it can be checked. Structural repository context of this kind is
the one intervention shown to lift agent success on SWE-bench across four
different agent frameworks (RepoGraph, 32.8 percent relative), and the
gain concentrates in file-level localization.

### Does the wiring block override my AGENTS.md?

No, and it does not try
to. Models do not resolve conflicts by declared precedence. The block adds
four triggers tied to named files and situations; your existing
instructions stand.

### How often should it be regenerated?

When it stops matching reality. A
practical rule: regenerate after any refactor of a listed hotspot, or monthly
on an active repo. The `commit` field makes staleness visible, and the
weighted churn makes an old hotspot fall off the table by itself.

### Why cap the tables and the prose?

Because the file is read inside an
agent's context window, and because a risk flag on every file is a flag on
none. Google's deployment of bug prediction to code review found exactly
that: an algorithm that flags too much loses all impact.

### Does the whole repo get sent to a model?

No. The signals are computed
locally by git and grep. Only the signals table and the text of the top 5 to
10 hotspot files go into the model call, capped around 15k tokens.

### Can I write one for a repo I do not own?

Yes. The analysis needs only a clone: run the CLI or the skill inside it
and the file describes that repository as it stands.

## Older files

A file written to an earlier spec version remains valid input for any
agent and for the hooks and MCP server; generators emit the current
version, and the [changelog](https://github.com/KletoWorks/complex-md/blob/main/CHANGELOG.md)
records what changed between versions.
