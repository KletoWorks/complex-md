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

## COMPLEX.md: the structural risk map

`COMPLEX.md` at the repository root is a computed map of where edits are
risky and where bugs get fixed, built from the dependency graph and the
commit history. Its `hotspots`, `load_bearing`, `co_change` and `seams`
lists name specific files and areas. When your work touches one of them:

1. IMPORTANT: before editing a file listed under `hotspots` or
   `load_bearing`, read its paragraph in COMPLEX.md under "Why these files
   are hot" and do what that paragraph's last sentence says before you
   change the file.
2. When editing one file of a `co_change` pair, or a file in one side of a
   `seams` pair, open the partner and state in your change description
   whether the partner also needed a change.
3. Fixing a bug whose location you do not yet know, check the `hotspots`
   rows with the highest `fixes` count before searching the whole
   repository; past fixes predict where the next one lands.
4. Entering this repository cold, read the files under "What to read first"
   in order before your first edit.

After refactoring a listed hotspot, regenerate the map: `npx complex-md`, or
run the complex-md skill.
