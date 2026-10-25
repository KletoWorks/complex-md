// Hooks and MCP entries live inside JSON files the user also edits. wire
// records the entries it added and the keys it created; unwire takes out
// exactly those, and the rest of the file keeps its bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('unwire removes a Codex config file and directory created by wire', () => {
  const dir = repo();
  const before = snapshot(dir);
  wire(dir, { agents: ['codex'], mcp: true, profile: 'full' });
  assert.ok(existsSync(join(dir, '.codex/config.toml')));
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

test('wire leaves a legacy-looking MCP server with user fields untouched', () => {
  const entry = { command: 'npx', args: ['-y', 'complex-md@0.9.2', 'mcp'], env: { CUSTOM: 'keep' } };
  const original = pretty({ mcpServers: { 'complex-md': entry } });
  const dir = repo({ '.mcp.json': original });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  assert.equal(read(dir, '.mcp.json'), original);
  assert.equal(readManifest(dir).entries.some((record) => record.kind === 'mcp-json'), false);
});

test('wire claims a recognized legacy MCP entry so unwire can remove it', () => {
  const original = pretty({ mcpServers: { 'complex-md': { command: 'npx', args: ['-y', 'complex-md', 'mcp'] } } });
  const dir = repo({ '.mcp.json': original });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const migrated = JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'];
  assert.deepEqual(migrated.args, ['-y', `complex-md-mcp@${JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version}`, 'mcp']);
  assert.equal(readManifest(dir).entries.some((entry) => entry.kind === 'mcp-json'), true);
  unwire(dir);
  assert.equal(read(dir, '.mcp.json'), pretty({ mcpServers: {} }));
});

test('rewiring an unchanged manifest-owned MCP entry refreshes its hash during migration', () => {
  const version = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version;
  const previous = { command: 'npx', args: ['-y', '--prefer-offline', 'complex-md@0.9.2', 'mcp'] };
  const dir = repo({ '.mcp.json': pretty({ mcpServers: { 'complex-md': previous } }) });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const config = JSON.parse(read(dir, '.mcp.json'));
  config.mcpServers['complex-md'] = previous;
  writeFileSync(join(dir, '.mcp.json'), pretty(config));
  const manifest = readManifest(dir);
  const record = manifest.entries.find((entry) => entry.kind === 'mcp-json').records[0];
  record.sha256 = createHash('sha256').update(JSON.stringify(previous)).digest('hex');
  writeFileSync(join(dir, '.complex-md/manifest.json'), pretty(manifest));

  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const current = JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'];
  assert.deepEqual(current.args, ['-y', `complex-md-mcp@${version}`, 'mcp']);
  assert.equal(readManifest(dir).entries.find((entry) => entry.kind === 'mcp-json').records[0].sha256,
    createHash('sha256').update(JSON.stringify(current)).digest('hex'));
  unwire(dir);
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers, {});
});

test('rewiring does not replace a legacy-looking MCP entry edited since the manifest was written', () => {
  const dir = repo();
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const config = JSON.parse(read(dir, '.mcp.json'));
  config.mcpServers['complex-md'] = { command: 'npx', args: ['-y', 'complex-md@0.9.2', 'mcp'] };
  writeFileSync(join(dir, '.mcp.json'), pretty(config));
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'], config.mcpServers['complex-md']);
  unwire(dir);
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'], config.mcpServers['complex-md']);
});

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const coreVersion = () => JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version;

/* Wire once, then make the config and the manifest look as an earlier
   version left them: the config holds `entry` (or none), and the manifest
   records the hash of `recorded`. */
const MINE = { mine: { command: 'echo', args: ['mine'] } };

function earlierWire(entry, recorded) {
  const dir = repo({ '.mcp.json': pretty({ mcpServers: MINE }) });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const config = JSON.parse(read(dir, '.mcp.json'));
  if (entry) config.mcpServers['complex-md'] = entry;
  else delete config.mcpServers['complex-md'];
  writeFileSync(join(dir, '.mcp.json'), pretty(config));
  const manifest = readManifest(dir);
  manifest.entries.find((e) => e.kind === 'mcp-json').records[0].sha256 = sha(recorded);
  writeFileSync(join(dir, '.complex-md/manifest.json'), pretty(manifest));
  return dir;
}

test('rewiring updates an unchanged entry that pins an older complex-md-mcp', () => {
  const older = { command: 'npx', args: ['-y', 'complex-md-mcp@0.9.0', 'mcp'] };
  const dir = earlierWire(older, older);
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const current = JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'];
  assert.deepEqual(current.args, ['-y', `complex-md-mcp@${coreVersion()}`, 'mcp']);
  assert.equal(readManifest(dir).entries.find((e) => e.kind === 'mcp-json').records[0].sha256, sha(current));
  unwire(dir);
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers, MINE);
});

test('rewiring leaves a complex-md-mcp entry edited since the manifest was written', () => {
  const edited = { command: 'npx', args: ['-y', 'complex-md-mcp@0.9.0', 'mcp'] };
  const dir = earlierWire(edited, { command: 'npx', args: ['-y', 'complex-md-mcp@0.8.0', 'mcp'] });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'], edited);
});

test('an entry rewritten after the user deleted it gets a fresh hash, so unwire removes it', () => {
  const dir = earlierWire(null, { command: 'npx', args: ['-y', '--prefer-offline', 'complex-md@0.10.0', 'mcp'] });
  wire(dir, { agents: ['claude'], mcp: true, profile: 'full' });
  const current = JSON.parse(read(dir, '.mcp.json')).mcpServers['complex-md'];
  assert.equal(readManifest(dir).entries.find((e) => e.kind === 'mcp-json').records[0].sha256, sha(current));
  unwire(dir);
  assert.deepEqual(JSON.parse(read(dir, '.mcp.json')).mcpServers, MINE);
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
