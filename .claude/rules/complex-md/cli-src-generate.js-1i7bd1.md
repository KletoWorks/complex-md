---
alwaysApply: false
paths: cli/src/generate.js
---
# cli/src/generate.js

Listed in COMPLEX.md as a file where edits are risky.

    churn 6  fixes 2  fan_in 2  tests 3  loc 208  score 1198

cli/src/signals.js computes everything in the front matter: the commit window, churn and weighted churn, fixes, co-change pairs, seams, load-bearing files, the profile and the blind spots, and it exports findImporters, findCoveringTests and detectTestCommand for the MCP server and the diff check. Seven files depend on it, including the three bench scripts and the bin, so a renamed export breaks the benchmark and the CLI at once. Every spec refinement lands here first. cli/test/basic.test.js and cli/test/mcp.test.js cover it. Before editing this file, keep TABLE_HEAD and rowToArray in step with buildBundle in cli/src/generate.js and the complex_refresh tool, then run `cd cli && npm test` and confirm the synthetic-repo numbers in cli/test/basic.test.js still hold.

**Before editing this file, keep TABLE_HEAD and rowToArray in step with buildBundle in cli/src/generate.js and the complex_refresh tool, then run `cd cli && npm test` and confirm the synthetic-repo numbers in cli/test/basic.test.js still hold.**
