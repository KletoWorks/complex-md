# Research: what MBSE has already learned, and what COMPLEX.md should take from it

Date: 2026-09-25. COMPLEX.md is a model of a system, computed from evidence,
read by an automated agent that then changes the system. Model based systems
engineering has been doing exactly that for two decades, for aircraft,
satellites and embedded controllers, and has already paid for the mistakes.
This document maps what that field concluded onto what this project should
build next.

**Source status, stated plainly.** The four items below come from a weekly
MBSE brief dated 2026-09-25, which is a secondary summary. The primary
sources have NOT been read for this document. Claims are tagged:

- **brief**: as reported by the summary, not independently checked.
- **local**: observed in this repository or in a repository it maps, and
  therefore first hand.
- **derived**: this project's inference from the two above, and the part most
  likely to be wrong.

Nothing here should be cited as a finding from the primary literature until
someone reads it. Before building item 1, read Dempsey and Wrage
(DOI 10.58012/4c2e-xd64); before item 2, read Campioli et al, Aerospace
Science and Technology, September 2026.

## The one lesson the field converged on

**brief:** the closing line of the 2026-09-25 brief is that textual modeling,
concurrent engineering and executable behaviour "are valuable only when model
semantics and engineering evidence remain authoritative."

**derived:** that is this project's existing thesis, arrived at by a different
road. COMPLEX.md is computed from the dependency graph and the commit history
rather than written from memory, which is the same commitment: the artefact is
only worth reading because its content is evidence rather than recollection.
The strategic value is that MBSE spent twenty years discovering this, at real
cost, on systems where being wrong kills people. The argument does not need to
be made from scratch. It needs to be inherited.

What follows is four capabilities, each the codebase analogue of something the
field already has, ordered by how much they are worth against how hard they
are.

## 1. Consequence analysis. The AADL lesson.

**brief:** SEI's AI augmented AADL work defines a division of labour. AI drafts
architecture text, the language server enforces syntax and typing, analysis
tools compute engineering consequences, and the engineer keeps intent and
evidence. The brief contrasts this with SysML, which can trace a requirement to
a component but cannot rigorously answer sensor to actuator latency, processor
allocation or bus capacity.

**local:** complex-md has three of those four parts. A model drafts the prose,
the schema and the spec version test enforce the shape, and the person keeps
intent. The missing part is the one that computes consequences. Today the map
says `src/lib/types.ts` has `fan_in 31` and `tests 0`, and the paragraph says
to check the dependents. It does not say what changing it costs.

**derived:** this is the gap that separates a map from a tool, and the graph
to answer it is already built. Blast radius is reachable from data in hand:
how many modules a change reaches transitively, how many of those are
themselves hotspots, how many are covered by a test, and which co-change
partners the edit has left untouched. `check` already computes the last of
those for a diff, so the mechanism exists and is under-used.

The honest risk: transitive fan-in inflates fast and a number nobody believes
is worse than no number. The discipline the AADL comparison implies is that an
analysis has to answer a question an engineer actually asks. "This reaches 31
modules" is trivia. "This reaches 31 modules, 0 of them covered by a test, 3 of
them hotspots" is a decision.

## 2. Federated maps. The concurrent engineering lesson.

**brief:** the SmallSat methodology runs concurrent engineering sessions
against one authoritative system model with a modular toolchain, so that
structures, power, thermal and software can mature simultaneously without
becoming disconnected spreadsheets and incompatible assumptions.

**local:** this repository's own parent has the problem in its purest form.
`personal-platform/COMPLEX.md` opens by stating that six submodules are not
covered by it at all, and on 2026-09-25 each of those repositories was given
its own map by hand. Six authoritative models, none of which can see the
others, and the real coupling runs between them: a route in the API repository
and the client that calls it move together and neither map knows.

**derived:** the analogue is a map that spans repository boundaries, with a
per-repository adapter, so cross-repository fan-in and co-change become
visible. Every monorepo and every polyrepo shop has this. It is the widest
audience of the four and the hardest plumbing, because commit histories do not
share identity across repositories and the pairing has to be inferred.

## 3. Executable maps. The model execution lesson.

**brief:** a headless SysML v2 execution loop where changing an attribute or a
guard immediately changes observed behaviour, as the foundation for
model in the loop testing. The brief flags it as an expert demonstration
rather than peer reviewed validation.

**local:** `bench/` already exists and asks the falsifiable question: does the
map get an agent to the right file in fewer tool calls, on real fix history,
with paired arms. Its results are not published per release and are not the
headline anywhere.

**derived:** this is the cheapest of the four because the machinery is built.
The change is editorial and procedural rather than technical: every release
publishes what the benchmark measured, so the map's claims are continuously
falsifiable in public. For a project whose entire argument is that evidence
beats recollection, not publishing its own evidence is the loudest possible
omission.

## 4. A decision engine in the hook. Speed as an enabler.

**local:** the PreToolUse hook fires on every edit and has a latency budget of
milliseconds, so it can only do lookups: is this path listed, does it have an
untouched partner. It cannot ask whether THIS edit is the kind the paragraph
warns about, because a model call would add seconds to every edit.

**brief and unverified:** Laya (github.com/NandhaKishorM/laya, Apache 2.0, 421M
ModernBERT) is a non autoregressive decision engine returning typed choice,
score and yes/no answers in a single forward pass, reported at 32.8 ms p50
against a proprietary comparator's 236 to 276 ms, with higher accuracy on
typed decisions. Reported figures, not measured here.

**derived:** the shape fits the gap exactly, and it fits this project's
existing stance: local, no key, nothing uploaded. It would let the hook make a
judgement rather than a lookup. It is also the newest and least proven item
here, it adds a 421M model as a dependency to a tool that currently has almost
none, and it must never become required. If it is adopted it is an optional
accelerator behind the same interface the lookups use.

## Order, and why

1. **Consequence analysis.** Highest value per unit of work, builds only on
   data already computed, and it is the item that changes what the tool IS.
2. **Executable maps.** Nearly free, and it is the strongest adoption argument
   available: a project that publishes evidence against itself every release.
3. **Federated maps.** Widest audience, hardest plumbing, and this workspace
   is a live test case with six repositories already mapped separately.
4. **Laya in the hook.** Optional, last, and only after 1 makes the hook worth
   consulting in the first place.

## What would falsify any of this

`bench/` is the instrument. Each item states a claim the benchmark can test:
does consequence analysis reduce the number of files an agent opens before it
finds the right one; does a federated map catch a cross repository partner a
single map misses; does a hook that judges rather than looks up produce fewer
ignored warnings. An item that cannot be phrased that way does not belong on
this list.
