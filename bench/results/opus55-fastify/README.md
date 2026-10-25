# The Opus 5.5 replication, fastify danger set

Does the first claim (agents run the tests the map names) hold on Claude
Opus 5.5? This run repeats `fastify-damage` with two arms, on the current
model and the current harness.

## Configuration

| setting | value |
|---|---|
| dataset | `bench/data/fastify-danger.json`, 30 tasks |
| arms | `none`, `file` (60 runs) |
| model | `claude-opus-5-5`, for the agent and for the map prose |
| agent | Claude Code headless, `--setting-sources project`, `--strict-mcp-config` with no servers, claude.ai connectors off, `--disallowedTools WebFetch,WebSearch` |
| stop | `--stop-at none`: to completion, then the regression suite and the real fix's tests |
| caps | `--budget 5` (API equivalent, on the subscription), `--timeout 900`, 30 s grace |
| isolation | `bench/sandbox.mjs`: proxy allowlist `api.anthropic.com` and `platform.claude.com` only, masks on /tmp, /root, /home and the other roots |
| maps | one a month, built at the oldest base of that month, used only for tasks whose base has it in its history; 8,192 bytes at most (`--map-cap`, default) |
| account | the Max subscription; `cost_usd` is a unit of tokens, not money spent |
| schedule | nights only, 22:00 to 08:00 Montevideo, 2 workers, 40 runs a night at most |

Each night runs `night.sh` in this directory. It builds the maps first
(`--maps-only`), then starts worker 1 on tasks 0 to 14 and worker 2 on tasks
15 to 29, each with `--max-runs 20` and its own work directory. At 08:00 a
SIGINT stops both. The harness skips finished rows, so the next night
resumes. A row that hit the subscription usage limit is removed before and
after each night, so it runs again.

## Why fastify and not undici

The plan named the undici danger set. The leak probe (`bench/leak-probe.mjs`,
`CX_PROBE_PATHS` set to the Node install) ran on undici task `b4c287b382`
with the fix's one new line as the marker. It reported `leaked: true` on 3
routes that the sandbox leaves readable:

- the dependency copy, which comes from the clone's `node_modules` at HEAD;
- npm's own copy of undici in the Node install (6.28.0);
- the Node install as a whole.

Node 24.22.1 also ships undici 7.30.1 inside its binary, which `grep -a`
or `process.binding('natives')` can read. A check of each task's new lines
against these copies found the fixed code of 2 tasks whole (`b4c287b382`,
`66e1281606`) and lines of 6 more. An agent with `Bash(node:*)` or
`Bash(grep:*)` can read the fixed code, and the sandbox cannot hide the
Node install from an agent that needs Node. So this run uses the fastify
danger set.

On fastify the same probe, with a line from task `2ae3e1d734`'s fix as the
marker, reported `leaked: false` on every route, the dependency copy and the
Node install included. No fastify fix line of the 30 tasks appears in the
dependency copy or the Node install, apart from 2 generic lines
(`'Content-Length': Buffer.byteLength(body)` and a coverage comment).

## Limitations

- One model and one repository. A result says what the map does for this
  agent on fastify.
- The dependency copy comes from the clone's `node_modules` at HEAD, newer
  than every task. It holds no copy of fastify, but its plugins are newer
  than each task's base.
- The OAuth credentials are readable inside the sandbox, so an agent could
  call the model API itself through the allowed host.
- The `file` arm is wired by this checkout's `wire`, which no longer writes
  `.claude/rules/complex-md.md`. Compare these rows with rows of the same
  `cli_commit`, not with `fastify-damage`.
- The maps are shorter than the published ones (8 to 10 KB before the cap),
  so the prose names fewer files.
- The schedule lives in transient systemd units. A reboot drops a timer that
  has not fired yet.
