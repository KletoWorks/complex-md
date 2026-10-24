<!-- meta
title: Agents run the tests the map names
description: On two repositories with no shared tasks, agents ran the tests the map names on 14 of 15 risky edits, against 3 of 17 without it. One fastify fix shows what that looks like.
date: 2026-10-24
draft: true
-->

# Agents run the tests the map names

On two repositories with no shared tasks, agents ran the tests the map
names on 14 of 15 risky edits, against 3 of 17 without it (11 of 11
discordant pairs, p about 0.001). The agent was Claude Opus 5 in Claude
Code. This article shows one of those edits, then the count, then the
limits of the run.

## One fix, two agents

The task is a real fastify fix, commit `7299a57d3f`: "fix: clear trailer
state when removing all trailers". The prompt was the pull request's own
text. Each agent started from the fix's parent commit, in its own clean
worktree. One agent had the repository as it was. The other had a
COMPLEX.md for that month, wired into `CLAUDE.md`.

The fix belongs in `lib/reply.js`. The map's paragraph for that file says
that 38 of its 93 commits are fixes, and then it gives an instruction:

<blockquote><p>Before editing this file, run the <code>test/diagnostics-channel/*.test.js</code> suite that covers it</p></blockquote>

The agent with the map ran two searches and read `lib/reply.js` twice.
Its third shell command was this one:

```sh
node --test test/diagnostics-channel/*.test.js 2>&1 | tail -20
```

All 15 tests passed. The agent then made the fix, and it ran the suite
again before it finished. Its report says: "15/15 pass, both before the
edit (baseline, as COMPLEX.md requires for this file) and after."

The agent without the map tested a lot. It ran the trailer tests, the
hooks, stream and reply unit tests, and then this:

```sh
node --test --test-concurrency=4 test/*.test.js 2>&1 | tail -15
```

That run passed 1,646 tests. One more file failed to load, for a missing
dev dependency. But the shell expands `test/*.test.js` to the files at the
top of `test/` only. No file in `test/diagnostics-channel/` ran, and that
is the suite the map names for `lib/reply.js`.

Both patches passed the real fix's own test, `test/reply-trailers.test.js`.
This edit was safe either way. The difference is what each agent knew when
it said so. One had run the suite that the file's history points to. The
other had run more tests, but not that suite.

## The count

A risky edit is an edit to a file whose map paragraph says "Before editing
this file, run" and names test files or a test folder. An edit counts as
followed when the agent's shell commands name every test file and folder
in that sentence. The same map judges every arm of a task, including the
arm that never saw it.

| run | repository | without the map | with the map |
|---|---|---|---|
| `fastify-damage` | fastify | 2 of 12 | 11 of 12 |
| `undici-damage` | undici | 1 of 5 | 3 of 3 |
| both | | 3 of 17 | 14 of 15 |

The two runs share no task, so their pairs add. A pair is one task and one
risky file, edited by both agents. In 11 pairs one agent ran the named
tests and the other did not. In all 11, the agent that ran them had the
map. McNemar's exact test gives p about 0.001. On the real fix's own
tests, the arm with the map passed within one task of the arm without it.

A third arm added a hook that holds the first edit to a risky file and
shows the agent that file's paragraph. On `fastify-damage` it ran the named
tests on 12 of 12 risky edits.

## Why a computed instruction works

AGENTS.md tells an agent how to work in a project. It cannot say which
test suite guards which file, because nobody keeps that list current.
COMPLEX.md computes it from the dependency graph and the commit history,
and it puts the instruction in the paragraph for the file. `CLAUDE.md`
loads the map at the start of a session, so the instruction is in the
agent's context before the first edit. It is one command long.

## Limits

One agent and one model: Claude Opus 5 in Claude Code 2.1.260. The count
is 17 risky edits without the map and 15 with it, on two JavaScript
repositories. The scorer reads the
agent's shell commands, so a test run through another tool would not
count. The runs with the map cost more at API prices: at the median, 17%
to 31% more for the map alone, and about 50% more with the hook. A month's
map is built at the first task of that month, so for some tasks it holds
history from after the task's own fix: 12 of 30 `fastify-damage` tasks and
at least 8 of 30 `undici-damage` tasks. The runs used a version of `wire`
that also wrote a path scoped rule file, which `wire` no longer writes.

## Check it

Every run, transcript, map and patch is in the repository. The two
transcripts above are
`bench/results/fastify-damage/transcripts/7299a57d3f-file.jsonl` and
`7299a57d3f-none.jsonl`. The scorer is `bench/comply.mjs`, and
[bench/RESULTS.md](https://github.com/KletoWorks/complex-md/blob/main/bench/RESULTS.md)
has the tables and the method.

To give your own repository a map, run `npx complex-md` at its root.
