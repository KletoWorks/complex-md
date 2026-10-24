// The Claude Code command line for one arm of one run.
//
// --setting-sources project kept user settings out, but not the account's
// claude.ai connectors: every undici run started with 54 tools, Figma and
// Claude Docs among them. Every arm now passes --strict-mcp-config, with an
// empty server list, and turns the connectors off.
// User skills and memory stay out because the sandbox hides ~/.claude
// apart from the credentials. WebFetch and WebSearch are denied by name:
// a web search runs on the provider's side, past the sandbox proxy, and
// --tools alone would let them back in if its list grew.

export const ALLOWED_TOOLS = 'Bash(git diff:*) Bash(git log:*) Bash(git grep:*) Bash(git show:*) Bash(node:*) Bash(npm test:*) Bash(ls:*) Bash(cat:*) Bash(rg:*) Bash(grep:*) Bash(find:*)';

/** [cmd, args, env] for Claude Code on `arm` in checkout `wt`. */
export function claudeCommand({ arm, wt, budget, model = null }) {
  const a = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--setting-sources', 'project', '--max-budget-usd', String(budget),
    '--tools', 'Read,Edit,Write,MultiEdit,Grep,Glob,Bash', '--allowedTools', ALLOWED_TOOLS, '--disallowedTools', 'WebFetch,WebSearch',
    '--mcp-config', '{"mcpServers":{}}', '--strict-mcp-config'];
  if (model) a.push('--model', model);
  return ['claude', a, { ENABLE_CLAUDEAI_MCP_SERVERS: 'false' }];
}

/* [cmd, args, env] for the one call that writes a map's prose. It has no
   tools, and like the agent runs it loads no MCP servers and no claude.ai
   connectors: tools from those could reach outside the bundle it is given. */
export function mapCommand({ model = null } = {}) {
  const a = ['-p', '--output-format', 'json', '--tools', '', '--setting-sources', '', '--mcp-config', '{"mcpServers":{}}', '--strict-mcp-config'];
  if (model) a.push('--model', model);
  return ['claude', a, { ENABLE_CLAUDEAI_MCP_SERVERS: 'false' }];
}
