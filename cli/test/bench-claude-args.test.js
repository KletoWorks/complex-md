/* The Claude Code command line each arm runs. No arm may load MCP servers,
   connectors or skills from outside the task's checkout. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeCommand } from '../../bench/claude-args.mjs';
import { createMeter } from '../../bench/agent-events.mjs';

const wt = '/w/task-arm';

test('every arm runs with a strict MCP config: empty, or the checkout\'s own for the mcp arm', () => {
  for (const arm of ['none', 'front', 'file', 'hooks', 'mcp']) {
    const [cmd, args, env] = claudeCommand({ arm, wt, budget: 5 });
    assert.equal(cmd, 'claude');
    assert.ok(args.includes('--strict-mcp-config'), arm);
    const cfg = args[args.indexOf('--mcp-config') + 1];
    assert.equal(cfg, arm === 'mcp' ? `${wt}/.mcp.json` : '{"mcpServers":{}}', arm);
    assert.equal(args.filter((a) => a === '--mcp-config').length, 1, arm);
    assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false', 'claude.ai connectors off');
    assert.deepEqual(args.slice(args.indexOf('--setting-sources'), args.indexOf('--setting-sources') + 2), ['--setting-sources', 'project']);
    assert.equal(args[args.indexOf('--max-budget-usd') + 1], '5');
  }
  assert.deepEqual(claudeCommand({ arm: 'none', wt, budget: 1, model: 'm' })[1].slice(-2), ['--model', 'm']);
});

test('the init event records what the agent loaded: tools, MCP servers and skills', () => {
  const { m, onEvent } = createMeter({ wt, gold: [], stopAt: 'none' });
  onEvent({ type: 'system', subtype: 'init', model: 'x', tools: ['Read', 'Bash', 'mcp__claude_ai_Figma__get_screenshot'], mcp_servers: [{ name: 'claude.ai Figma', status: 'connected' }], skills: ['dataviz', 'loop'] });
  assert.equal(m.agent_tools, 3);
  assert.deepEqual(m.agent_mcp, ['claude.ai Figma']);
  assert.equal(m.agent_skills, 2);
});
