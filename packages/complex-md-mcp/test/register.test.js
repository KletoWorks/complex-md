// register: the server's entry in each agent's config, written through the
// core's target table with this package's own invocation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, cpSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { register } from '../src/register.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const BIN = join(pkgRoot, 'bin', 'complex-md-mcp.js');
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-reg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, env: ENV });
  writeFileSync(join(dir, 'a.js'), 'export const a = 1;\n');
  execFileSync('git', ['add', '-A'], { cwd: dir, env: ENV });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env: ENV });
  return dir;
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('an installed package registers a pinned npx entry for each detected agent, once', () => {
  const dir = repo();
  mkdirSync(join(dir, '.claude'));
  mkdirSync(join(dir, '.cursor'));
  mkdirSync(join(dir, '.codex'));
  const first = register(dir);
  assert.deepEqual(first.names, ['claude', 'cursor', 'codex']);
  const want = { command: 'npx', args: ['-y', `complex-md-mcp@${pkg.version}`, 'mcp'] };
  assert.deepEqual(readJson(join(dir, '.mcp.json')).mcpServers['complex-md'], want);
  assert.deepEqual(readJson(join(dir, '.cursor/mcp.json')).mcpServers['complex-md'], want);
  assert.match(readFileSync(join(dir, '.codex/config.toml'), 'utf8'), new RegExp(`args = \\["-y", "complex-md-mcp@${pkg.version.replace(/\./g, '\\.')}", "mcp"\\]`));
  const second = register(dir);
  assert.deepEqual(second.mcp, [], 'a second run changes nothing');
  assert.equal((readFileSync(join(dir, '.codex/config.toml'), 'utf8').match(/\[mcp_servers\.complex-md\]/g) || []).length, 1);
});

test('an entry that starts the server through the core is replaced, other servers are kept', () => {
  const dir = repo();
  mkdirSync(join(dir, '.codex'));
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' }, 'complex-md': { command: 'npx', args: ['-y', 'complex-md', 'mcp'] } } }));
  writeFileSync(join(dir, '.codex/config.toml'), 'model = "o4"\n\n[mcp_servers.complex-md]\ncommand = "npx"\nargs = ["-y", "complex-md", "mcp"]\n');
  const r = register(dir, { agents: ['claude', 'codex'] });
  assert.deepEqual(r.replaced, ['.mcp.json', '.codex/config.toml']);
  const m = readJson(join(dir, '.mcp.json')).mcpServers;
  assert.deepEqual(m.other, { command: 'x' });
  assert.equal(m['complex-md'].args[1], `complex-md-mcp@${pkg.version}`);
  const toml = readFileSync(join(dir, '.codex/config.toml'), 'utf8');
  assert.ok(toml.startsWith('model = "o4"\n'), toml);
  assert.ok(!/"complex-md", "mcp"/.test(toml), 'the core entry is gone');
  assert.equal((toml.match(/\[mcp_servers\.complex-md\]/g) || []).length, 1);
});

test('a core entry pinned to a version is replaced too', () => {
  const dir = repo();
  mkdirSync(join(dir, '.cursor'));
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { 'complex-md': { command: 'npx', args: ['-y', 'complex-md@0.9.2', 'mcp'] } } }));
  writeFileSync(join(dir, '.cursor/mcp.json'), JSON.stringify({ mcpServers: { 'complex-md': { command: 'npx', args: ['-y', 'complex-md@latest', 'mcp'] } } }));
  const r = register(dir, { agents: ['claude', 'cursor'] });
  assert.deepEqual(r.replaced, ['.mcp.json', '.cursor/mcp.json']);
  for (const f of ['.mcp.json', '.cursor/mcp.json']) assert.equal(readJson(join(dir, f)).mcpServers['complex-md'].args[1], `complex-md-mcp@${pkg.version}`);
});

test('a copy inside the repository registers its own bin; unknown targets error', async () => {
  const dir = repo();
  mkdirSync(join(dir, '.claude'));
  // Copy the package into the repository with a link to the same core, so
  // the invocation sees itself inside the repository being registered.
  const inner = join(dir, 'tools', 'complex-md-mcp');
  for (const d of ['src', 'bin']) cpSync(join(pkgRoot, d), join(inner, d), { recursive: true });
  cpSync(join(pkgRoot, 'package.json'), join(inner, 'package.json'));
  symlinkSync(join(pkgRoot, 'node_modules'), join(inner, 'node_modules'));
  const { register: innerRegister } = await import(pathToFileURL(join(inner, 'src/register.js')));
  innerRegister(dir);
  assert.deepEqual(readJson(join(dir, '.mcp.json')).mcpServers['complex-md'], { command: 'node', args: ['tools/complex-md-mcp/bin/complex-md-mcp.js', 'mcp'] });
  assert.throws(() => register(dir, { agents: ['windsurf'] }), /unknown MCP target "windsurf"/);
});

test('the bin: --version, register outside a repository, and register with no agent config', () => {
  const v = spawnSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' });
  assert.equal(v.stdout.trim(), pkg.version);
  const out = mkdtempSync(join(tmpdir(), 'cx-mcp-norepo-'));
  const r = spawnSync(process.execPath, [BIN, 'register'], { cwd: out, encoding: 'utf8', env: { ...ENV, GIT_CEILING_DIRECTORIES: dirname(out) } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not inside a git repository/);
  const dir = repo();
  const none = spawnSync(process.execPath, [BIN, 'register'], { cwd: dir, encoding: 'utf8', env: ENV });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /no agent config found/);
  assert.ok(!existsSync(join(dir, '.mcp.json')));
  const ok = spawnSync(process.execPath, [BIN, 'register', '--for', 'claude'], { cwd: dir, encoding: 'utf8', env: ENV });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stderr, /registered: \.mcp\.json/);
});

test('the bin serves the six tools over stdio, with or without the word mcp', async () => {
  const dir = repo();
  for (const args of [['--root', dir], ['mcp', '--root', dir]]) {
    const req = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ].map((m) => JSON.stringify(m)).join('\n') + '\n';
    const r = spawnSync(process.execPath, [BIN, ...args], { input: req, encoding: 'utf8', timeout: 15000 });
    const replies = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const list = replies.find((x) => x.id === 2);
    assert.ok(list, `tools/list answered (${r.stderr})`);
    assert.deepEqual(list.result.tools.map((t) => t.name).sort(), ['complex_check', 'complex_impact', 'complex_lookup', 'complex_refresh', 'complex_refs', 'complex_where_to_look']);
  }
});

test('the core hands `complex-md mcp` over to this package when both are installed', () => {
  const dir = repo();
  // An install layout: the core copied into node_modules, this package
  // beside it. The core's bin resolves complex-md-mcp from there.
  const nm = join(mkdtempSync(join(tmpdir(), 'cx-mcp-side-')), 'node_modules');
  const core = join(nm, 'complex-md');
  const cli = join(pkgRoot, '..', '..', 'cli');
  for (const d of ['bin', 'src', 'prompts']) cpSync(join(cli, d), join(core, d), { recursive: true });
  cpSync(join(cli, 'package.json'), join(core, 'package.json'));
  symlinkSync(pkgRoot, join(nm, 'complex-md-mcp'));
  const req = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [join(core, 'bin', 'complex-md.js'), 'mcp', '--root', dir], { input: req, encoding: 'utf8', timeout: 15000 });
  const list = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.id === 2);
  assert.ok(list, `tools/list answered (exit ${r.status}: ${r.stderr})`);
  assert.equal(list.result.tools.length, 6);
});
