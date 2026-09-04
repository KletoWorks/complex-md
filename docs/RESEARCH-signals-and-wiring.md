# Research: are the COMPLEX.md signals sound, and how does the file get priority?

Date: 2026-09-03. Spec 0.1 shipped with four signals chosen from general
knowledge of the defect-prediction literature; this document asks whether
those choices hold up against the primary sources, and what the 2026
research on coding agents says about how a secondary context file gets read
at all. Method: a research harness fetched 25 sources (38 extractions, 123
candidate claims) and put the top 25 claims through three-vote adversarial
verification; the automated pass completed 8 of the 25 panels, and the
remainder were assembled by hand from the harness journal. Every claim is
tagged with its verification status so nothing reads stronger than it is:

- **verified 3-0 / 2-1**: adversarial panel read the primary source and kept it.
- **refuted**: panel killed the claim as written (the primary finding may
  still stand; what died is the inference drawn from it).
- **unverified**: the extractor read the primary source and quoted it, but
  the panel never voted. Treat as one careful reading, not a consensus.

Spec 0.2 is the result. Section 5 lists what changed and why.

## 1. Verdicts on the four 0.1 signals

### 1.1 Churn (commits per file, 12 months): SUPPORTED, strongly

The change-history family is the best validated defect predictor in the
literature, across four decades and every scale studied.

- A module's expected fault count is roughly proportional to the number of
  times it has been changed, and change count beats length as a predictor
  [G00]. verified 3-0.
- 722,471 commits across 700 GitHub projects: process metrics (churn, lines
  added and deleted, developer counts) reach median recall 98% and AUC 95%,
  versus 44% and 54% for size and complexity metrics; file-level prediction is
  significantly better than package-level [MMM22]. verified 3-0.
- Churn and dependency measures are efficient predictors of post-release
  failures in Windows Server 2003 [NB07]. verified 3-0.

Two refinements the same sources demand, both adopted in 0.2:

**Recency.** The best model Graves et al. found is a "weighted time damp"
where each change contributes fault potential that decays about 50% per year
[G00], verified 3-0. Google's deployed Time-Weighted Risk used a steeper
decay where commits older than six to eight months become inconsequential,
and developers explicitly said they care about files causing problems now,
not files with old debt [LR13], unverified. Time since last change is one of
the two most important features in a just-in-time defect model, beating
Kamei's full ten-feature set with only size before change plus recency
[JIT21], unverified. A flat 12-month count treats a commit from last week and
one from eleven months ago identically; the evidence says it should not.

**No single formula is "the" proven one.** Metric-importance rankings from
small studies are unstable at scale, and ensembles beat any fixed weighting
[MMM22], verified 3-0. The spec should present the score as a ranking
heuristic over transparent columns, not as an empirical law.

### 1.2 Lines of code as the multiplier (score = churn x loc): CONTESTED, kept with a floor

This is where the evidence is genuinely split, and where the adversarial
panel earned its keep.

Against the size term:

- Once change counts are accounted for, LOC adds no predictive value for
  future faults in the studied system, and complexity metrics are so
  correlated with LOC that they add nothing either [G00]. verified 2-1; the
  dissenting voter noted the authors scope this to "within our data set" (one
  telephone switching subsystem).
- Adding product metrics (including LOC variants) to process metrics gave no
  improvement over process metrics alone in any of the 700-project
  comparisons [MMM22]. verified 3-0.
- Absolute churn measures explain almost no variance in defect density
  (R^2 = 0.052) while relative measures, chiefly churned LOC / total LOC,
  reach R^2 = 0.811 [NB05]. verified 3-0 as a statement about the paper.

For the size term:

- The panel **refuted (1-2)** the inference that [NB05] indicts churn x loc.
  Nagappan and Ball predict defect *density* (defects per KLOC), which is
  already size-normalized, so relative predictors necessarily win for that
  response. COMPLEX.md ranks files by expected *total* risk, closer to a
  fault count, and for counts the counter-sources hold: LOC stays a
  significant predictor alongside change history in negative binomial models
  across two industrial systems, with the top 20% of files by predicted
  faults holding about 83% of faults [OWB05]. This counter-source was
  surfaced by the verifiers, not the extractors.
- Size before the change (LT) was one of the two most important JIT features
  [JIT21]. unverified.
