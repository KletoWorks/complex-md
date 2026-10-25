# Instructions for Copilot in this repository

COMPLEX.md at the repository root maps where edits here are risky. It is
computed from the import graph and the commit history.

When you review a pull request:

1. For each changed file that COMPLEX.md lists under `hotspots` or
   `load_bearing`, check that the change did what that file's paragraph in
   "Why these files are hot" asks. Most paragraphs name a test command.
2. For each changed file in a `co_change` pair, check whether the partner
   also needed a change. If the partner is unchanged, say so in a comment
   and name the partner.
3. Name the covering tests from COMPLEX.md that the change should run.
   The gate is the exit code of `cd cli && npm test`.
4. When CLI behavior changes, check that `cli/test/truth.test.js` still
   passes. It fails on a public sentence that the code contradicts.

Rules from AGENTS.md: add no runtime dependency, add no network call
outside the model calls in `cli/src/generate.js`, and do not edit
COMPLEX.md, `.claude/rules/` or `.github/instructions/complex-md/` by
hand, because they are generated.
