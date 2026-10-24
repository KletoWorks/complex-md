/* The Claude Code command line each arm runs. No arm may load MCP servers,
   connectors or skills from outside the task's checkout. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeCommand, mapCommand } from '../../bench/claude-args.mjs';
import { createMeter } from '../../bench/agent-events.mjs';

const wt = '/w/task-arm';

test('every arm runs with a strict, empty MCP config', () => {
  for (const arm of ['none', 'front', 'file', 'hooks']) {
    const [cmd, args, env] = claudeCommand({ arm, wt, budget: 5 });
    assert.equal(cmd, 'claude');
    assert.ok(args.includes('--strict-mcp-config'), arm);
    const cfg = args[args.indexOf('--mcp-config') + 1];
    assert.equal(cfg, '{"mcpServers":{}}', arm);
    assert.equal(args.filter((a) => a === '--mcp-config').length, 1, arm);
    assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false', 'claude.ai connectors off');
    assert.deepEqual(args.slice(args.indexOf('--setting-sources'), args.indexOf('--setting-sources') + 2), ['--setting-sources', 'project']);
    assert.equal(args[args.indexOf('--max-budget-usd') + 1], '5');
  }
  assert.deepEqual(claudeCommand({ arm: 'none', wt, budget: 1, model: 'm' })[1].slice(-2), ['--model', 'm']);
});

test('no arm can reach the web through the server side tools', () => {
  // A web search runs on the provider's side, past the sandbox proxy, so
  // an agent could read the upstream fix through it.
  for (const arm of ['none', 'front', 'file', 'hooks']) {
    const args = claudeCommand({ arm, wt, budget: 5 })[1];
    assert.equal(args[args.indexOf('--disallowedTools') + 1], 'WebFetch,WebSearch', arm);
  }
});

test('the init event records what the agent loaded: tools, MCP servers and skills', () => {
  const { m, onEvent } = createMeter({ wt, gold: [], stopAt: 'none' });
  onEvent({ type: 'system', subtype: 'init', model: 'x', tools: ['Read', 'Bash', 'mcp__claude_ai_Figma__get_screenshot'], mcp_servers: [{ name: 'claude.ai Figma', status: 'connected' }], skills: ['dataviz', 'loop'] });
  assert.equal(m.agent_tools, 3);
  assert.deepEqual(m.agent_mcp, ['claude.ai Figma']);
  assert.equal(m.agent_skills, 2);
});

test('the map prose call has no tools, no MCP servers and no connectors', () => {
  const [cmd, args, env] = mapCommand();
  assert.equal(cmd, 'claude');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.ok(args.includes('--strict-mcp-config'));
  assert.equal(args[args.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
  assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false');
  assert.deepEqual(mapCommand({ model: 'm' })[1].slice(-2), ['--model', 'm']);
});
