---
alwaysApply: false
paths: cli/src/signals.js, cli/src/git.js, cli/src/generate.js, scripts/build.mjs, site/site.css, site/404.html, content/spec.md, skill/SKILL.tmpl.md, cli/src/check.js, cli/src/hook.js, prompts/generate.md, prompts/integration.md
---
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
