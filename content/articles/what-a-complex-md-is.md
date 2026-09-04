<!-- meta
title: What a COMPLEX.md is and why agents need one
description: Coding agents get instructions and project context, but no map of where changes are risky. COMPLEX.md is that map, computed from git history.
date: 2026-09-02
-->

# What a COMPLEX.md is and why agents need one

A coding agent arriving in your repository knows nothing about its history. It
can read every file, but it cannot see which files break when touched, which
pair of files always changes together, or which thousand line module has
absorbed a year of hotfixes. That knowledge lives in git history, and almost
nobody hands it to the agent.

COMPLEX.md is a markdown file at the repository root that carries exactly that
knowledge. It is computed, not remembered. YAML front matter holds the
numbers: lines of code, commit churn over the last twelve months weighted
toward recent commits, how many people touched each file and how much one
of them owns it, co-change pairs, fan-in, and a hotspot score. Four short
prose sections explain what the numbers mean and what to do about them:
where the risk lives, why the hot files are hot and what to check before
editing each one, what changes together, and what to read first.

## The gap in agent context files

The current agent context stack has three layers, and all of them are written
by a person from memory.

AGENTS.md tells the agent how to behave: run these tests, follow this commit
style, never touch that directory. CLAUDE.md tells the agent what the project
is and how it is laid out. DESIGN.md, where it exists, records what the
authors intended at design time.

None of these say where the danger is. A maintainer knows that `router.js` is
where regressions come from, that the schema and its serializer must move
together, that the test suite is thin exactly where the churn is thick. That
knowledge rarely gets written down, because to a human it feels obvious, and
when it is written down it goes stale, because nothing recomputes it.

An agent without that map does the natural thing: it greps, finds a plausible
place to edit, and edits. In a healthy file that is fine. In a hotspot it is
how a plausible looking change ships a regression.

## Why computed beats written

A hotspot is a file that is both large and currently changing. The score is
recency-weighted churn multiplied by lines of code, the shape of the method
Adam Tornhill describes in Your Code as a Crime Scene with the frequency
term decayed the way Graves et al. found fault potential decays: a commit's
weight halves every year. Change history is the best validated predictor of
where faults appear; forty years of defect-prediction studies agree on that
much, and disagree about most else. The score is a crude number and it is
reliably right about one thing: where the next change will happen and where
changes cost the most.

Because the signals come from `git log` and `git ls-files`, they have two
properties written context can never have. They are honest: nobody's memory
of the codebase is flattering the numbers. And they are reproducible: the
`commit` field in the front matter says exactly which state of the repo was
measured, so staleness is visible instead of silent.

The `fixes` column answers a different question from churn: not where edits
are risky but where bugs live. It counts the commits whose message says they
fixed something, and files fixed before are where the next fix lands; a
ranked list of them catches most future faults, and it is the bug predictor
Google chose for being as accurate as anything more elaborate and easy to
explain. This matters to agents in particular. Measured on SWE-bench, a
coding agent spends about half its turns on a bug just finding the file to
fix, and when it fails it is usually by picking the wrong file among nearby
candidates. A short list of where fixes have landed is the tie-breaker for
exactly that choice.

Co-change is the signal people underestimate. Two files that appear in the
same commits thirty times are coupled, whether or not any import connects
them. A schema and its serializer. A config file and the module that assumes
its shape. An API surface and its type declarations. The import graph cannot
see this; history can. An agent that knows the pairing opens both sides
before it changes one, and says whether the other needed to move.

## What the agent does differently

With COMPLEX.md in context, the agent's behavior changes in specific ways.
Asked to change routing, it reads the hotspot paragraph for the router before
editing, because the file is flagged and the paragraph ends with what to do
first: the test to run, the partner file to open, the contract to keep.
Planning a refactor, it starts from the score table instead of guessing.
Touching a file with a listed co-change partner, it opens the partner and
states whether it needed a change. Handed a bug report that does not name a
file, it checks the hotspots with the most fixes before searching the whole
tree. Entering the repo cold, it reads the short list under "What to read
first" instead of sampling files at random.

That last design choice comes from the 2026 research on context files, which
found that agents skim repository overviews and follow specific
instructions. So every hotspot paragraph in a COMPLEX.md is an instruction,
and the file is wired into your AGENTS.md or CLAUDE.md, and into a
path-scoped rule that fires when a hotspot is opened, by the same run that
generates it.

The file is deliberately small: at most fifteen hotspot rows, ten co-change
pairs, and under six hundred words of prose. It is read inside a context
window, where a map of everything is a map of nothing. Selective over
complete; bloat is the failure mode.

The [spec](/spec/) defines every field. The [skill](/skill/) generates the
file with any coding agent, locally, from your repo's own history.
