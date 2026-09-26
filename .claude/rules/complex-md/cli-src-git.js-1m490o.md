---
alwaysApply: false
paths: cli/src/git.js
---
# cli/src/git.js

Listed in COMPLEX.md as a file where edits are risky.

    churn 3  fixes 2  fan_in 5  tests 0  loc 48  score 1378

cli/src/git.js wraps spawnSync for git: repoRoot, hasCommits, shortSha, trackedFiles and changedFiles. Five modules depend on it (the bin, check, hook, mcp, signals), and two of its three commits were fixes for what happens outside a repository. No test imports it; cli/test/cli.test.js and cli/test/hook.test.js reach it only by running the bin as a process. Before editing this file, preserve the allowFail contract (callers that pass allowFail: true expect an empty string and never a throw, outside a repository or with no HEAD) and run cli/test/cli.test.js and cli/test/hook.test.js.

**Before editing this file, preserve the allowFail contract (callers that pass allowFail: true expect an empty string and never a throw, outside a repository or with no HEAD) and run cli/test/cli.test.js and cli/test/hook.test.js.**
