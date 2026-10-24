# AGENTS.md

## Working on this repository

complex-md has two parts: the `cli/` npm package and the complex.md site.
These rules are for a coding agent that works on either part.

- Run `cd cli && npm test` before you finish a change. The exit code is
  the gate, not the printed summary. CI runs it on Node 22.
- Run `npm run build` at the root after a change to `content/`, `site/`
  or `scripts/build.mjs`. It writes `dist/`.
- Edit the prompts in `prompts/`. The files in `cli/prompts/` are copies
  that `cli/scripts/sync-prompts.mjs` makes before each pack.
- Add no runtime dependency to `cli/package.json`. The CLI imports the
  MCP SDK and zod only.
- Add no network call. The only requests are the model calls in
  `cli/src/generate.js`, and `cli/test/telemetry.test.js` fails on any
  other.
- When CLI behavior changes, run `cd cli && node --test test/truth.test.js`.
  It fails on a public sentence that the code contradicts.
- `cli/src/resolve.js` holds a literal NUL byte, so ripgrep skips it in a
  directory search. Read it with `git grep -I --text`.
- Do not run `bench/run.mjs` unless you are asked to. It drives a real
  agent and spends the account's usage.
- Do not edit `COMPLEX.md`, `.claude/rules/` or the section below by hand.
  They are generated. Regenerate them with `node cli/bin/complex-md.js`,
  which prints the next step when no provider key is set.
- In Claude Code, `.claude/settings.json` runs this checkout's CLI as a
  hook on each edit and when the agent stops.
- Write a commit subject in conventional form, 72 characters at most. In
  the body, state the problem before the fix. Use numbers, not adjectives.
- A change to the spec or a signal cites a benchmark run or a source, and
  adds a line to `CHANGELOG.md`.
- A person reviews the diff and opens the pull request. Fill in each
  section of `.github/PULL_REQUEST_TEMPLATE.md`, including the AI
  assistance box.

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
