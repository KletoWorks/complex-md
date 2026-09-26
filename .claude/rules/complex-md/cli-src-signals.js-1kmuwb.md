---
alwaysApply: false
paths: cli/src/signals.js
---
# cli/src/signals.js

Listed in COMPLEX.md as a file where edits are risky.

    churn 4  fixes 2  fan_in 7  tests 2  loc 369  score 2635

cli/src/signals.js computes everything in the front matter: the commit window, churn and weighted churn, fixes, co-change pairs, seams, load-bearing files, the profile and the blind spots, and it exports findImporters, findCoveringTests and detectTestCommand for the MCP server and the diff check. Seven files depend on it, including the three bench scripts and the bin, so a renamed export breaks the benchmark and the CLI at once. Every spec refinement lands here first. cli/test/basic.test.js and cli/test/mcp.test.js cover it. Before editing this file, keep TABLE_HEAD and rowToArray in step with buildBundle in cli/src/generate.js and the complex_refresh tool, then run `cd cli && npm test` and confirm the synthetic-repo numbers in cli/test/basic.test.js still hold.

Moves with:
- cli/src/check.js (100% of this file's commits, 4 together)
- cli/src/hook.js (100% of this file's commits, 4 together)

Open the partner and say in the change description whether it needed a change too.

**Before editing this file, keep TABLE_HEAD and rowToArray in step with buildBundle in cli/src/generate.js and the complex_refresh tool, then run `cd cli && npm test` and confirm the synthetic-repo numbers in cli/test/basic.test.js still hold.**