- Among static metrics, size is the only one with unique validity; every
  other product metric's apparent validity is predicted by its correlation
  with size (R^2 up to 0.97) [GL17], and after controlling for size no
  object-oriented metric remains associated with fault-proneness [EE01].
  unverified. This cuts both ways: it says LOC is the one product metric
  worth carrying, and that adding cyclomatic complexity or similar would be
  redundant.
- LOC correlates with faults only weakly to moderately on its own (Spearman
  0.25 to 0.39) and the size effect is system-dependent [SE18]. unverified.

Verdict: churn carries the signal; LOC is a secondary term with real but
disputed support for count-style ranking. 0.2 keeps churn x loc (with churn
recency-weighted) because the agent use case is "where does an edit do the
most damage", which scales with size, and because Tornhill's shape is what
practitioners recognize. Two guards are added: a hotspot needs at least three
commits in the window (size alone never makes the table, per [G00] and
[MMM22]), and the ranking scope is source files, because on a real run
(fastify, 2026-09-03) the unscoped top five were two docs pages, two test
files and package.json.

### 1.3 Co-change pairs: SUPPORTED as coupling awareness, WEAK as a risk predictor

- The number of other modules typically changed together with a module did
  not improve fault prediction, contrary to the authors' expectation [G00].
  verified 3-0. The panel added the qualifier that change coupling does
  correlate with defects on three large systems, more than complexity
  metrics do [DLR09], so the field-level picture is mixed rather than null.
- Two industrial systems, seven years, 176k files: evolutionary coupling
  correlates positively with defects overall (each additional coupling makes
  a module 8% more likely to be defective), but the strength varies by
  module, disappears for small low-collaboration areas, and the literature is
  openly contradictory (Knab et al. found no effect in Mozilla) [K17].
  unverified.
- Co-change entropy adds a statistically significant but modest 2 to 3%
  AUROC gain on top of churn metrics, and does not beat change entropy as a
  substitute [CCE25]. unverified.
- Established methodology excludes commits touching more than 30 files as
  noise when mining co-change [CCE25]. unverified, but this is a widely
  shared convention and it fixed visible noise on the fastify run (release
  commits pairing fastify.js with package.json 21 times).

Verdict: keep co-change, frame it as "what to update in tandem", never as
"where bugs are". 0.2 adds the 30-file exclusion and drops manifests,
lockfiles, CI config and tests from pair mining. The wiring rule softens from
"update its partner in the same change" to "open its partner and state
whether it needed a change", because coupling by decay should be broken, not
obeyed.

### 1.4 Fan-in (import count): WEAK as a defect signal, valid as blast radius

- Dependency measures between binaries predicted post-release failures
  alongside churn [NB07]. verified 3-0, but that is architectural dependency
  at binary granularity, not a grep for imports.
- Fan-in explained little fault variance (R^2 0.05 to 0.18) where fan-out
  explained 0.42 to 0.46 on the same systems [SE18]. unverified.
- Coupling metrics vanish after controlling for size [EE01]. unverified.
- Aider, the most widely deployed computed repo context, ranks files by
  PageRank over the dependency graph, i.e. uses centrality as the relevance
  signal for what to show the model [AID]. unverified, vendor documentation.

Verdict: fan-in is not evidence that a file is buggy; it is evidence that an
edit there propagates, which is exactly the "read before you touch" use.
0.2 keeps the column, rewrites its description to say blast radius, and
stops implying risk. Fan-out is a stronger fault correlate and is cheap; it
is deferred to 0.3 rather than added now, to hold the row width.

## 2. Signals 0.1 was missing

Ranked by evidence strength. The first is adopted; the rest are deferred.

