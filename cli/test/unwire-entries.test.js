// Hooks and MCP entries live inside JSON files the user also edits. wire
// records the entries it added and the keys it created; unwire takes out
// exactly those, and the rest of the file keeps its bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { readManifest } from '../src/manifest.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const pretty = (o, indent = 2) => JSON.stringify(o, null, indent) + '\n';

const USER_SETTINGS = {
  permissions: { allow: ['Bash(npm test)'] },
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] },
};

test('wire --hooks then unwire leaves the user\'s settings and hook files byte identical', () => {
  const dir = repo({
    'AGENTS.md': '# House rules\n',
    '.claude/settings.json': pretty(USER_SETTINGS),
    '.cursor/hooks.json': pretty({ version: 1, hooks: { stop: [{ command: 'echo mine' }] } }, 4),
  });
  const before = snapshot(dir);
  wire(dir, { agents: ['claude', 'cursor'], hooks: true, profile: 'full' });
  const s = JSON.parse(read(dir, '.claude/settings.json'));
  assert.equal(s.hooks.PreToolUse.length, 2, 'our hook beside the user\'s');
  assert.match(read(dir, '.cursor/hooks.json'), /^ {4}"version"/m, 'wire keeps the file\'s indent');
  assert.deepEqual(readManifest(dir).entries.map((e) => e.path).sort(), ['.claude/settings.json', '.cursor/hooks.json']);
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('unwire leaves and reports a hook entry whose settings changed after wire', () => {
  const dir = repo({ '.claude': null });
  wire(dir, { agents: ['claude'], hooks: true, profile: 'full' });
  const settings = JSON.parse(read(dir, '.claude/settings.json'));
  const group = settings.hooks.PreToolUse.find((g) => g.hooks.some((h) => /complex-md.*hook pre/.test(h.command)));
  group.matcher = 'Write';
  writeFileSync(join(dir, '.claude/settings.json'), pretty(settings));
  const result = unwire(dir);
  const after = JSON.parse(read(dir, '.claude/settings.json'));
  assert.ok(after.hooks.PreToolUse.some((g) => g.matcher === 'Write'));
  assert.ok(result.left.some((entry) => entry.path === '.claude/settings.json'));
});

test('settings and hook files that wire created are deleted by unwire', () => {
  const dir = repo({ '.claude': null, '.cursor': null });
  const before = snapshot(dir);
  wire(dir, { agents: ['claude', 'cursor'], hooks: true, profile: 'full' });
  assert.ok(existsSync(join(dir, '.claude/settings.json')));
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('--hooks --local writes settings.local.json, and unwire deletes it', () => {
  const dir = repo({ '.claude': null });
  const before = snapshot(dir);
  wire(dir, { agents: ['claude'], hooks: 'local', profile: 'full' });
  assert.ok(existsSync(join(dir, '.claude/settings.local.json')));
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('wire --mcp then unwire leaves the user\'s MCP servers and Codex config as they were', () => {
  const dir = repo({
    'AGENTS.md': '# House rules\n',
    '.mcp.json': pretty({ mcpServers: { mine: { command: 'mine' } } }),
    '.cursor': null,
    '.codex/config.toml': 'model = "o4"\n',
  });
  const before = snapshot(dir);
  wire(dir, { agents: ['claude', 'cursor', 'codex'], mcp: true, profile: 'full' });
  assert.ok(JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md']);
  assert.ok(existsSync(join(dir, '.cursor/mcp.json')));
  unwire(dir);
  assert.deepEqual(snapshot(dir), before);
});

test('unwire leaves and reports an MCP entry whose settings changed after wire', () => {
  const dir = repo();
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const config = JSON.parse(read(dir, '.mcp.json'));
  config.mcpServers['complex-md'].env = { CUSTOM: 'keep' };
  writeFileSync(join(dir, '.mcp.json'), pretty(config));
  const manifest = readManifest(dir);
  assert.match(manifest.entries.find((entry) => entry.kind === 'mcp-json').records[0].sha256, /^[a-f0-9]{64}$/);
  const result = unwire(dir);
  const after = JSON.parse(read(dir, '.mcp.json'));
  assert.deepEqual(after.mcpServers['complex-md'].env, { CUSTOM: 'keep' });
  assert.ok(result.left.some((entry) => entry.path === '.mcp.json'));
});

test('wire does not claim a pre-existing user complex-md MCP server', () => {
  const custom = { command: 'custom-server', args: ['serve'], env: { TOKEN: 'user-value' } };
  const original = pretty({ mcpServers: { 'complex-md': custom } });
  const dir = repo({ '.mcp.json': original });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  assert.equal(readManifest(dir).entries.some((entry) => entry.kind === 'mcp-json'), false);
  unwire(dir);
  assert.equal(read(dir, '.mcp.json'), original);
});

test('wire claims a recognized legacy MCP entry so unwire can remove it', () => {
  const original = pretty({ mcpServers: { 'complex-md': { command: 'npx', args: ['-y', 'complex-md', 'mcp'] } } });
  const dir = repo({ '.mcp.json': original });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  assert.equal(readManifest(dir).entries.some((entry) => entry.kind === 'mcp-json'), true);
  unwire(dir);
  assert.equal(read(dir, '.mcp.json'), pretty({ mcpServers: {} }));
});

test('hooks an earlier version wrote are recorded by wire --hooks and removed by unwire', () => {
  const legacy = { hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'npx -y complex-md hook pre', timeout: 30 }] }] } };
  const dir = repo({ '.claude/settings.json': pretty(legacy) });
  wire(dir, { agents: ['claude'], hooks: true, profile: 'full' });
  unwire(dir);
  assert.ok(!existsSync(join(dir, '.claude/settings.json')) || !/complex-md/.test(read(dir, '.claude/settings.json')), 'no complex-md hook is left');
});

test('a default wire after wire --hooks keeps the hook entries on record for unwire', () => {
  const dir = repo({ '.claude/settings.json': pretty(USER_SETTINGS) });
  wire(dir, { agents: ['claude'], hooks: true, profile: 'full' });
  wire(dir, { agents: ['claude'], profile: 'full' });
  assert.deepEqual(readManifest(dir).entries.map((e) => e.path), ['.claude/settings.json']);
  unwire(dir);
  assert.equal(read(dir, '.claude/settings.json'), pretty(USER_SETTINGS));
});

test('a settings file that is no longer valid JSON is left in place and reported', () => {
  const dir = repo({ '.claude/settings.json': pretty(USER_SETTINGS) });
  wire(dir, { agents: ['claude'], hooks: true, profile: 'full' });
  writeFileSync(join(dir, '.claude/settings.json'), '{ broken');
  const r = unwire(dir);
  assert.equal(read(dir, '.claude/settings.json'), '{ broken');
  assert.ok(r.left.some((e) => e.path === '.claude/settings.json'));
});
