<!-- meta
title: The complex-md skill
description: One markdown file you hand to any coding agent. The agent runs it inside your repository and writes a COMPLEX.md that follows the spec.
path: /skill
kicker: Skill for spec {{SPEC_VERSION}} &middot; prompt {{PROMPT_VERSION}} &middot; <a href="/complex-md.skill.md" download="complex-md.skill.md">download</a> &middot; <a href="https://github.com/KletoWorks/complex-md/tree/main/cli">CLI source</a>
-->

# The complex-md skill

The skill is one markdown file. You give it to a coding agent, the agent
runs it inside your repository, and out comes a [COMPLEX.md](/spec) that
follows the spec. It is the way to get the file when you cannot, or would
rather not, install anything.

Under the hood it does the same work as the command line tool. If Node.js is
on the machine it runs the tool; if not, it does the analysis with git alone.
Either way it uses the same instructions to write the file, so the result is
the same.

<p><a class="cta" href="/complex-md.skill.md" download>Download complex-md.skill.md</a></p>

## Install

**Claude Code.** Save the file as `.claude/skills/complex-md/SKILL.md` inside
your repository, or in `~/.claude/skills/` to have it in every repository.
Then ask: "generate COMPLEX.md".

**Cursor.** Save it as `.cursor/rules/complex-md.mdc`, or open the file in a
chat and tell the agent to follow it.

**Codex, or any other agent.** Paste the file into the conversation, or point
the agent at it: "follow complex-md.skill.md to generate COMPLEX.md".

## What the agent does with it

1. Looks at every file in the repository and sorts out which ones are code,
   configuration, pages and styles (the ones that can be risky) and which are
   tests, docs, data and generated files (the ones that cannot).
2. Works out which files depend on which, by reading imports, script tags,
   stylesheet links and file paths in scripts. A file that many others depend
   on can break a lot when it changes.
3. Reads the last 2,000 commits and counts, for every file, how often it
   changed, how often the change was a bug fix, how many people touched it,
   and which other files changed in the same commits.
4. Turns those numbers into a ranked list of the riskiest files, a list of
   the quiet files everything depends on, and the pairs of files that move
   together.
5. Writes COMPLEX.md: the numbers at the top, then a short explanation of
   each risky file that ends with one instruction to follow before editing
   it.
6. Connects the file to your agents: a short note in AGENTS.md or CLAUDE.md,
   rules that switch on when a risky file is opened, and, where the agent
   supports it, a hook that pauses the first edit of a risky file until the
   agent has read why it is risky.

Everything runs on your machine, inside the agent's shell. Nothing is
uploaded anywhere. The exact signals, formulas and rules are in the
[spec](/spec).

## Versioning

The skill contains the same generation instructions the command line tool
uses, so the two never drift apart. The version of those instructions and
the version of the spec are stamped in the file you download, and in the
header of every COMPLEX.md it produces.