**Code ownership (adopted as `authors` and `owner_share`).** The number of
minor contributors (under 5% of a component's commits) correlated more
strongly with defects than churn, size or complexity in Windows Vista and 7
(Spearman 0.86 and 0.93 versus 0.72 and 0.75), added 20 points of explained
variance on top of size + churn + complexity, and the effect survives
controlling for exactly the metrics 0.1 uses; the measures are cheap to
compute from commit history alone [B11]. unverified, primary FSE 2011 paper
read in full. Replicated in Qt and OpenStack with review awareness, where
the proportion of developers lacking both authoring and reviewing expertise
carries most of the explanatory power [T16]. unverified. Marginal owners
(under 10% of touches) take 45% to 93% longer to resolve issues in
low-quality code across 40 proprietary projects [BT23]. unverified.
Caveats the same sources carry: Graves found no developer-count effect
[G00], and a replication on Apache and Eclipse found no file-level
ownership-defect correlation [BT23, citing Foucault et al.], so ownership is
context-dependent and belongs in the columns and the prose, not in the
score. The MINOR count needs many commits per unit to be meaningful; at file
granularity with a dozen commits, every author is "major". 0.2 therefore
records `authors` (distinct committers in the window) and `owner_share`
(the top author's share of commits), which the prose turns into two
recognizable risks: knowledge concentrated in one head, or diffuse ownership
with nobody's.

**Fan-out (deferred).** Stronger fault correlate than fan-in [SE18]; cheap.
Deferred to keep rows narrow; revisit with catalog data.

**Complexity trend (rejected for now).** Absolute complexity is redundant
with LOC [EE01, GL17, G00]. Trend over time is Tornhill's practice but no
fetched source validated it independently of churn.

**Test-coverage gaps (not researched).** No source in the fetch set. The
prose already says "where the test suite is thin" when the file text shows
it; leave that to the model.

## 3. How agents actually consume context files

This is the part of the research that changes the file most, and it is
recent (2025 and 2026).

- Context files do not generally improve task success and cost over 20%
  more inference; LLM-generated ones reduced success by 2 to 3% while
  developer-written ones gained about 4%, not significant [ETH26]. Meanwhile
  **specific instructions are well followed** (a mentioned tool is used
  1.6 times per instance versus under 0.01 when not mentioned) and
  **repository overviews are not helpful** despite being recommended by every
  model provider: agents just do more reads and searches [ETH26].
  unverified, primary arXiv 2602.11988 read in full, corroborated by two
  secondary writeups [TDB26, AD26].
- Presence is what matters, structure is not: with no configuration file,
  0 of 524 functions followed a rule; with one, 67.7%. File size from 25 to
  500 lines, instruction position, single versus multi-file, even a
  contradicting instruction elsewhere: none moved compliance detectably, and
  the size and conflict nulls have affirmative Bayes factors [McM26].
  unverified, primary read in full.
- Compliance decays inside a session (5.6% lower odds per additional
  function generated) and is far lower when **editing existing code (45%)
  than writing new code (71%)** [McM26]. unverified. COMPLEX.md's entire use
  case is editing existing hot code deep into a session, so this is the
  hostile regime.
- A long standing document in context is not treated as persistent
  authority; its influence decays across turns and tool calls, the best
  frontier configuration passes 36% of trials, failures are usually a single
  missed requirement rather than wholesale ignoring, and agents confidently
  report compliance while citing the sections they violated. The authors
  recommend deterministic enforcement outside the model for anything
  critical [HB26]. unverified, primary read in full.
- Claude Code wraps CLAUDE.md content in a reminder that it "may or may not
  be relevant", so the model skips instructions it judges inapplicable
  [HL25]. unverified, practitioner source. Instructions therefore have to
  name the files they apply to, so applicability is obvious.
- Google's deployment of bug prediction to code review changed nothing
  measurable in developer behavior; developers ignored flags with no
  actionable remediation, discounted opaque scores as false positives,
  preferred the simple explainable ranking, and an algorithm that flags too
  much loses all impact [LR13]. unverified, primary read in full.

What this means for the file:

1. **Descriptive prose is the weak part; directives are the strong part.**
   "Why these files are hot" as a description of each file is the kind of
   repository overview the evidence says agents do not benefit from. Each
   hotspot paragraph must end with an instruction an agent can execute
   before or during the edit. Adopted in 0.2.
2. **Selectivity is confirmed, not just aesthetic.** Fifteen rows is
   consistent with Google's finding on over-flagging and with Aider's
   1k-token default map [AID]. Kept.
3. **Reasons must be visible.** Every row carries its raw numbers so the
   ranking is never opaque. Kept; `churn` stays next to `churn_w`.
4. **Format (YAML versus prose) has no direct evidence either way.**
   [McM26] found structure irrelevant to compliance and Anthropic states
   there is no required format [ANTH]. The front matter stays because it is
   the machine-readable half and it makes the numbers quotable.

## 4. Priority wiring: what makes a secondary file get followed

Design rule (2026-09-03): generating a COMPLEX.md is consent to wire it
into the repository's agent files, automatically, and the wiring must be
whatever produces the most meaningful change. The evidence on mechanism:

- **Referencing from the primary file is the sanctioned pattern** [ANTH],
  and an `@AGENTS.md` import in CLAUDE.md transmits a secondary file's
  instructions with no measurable loss (+0.5 pp, p = 0.918) [McM26].
  unverified, primary. So an `@COMPLEX.md` import line in CLAUDE.md puts the
  whole map in context at launch with proven fidelity, at roughly 1.2k
  tokens.
- **"Priority" language does not override anything.** A directly
  contradicting instruction in the imported file produced no compliance
  penalty either way (63.7% versus 64.1%) [McM26]. The model does not
  resolve conflicts by declared precedence, so the block should not spend
  words claiming authority; it should spend them on concrete triggers.
- **Emphasis markers: untested in studies, endorsed by the vendor for one
  line.** No study has tested IMPORTANT or YOU MUST phrasing [AD26], and the
  first draft of 0.2 dropped them on that basis. That was a misread of the
  evidence: Anthropic's own best-practices page says "If Claude keeps
  skipping one instruction, add emphasis such as IMPORTANT to that line
  alone. If you emphasize many lines, none of them stands out" [CCBP].
  Corrected in the second pass (section 7): the block carries exactly one
  emphasized line, on the rule that makes the map worth reading.
- **Fewer rules, higher full compliance.** Relaxing grading by one criterion
  roughly doubles pass rates [HB26], meaning each additional independent
  rule is a new place to fail. The block went from four rules to three plus
  one non-numbered note; the second pass added a fourth, single-sentence
  rule for bug localization because that rule has the strongest evidence of
  any in the block (section 7).
- **Path scoping counters the two worst findings.** Compliance is worst when
  editing existing code late in a session [McM26], and standing documents
  decay with distance [HB26]. Both Claude Code and Cursor support rules that
  load only when a matching file is touched: Claude Code `.claude/rules/*.md`
  with `alwaysApply: false` and a single unquoted comma-separated `paths:`
  line (the documented YAML-array form is broken in three open issues)
  [CCMEM, CC17204]; Cursor `.cursor/rules/*.mdc` with `globs:` and
  `alwaysApply: false` [CUR]. A rule whose `paths` are the hotspot files
  themselves re-injects the three directives at the exact moment an agent
  opens a hotspot, which is the just-in-time reminder the decay findings
  call for. Adopted in 0.2 as part of Stage 3.
- **Tool coverage.** Claude Code reads CLAUDE.md, not AGENTS.md (feature
  request open since 2025) [AD26]; Codex and Cursor read AGENTS.md; Gemini
  reads GEMINI.md; Copilot reads `.github/copilot-instructions.md`. The
  block goes to every one that exists, unchanged from 0.1.
- **Deterministic enforcement (deferred to 0.3).** [HB26] is explicit that
  hooks beat in-context policy for hard constraints. A Claude Code
  PreToolUse hook on Edit/Write matching hotspot paths could refuse or warn.
  Installing hooks edits `.claude/settings.json`, which is a larger consent
  than appending to a markdown file; not automated yet.

## 5. Spec 0.2 changes, ranked by evidence strength

| # | Change | Evidence | Status |
| --- | --- | --- | --- |
| 1 | Hotspot paragraphs end with an executable directive; the file stops being an overview | ETH26, LR13, McM26 | adopted |
| 2 | Recency-weighted churn (`churn_w`, one-year half-life) drives the score; raw `churn` kept visible | G00 3-0, LR13, JIT21 | adopted |
| 3 | Wiring: `@COMPLEX.md` import in CLAUDE.md; path-scoped rules for Claude Code, Cursor and OpenHands keyed to hotspot paths; four single-sentence rules, one emphasized line | McM26, HB26, ANTH, CCBP, CCMEM, CUR, OH | adopted (revised, section 7) |
| 3b | `fixes` column (bug-fix commits per file) and a localization rule: when a bug's file is unknown, check high-`fixes` hotspots before searching | K07, RD11, LR13, SH26, RG24, UCA25 | adopted (section 7) |
| 4 | Ownership columns `authors`, `owner_share`; prose names concentrated or diffuse ownership | B11, T16, BT23 | adopted |
| 5 | Hotspot floor of three commits; source-only ranking scope | G00, MMM22, fastify run | adopted |
| 6 | Co-change: exclude commits over 30 files, manifests, lockfiles, CI, tests; rule says "open the partner", not "change it" | CCE25, G00, K17 | adopted |
| 7 | Fan-in described as blast radius, not risk | SE18, EE01 | adopted |
| 8 | Fan-out column | SE18 | deferred to 0.3 |
| 9 | PreToolUse gate and Stop check hooks; MCP server for mid-task queries | HB26, McM26, RG24, CCBP | adopted (section 7.5, CLI 0.2.1) |
| 10 | Measure it: catalog A/B of agent behavior with and without the file | ETH26's own recommendation | open, needs phase C |

Things 0.1 claimed that the spec no longer says: that churn x loc is "the"
method; that fan-in "means" risk; that co-change partners must change
together; that the block's numbers are "ground truth".

## 6. What this research could not settle

- No source measured a computed risk map against agent outcomes. [ETH26]
  measured hand-written and LLM-written context files, and found overviews
  useless and instructions useful; COMPLEX.md 0.2 is designed to be the
  second kind, but that is a design inference, not a result. The catalog
  (phase C) is the place to measure it.
- The size term remains disputed at the level of the primary literature.
  0.2 keeps it with guards; if catalog data shows size dominating rankings
  in a way that does not match where agents break things, drop it.
- Ownership evidence is Microsoft- and industrial-heavy; open source
  replications are mixed. It is in the columns, not the score, for that
  reason.

## 7. Second pass: Hugging Face papers, localization, and community practice

Date: 2026-09-03, same day. The first synthesis drew on the academic
literature and the vendors' documentation but never searched the practice
corpus directly: the papers and community artifacts on Hugging Face where
practitioners publish what measurably improves agent effectiveness. This
pass did, and it changed the file.

### 7.1 What Hugging Face actually has

Not community prompt threads. Hugging Face's own repositories use a plain
`AGENTS.md` with a `CLAUDE.md` symlink [HFH], and the community posts about
context files are generic. What Hugging Face hosts that matters is the
papers, and they are the strongest evidence in this whole document that
structural repository context helps coding agents:

- **RepoGraph** (HF paper 2410.14684, ICLR 2025). A plug-in repository
  structure, plugged into four different SWE-bench frameworks (RAG,
  Agentless, AutoCodeRover, SWE-agent), lifted resolve rate in every
  combination, average 32.8% relative. The gain is largest at **file-level
  localization** ("integrating RepoGraph with all baseline methods
  significantly improves file-level accuracy, whereas the enhancement at
  line-level is comparatively modest"), larger for procedural
  localize-then-edit frameworks than for free-form agents, and it costs
  extra tokens on agents [RG24]. primary, read in part.
- **CodexGraph** (HF paper 2408.03910, NAACL 2025) and **LocAgent**: the
  same finding with graph databases and heterogeneous code graphs [CG24].
  primary abstract only.

The lesson is not that COMPLEX.md should be a code graph; RepoGraph's graph
is queried per search term at runtime, and the tools already build their
own. The lesson is which part of the agent's job structural context
improves: choosing the right file. That is where the rest of this section
goes.

### 7.2 Localization is the measurable bottleneck

- Across 5 LLMs and 2 agent frameworks on SWE-bench, agents spend on average
  **18.5 turns, 48% of total interaction, over 320k tokens per instance,
  locating the fault before their first patch**. "This makes localization
  both a performance bottleneck and a dominant compute cost" [SH26].
  primary, read in part.
- When the best localizer fails, 40% of failures are the model viewing the
  right file and picking another, and 27% are the right directory, wrong
  file: **67% of failures are choosing wrongly among nearby candidates**,
  not failing to reach the area. Only 4% are genuinely multi-file [SH26].
- On SWE-bench Verified, failed patches hit the gold file only 59 to 63% of
  the time versus about 80% on Lite; "there remains significant room for
  improvement in file-level localisation, which is a bottleneck for a
  successful outcome" [UCA25]. primary, read in part.
- SHERLOC's design independently matches two 0.2 decisions. Its initial
  prompt is a **filtered repository tree** that removes docs, build
  artifacts, dependency folders and VCS metadata, "giving the model a global
  map of the project without loading source" (our ranking scope). And it
  reports each location as a **structured finding: location explanation,
  root cause, solution idea, dependencies, testing impact**, concluding that
  "structured diagnostic output, not just location retrieval, is the
  operative unit of useful localization" [SH26]. Our hotspot paragraph
  (what it does, why it changes, what it breaks, which tests cover it, what
  to do first) is that finding, precomputed.

### 7.3 A cheap, validated prior on where fixes land

- FixCache (Kim et al., ICSE 2007, Distinguished Paper): a cache of 10% of
  files, updated on each bug fix using temporal, spatial and churn
  locality, contains the file of **73 to 95% of future fixes** at file
  granularity across seven open source projects [K07]. secondary
  restatement in RD11 and LR13, both read.
- Rahman, Posnett, Hindle, Barr, Devanbu (2011): for inspection, **ranking
  files by their count of past closed bug fixes performs about as well as
  FixCache**, and re-implementations of FixCache hit roughly 60 to 80% at
  file granularity [RD11]. primary, read in part.
- Google chose that simple ranking ("the Rahman algorithm") for its
  deployment because it was as accurate and explainable, and developers
  found FixCache's lists less intuitive [LR13]. primary, read in full
  (section 3). The `bugspots` tool that many teams run is Rahman's
  algorithm with recency weighting [FLF18].
- Cost: one `git log --grep` over the same commit stream churn already
  uses. Validated on fastify/fastify: a fix regex over commit messages
  (`fix|fixes|fixed|fixing|bug|bugfix|hotfix|regression`, whole word, case
  insensitive) labels 112 of 338 commits in twelve months; `fastify.js` 12,
  `lib/request.js` 10, `lib/reply.js` 10, `lib/route.js` 8, `fastify.d.ts`
  6. Matching issue references (`#123`) as well labels 311 of 338, because
  squash merges put the PR number in every subject; excluded for that
  reason.

Putting 7.2 and 7.3 together is the efficiency argument the first synthesis
lacked. Agents burn half their budget choosing among candidate files; the
failures are choices among nearby candidates; a ranked list of the files
where fixes have landed is a validated tie-breaker for exactly that choice;
and it costs nothing to compute. Adopted: a `fixes` column, a sentence in
"Where the risk lives" naming where fixes land, and a fourth rule in the
block: "Fixing a bug whose location you do not yet know, check the
`hotspots` rows with the highest `fixes` count before searching the whole
repository." This is a design inference from three independent results, not
a measured outcome for COMPLEX.md itself; the catalog A/B (row 10) is still
where that gets measured.

### 7.4 Community practice: what the large collections converge on

awesome-cursorrules (38.7k stars), cursor.directory, and the 2026 CLAUDE.md
guides [OB26, SD26, IH26, CCBP] are anecdotal, but they converge, and
where they converge they agree with the studies:

- Specific and verifiable beats aspirational; "lead with the verb, then the
  constraint" [SD26]. The block does this.
- Co-locate the rule with the failure mode it prevents [SD26]. Each hotspot
  paragraph states what an edit breaks, then the instruction.
- One file per concern, glob-scoped, always-on rules kept tiny; critical
  instructions in the middle of long files get ignored [OB26, AX26]. Path
  scoping adopted; the block is 19 lines.
- Emphasis on one line only [CCBP]; see section 4 correction.
- OpenHands has moved to `AGENTS.md` plus `.agents/skills/*.md`, and a
  skill with `paths:` frontmatter is a deterministic, zero-baseline-cost
  path-triggered rule injected once when a matching file is touched [OH].
  Adopted as Stage 3 step 5.

Practitioner anecdotes that instruction files are ignored [HN25] are about
the same failure the studies describe: long files, vague rules, and rules
that should be hooks. None of them is evidence against a short, path-scoped
block of concrete triggers, which is what the research recommends and what
0.2 ships.

### 7.5 What shipped from the second pass beyond the file: enforcement and runtime

Two findings above set a ceiling on any in-context design: compliance near
45% when editing existing code [McM26], and standing documents losing
influence across turns with the authors recommending deterministic
enforcement for anything critical [HB26]. The two mechanisms that break
that ceiling shipped the same day in the `complex-md` CLI (row 9 of section
5 moves from deferred to adopted):

- **Hooks.** Claude Code `PreToolUse` denies the first edit of a hotspot per
  session and returns the paragraph as the reason; `Stop` refuses the turn
  once with the diff report (hotspots touched, partners untouched with
  counts, tests to run). Cursor equivalents via `preToolUse` and `stop`.
  Rule 1 and rule 2 of the block are now enforced, not requested. Anthropic's
  own guidance says the same: for anything that must happen, use a hook, not
  prose [CCBP, SD26].
- **MCP server.** Five tools (`complex_lookup`, `complex_where_to_look`,
  `complex_impact`, `complex_check`, `complex_refresh`) so the agent queries
  the map mid-task. This is the RepoGraph shape [RG24], structure queried
  during localization, built from history at file level rather than from an
  AST at line level. `where_to_look` ranks by `fixes` and re-ranks by report
  keywords; on fastify with the keyword "trustProxy" it puts `lib/request.js`
  first, where the recent trustProxy fix landed.

Both are inferences from mechanism, like everything else in this document
that is not a cited measurement. The catalog A/B remains the place to
measure them, now with a fourth arm: file only, file plus hooks, file plus
MCP, all three.

### 7.6 Honest limits of this pass

- No Hugging Face paper evaluates a static markdown map; they evaluate
  runtime graph tools. The transfer is by mechanism (file-level
  localization), not by direct measurement.
- The fix regex is a heuristic. Conventional-commit repos label cleanly;
  repos with terse subjects will undercount. The raw number is in the row
  so a reader can judge it.
- The emphasis line is vendor guidance, not a study, and it is Claude
  specific. It is one word; the cost of being wrong is one word.

## Sources

Primary, peer reviewed:

- [G00] Graves, Karr, Marron, Siy. Predicting Fault Incidence Using Software Change History. IEEE TSE 26(7), 2000. https://cs.uwaterloo.ca/~m2nagapp/courses/CS846/1171/papers/graves_tse98.pdf
- [NB05] Nagappan, Ball. Use of Relative Code Churn Measures to Predict System Defect Density. ICSE 2005. https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icse05churn.pdf
- [NB07] Nagappan, Ball. Using Software Dependencies and Churn Metrics to Predict Field Failures. ESEM 2007. https://www.semanticscholar.org/paper/f2489eb626badda1c50f3aad1dd01ce44289ced2
- [OWB05] Ostrand, Weyuker, Bell. Predicting the Location and Number of Faults in Large Software Systems. IEEE TSE 31(4), 2005. https://dl.acm.org/doi/10.1109/TSE.2005.49
- [DLR09] D'Ambros, Lanza, Robbes. On the Relationship Between Change Coupling and Software Defects. WCRE 2009. https://www.inf.usi.ch/lanza/PUBS/P/DAmb2009e.pdf
- [B11] Bird, Nagappan, Murphy, Gall, Devanbu. Don't Touch My Code! Examining the Effects of Ownership on Software Quality. FSE 2011. https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/bird2011dtm.pdf
- [LR13] Lewis, Lin, Sadowski, Zhu, Whitehead. Does Bug Prediction Support Human Developers? Findings from a Google Case Study. ICSE 2013. https://research.google.com/pubs/archive/41145.pdf
- [T16] Thongtanunam, McIntosh, Hassan, Iida. Revisiting Code Ownership and Its Relationship with Software Quality in the Scope of Modern Code Review. ICSE 2016. https://dl.acm.org/doi/10.1145/2884781.2884852
- [K17] Kirbas et al. The relationship between evolutionary coupling and defects in large industrial software. JSEP 2017. https://dl.acm.org/doi/10.1002/smr.1842
- [EE01] El Emam, Benlarbi, Goel, Rai. The Confounding Effect of Class Size on the Validity of Object-Oriented Metrics. IEEE TSE 2001. https://www.semanticscholar.org/paper/eda92ba4a59676349f5954c2f529adc5ae608198
- [GL17] Gil, Lalouche. On the correlation between size and metric validity. EMSE 2017. https://link.springer.com/article/10.1007/s10664-017-9513-5
- [SE18] Revisiting the size effect in software fault prediction models. ESEM 2018, arXiv 2104.12349. https://arxiv.org/pdf/2104.12349
- [MMM22] Majumder, Mody, Menzies. Revisiting Process versus Product Metrics: a Large Scale Analysis. EMSE 2022, arXiv 2008.09569. https://arxiv.org/pdf/2008.09569
- [JIT21] Investigation of Dataset Features for Just-in-Time Defect Prediction. arXiv 2109.13634. https://arxiv.org/pdf/2109.13634
- [BT23] Borg, Tornhill et al. U Owns the Code That Changes: Marginal Owners Resolve Issues Slower in Low-Quality Code. arXiv 2304.11636. https://arxiv.org/pdf/2304.11636
- [CCE25] Co-Change Graph Entropy: A New Process Metric for Defect Prediction. arXiv 2504.18511. https://arxiv.org/pdf/2504.18511
- [ETH26] Gloaguen et al. Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? arXiv 2602.11988. https://arxiv.org/abs/2602.11988
- [McM26] McMillan. Instruction Adherence in Coding Agent Configuration Files: A Factorial Study of Four File-Structure Variables. arXiv 2605.10039. https://arxiv.org/pdf/2605.10039
- [HB26] HANDBOOK.md: A Benchmark for Long-Context Agentic Instruction Following. arXiv 2607.25398. https://arxiv.org/html/2607.25398v1
- [RG24] Ouyang, Yu, Zhang et al. RepoGraph: Enhancing AI Software Engineering with Repository-level Code Graph. ICLR 2025, arXiv 2410.14684. https://huggingface.co/papers/2410.14684
- [CG24] Liu et al. CodexGraph: Bridging Large Language Models and Code Repositories via Code Graph Databases. NAACL 2025, arXiv 2408.03910. https://huggingface.co/papers/2408.03910
- [SH26] SHERLOC: Structured Diagnostic Localization for Code Repair Agents. arXiv 2606.24820. https://arxiv.org/html/2606.24820v1
- [UCA25] Understanding Code Agent Behaviour: An Empirical Study of Success and Failure Trajectories. arXiv 2511.00197. https://arxiv.org/html/2511.00197
- [K07] Kim, Zimmermann, Whitehead, Zeller. Predicting Faults from Cached History. ICSE 2007. (as restated in RD11, LR13)
- [RD11] Rahman, Posnett, Hindle, Barr, Devanbu. BugCache for Inspections: Hit or Miss? ESEC/FSE 2011. https://earlbarr.com/publications/hitmiss.pdf
- [FLF18] Zou, Liang, Xiong, Ernst, Zhang. An Empirical Study of Fault Localization Families and Their Combinations. IEEE TSE, arXiv 1803.09939. https://arxiv.org/abs/1803.09939

Vendor documentation and practitioner sources:

- [CCBP] Claude Code docs. Best practices: write an effective CLAUDE.md. https://code.claude.com/docs/en/best-practices
- [OH] OpenHands docs. Agent Skills and Context: path-triggered rules. https://docs.openhands.dev/sdk/guides/skill
- [HFH] huggingface/huggingface_hub PR 4013: add CLAUDE.md symlink pointing to AGENTS.md. https://github.com/huggingface/huggingface_hub/pull/4013
- [OB26] OpenBooklet. Cursor Rules That Actually Work. https://openbooklet.com/blog/cursor-rules-that-work
- [AX26] Axonbuild. Cursor Rules Best Practices. https://axonbuild.com/blog/cursor-rules-best-practices/
- [SD26] Start Debugging. How to Write a CLAUDE.md That Actually Changes Model Behaviour. https://startdebugging.net/2026/04/how-to-write-a-claude-md-that-actually-changes-model-behaviour/
- [IH26] InventiveHQ. How to Write a CLAUDE.md File That Actually Works. https://inventivehq.com/blog/how-to-write-claude-md-file
- [HN25] Hacker News thread, Claude Advanced Tool Use (anecdotes on CLAUDE.md being ignored). https://news.ycombinator.com/item?id=46038047

- [ANTH] Anthropic. Using CLAUDE.md files. https://claude.com/blog/using-claude-md-files
- [CCMEM] Claude Code docs. How Claude remembers your project (rules, paths, imports). https://code.claude.com/docs/en/memory.md
- [CC17204] anthropics/claude-code issue 17204: rules frontmatter, paths CSV form works, YAML list does not. https://github.com/anthropics/claude-code/issues/17204
- [CUR] Cursor docs. Rules (`globs`, `alwaysApply`, `description`). https://cursor.com/docs/rules
- [AID] Aider. Repository map. https://aider.chat/docs/repomap.html
- [HL25] HumanLayer. Writing a good CLAUDE.md. https://www.humanlayer.dev/blog/writing-a-good-claude-md
- [AD26] Dunlop. CLAUDE.md Best Practices: What the Evidence Supports. https://www.alexdunlop.com/writing/claude-md-best-practices
- [TDB26] Do AGENTS.md/CLAUDE.md Files Help Coding Agents? https://todatabeyond.substack.com/p/do-agentsmdclaudemd-files-help-coding
- [ALT20] Altkom. Behavioral code analysis (Tornhill methodology summary). https://www.altkomsoftware.com/blog/how-to-intelligently-manage-your-technical-debt-with-behavioral-code-analysis/
