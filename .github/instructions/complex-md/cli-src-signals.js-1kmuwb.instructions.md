---
applyTo: "cli/src/signals.js"
---
# cli/src/signals.js

Listed in COMPLEX.md as a file where edits are risky.

    churn 8  fixes 4  fan_in 8  tests 8  loc 414  score 3130

cli/src/signals.js computes every number in the front matter: the commit window, churn, fixes, co-change pairs, seams, load-bearing files and the profile. It also exports TABLE_HEAD and rowToArray, which cli/src/generate.js and cli/src/mcp.js use to print the signals table. 8 files depend on it, among them 4 bench scripts and the bin, so a renamed export breaks the benchmark and the CLI at once. 4 of its 8 commits were fixes, and 8 test files reach it. Before editing this file, run `cd cli && npm test`, which runs all 8 covering test files.

**Before editing this file, run `cd cli && npm test`, which runs all 8 covering test files.**
