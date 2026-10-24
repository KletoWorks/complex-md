# complex-md-mcp

The MCP server for `COMPLEX.md`, the computed map of where edits are risky
and where bugs get fixed. An agent calls it mid-task instead of reading the
whole map at launch. The map and the engine come from
[complex-md](https://www.npmjs.com/package/complex-md); this package adds the
protocol layer and its two dependencies, `@modelcontextprotocol/sdk` and
`zod`.

    npx complex-md-mcp register

## Register it

`register` adds one entry to the config of each agent the repository is set
up for: `.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor and
`.codex/config.toml` for Codex. The entry pins this version
(`npx -y complex-md-mcp@<version> mcp`), so a later publish never runs
without an upgrade. Name the agents with `--for`:

    npx complex-md-mcp register --for claude,cursor,codex,openclaw,hermes

OpenClaw and Hermes keep one registry per machine. They are registered only
when named, through their own CLIs, and the entry carries `--root <repo>` so
the server reads the right repository from any directory.

`register` is idempotent. An entry from complex-md 0.9 or earlier, which
started the server as `complex-md mcp`, is replaced. Entries for other
servers are left alone.

## The tools

| Tool | Use it when |
| --- | --- |
| `complex_lookup(path)` | Before editing a file: row, paragraph, directive, partners, covering tests. |
| `complex_where_to_look(keywords?)` | A bug report does not name a file: hotspots ranked by recent change, re-ranked by the report's words. |
| `complex_impact(path)` | Before changing an interface: the files that import it, partners, tests, test command. |
| `complex_refs(symbol)` | Tracing a name across the repository: definitions and references, hotspots first. |
| `complex_check(files?, base?)` | Before finishing: hotspots touched, partners missed, tests to run. |
| `complex_refresh()` | The map looks stale: recompute the table live from git. |

Without a `COMPLEX.md`, every tool except `complex_lookup` and
`complex_check` answers from live signals; those two say how to generate a
map.

## Run it

    npx complex-md-mcp [--root <repo>]

The server speaks MCP on stdio. `--root` pins it to a repository; without it
the server reads the repository that contains the working directory.

## When to use it

The server is opt in. The committed map and its path-scoped rules work
without it. Add it where an agent on your repository makes use of the calls.

## Versions

This package moves in step with complex-md: `complex-md-mcp@x.y.z` depends
on `complex-md@^x.y.z` and imports its engine directly.
