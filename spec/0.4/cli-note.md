# The reference CLI and spec 0.4 (note, not normative)

This note describes what the `complex-md` CLI does with a map. Nothing in it
is a requirement of the format. Another producer or reader can conform to
[spec.md](spec.md) and do none of it. The detail of each behaviour is in
spec 0.3 at <https://complex.md/spec>, under "Generating the file", "Wiring
it in" and "Enforcement and runtime". Those sections leave the format
document when 0.4 is final, and this note takes their place.

## Status

The CLI 0.10.0 writes spec 0.3 maps. It moves to 0.4 when the draft is
final. Until then, the test `cli/test/spec-fixtures.test.js` runs the CLI's
reader, `cli/src/complexmd.js`, over the 0.4 fixtures. A case where the
reader does not yet give the result that the draft requires runs as a todo,
and the todo names the gap.

## Producing a map

The CLI writes the front matter from its own computation, so no number
passes through a language model. It then gets the prose in 1 of 2 ways:

1. With an API key, it makes 1 model call. The call carries the generation
   prompt, the signals table and excerpts of up to 10 hotspot files, about
   60,000 characters in all.
2. With no key, it sends nothing. It writes a prompt bundle for the agent
   that the user already runs, and that agent writes the prose.

The CLI refuses a model reply that lacks 1 of the 4 required sections, and
then writes no map.

The complex-md skill computes the same numbers where Node is available. Where
it is not, it computes the history numbers with git and awk, and an
approximate fan in with grep.

## Wiring a map into agents

`npx complex-md wire` adds a fixed block of 4 rules to the agent instruction
files that exist, such as `AGENTS.md` and `CLAUDE.md`. It also writes 1 brief
per listed path into the rule folders of the agents it detects, scoped to
that path. A brief holds the row's numbers, the file's paragraph, its co-change
partners and the directive.

## Hooks and the diff check

The CLI can install 2 hooks for Claude Code and Cursor:

1. The edit gate holds the first edit of a hotspot in a session and shows the
   file's paragraph and directive.
2. The stop check compares the session's diff with the map before the agent
   ends its turn.

`npx complex-md check` prints the same report for a staged change or a
branch, for pre-commit hooks and CI.

Each of these reads the map through `cli/src/complexmd.js`. When the map is
absent or does not parse, the hooks let the operation through, as section 10
of the draft requires, and `check` reports that there is no map.
