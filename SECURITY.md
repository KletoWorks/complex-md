# Security policy

## Supported versions

complex-md is before 1.0. Security fixes go to the latest minor release
only, as a patch release. `npm view complex-md version` prints the latest
release.

| Version | Security fixes |
| --- | --- |
| The latest minor release | Yes |
| Every earlier minor release | No. Upgrade to the latest release. |

## Report a vulnerability

Do not report a vulnerability in a public issue, discussion or pull request.

Report it in private through GitHub:
https://github.com/KletoWorks/complex-md/security/advisories/new.
On the repository page, this is Security, then "Report a vulnerability".
Only the reporter and the people who administer the repository's
security can read the report.

Put these facts in the report:

- the version, from `npx complex-md --version`
- the operating system and the agent harness, for example Claude Code or Cursor
- the steps that reproduce the problem, or a small repository that does
- what an attacker can do with it

You get a first answer within 7 days. When a fix ships, the advisory is
published with the fixed version. The advisory credits you, unless you ask
it not to.

## What is in scope

- The hook commands that `wire` writes into `.claude/settings.json` and
  `.cursor/hooks.json`. The agent harness runs them on each edit, so a
  way to make them run other code is in scope.
- A file that `wire` or `generate` writes outside the repository root.
- A repository whose file names or history make the CLI write a
  COMPLEX.md or a brief that injects instructions into an agent.
- The model call. With a provider key, `generate` sends the signals and
  the hotspot excerpts to that provider. Before the call, it replaces each
  secret-shaped value in the request with `[redacted:<rule>]`
  (`cli/src/redact.js`, with the rules in `cli/rules/exposure.json`). A
  credential file that reaches the request is in scope, and so is a key in
  a known token format that reaches it.
- `complex-md exposure`. A secret value in its report, its SARIF file, its
  baseline or its terminal output is in scope. So is a rule file in a
  cloned repository (`.complex-md/exposure.json`) that makes the scan run
  code, stall, or fetch from a remote.
- The MCP server, `complex-md mcp`. `wire` registers it only with `--mcp`.
- The release workflow and the npm package provenance.

## What is not in scope

- A vulnerability in a model provider or an agent harness. Report it to
  that vendor.
- A known vulnerability in a dependency with no complex-md specific path
  to exploit it. Report it upstream.
