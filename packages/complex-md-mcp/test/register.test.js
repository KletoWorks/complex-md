import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { register } from '../src/register.js';
import { readManifest } from 'complex-md/src/manifest.js';
import { unwire } from 'complex-md/src/unwire.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const corePkg = JSON.parse(readFileSync(new URL('../../../cli/package.json', import.meta.url), 'utf8'));
const env = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-register-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, env });
  writeFileSync(join(dir, 'a.js'), 'export const a = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: dir, env });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env });
  return dir;
}

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('package version and engine dependency stay in lockstep with the core', () => {
  assert.equal(pkg.version, corePkg.version);
  assert.equal(pkg.dependencies['complex-md'], corePkg.version);
  assert.equal(pkg.dependencies.zod, '^4.6.7');
});

test('register writes pinned package entries once for each configured target', () => {
  const dir = repo();
  for (const name of ['.claude', '.cursor', '.codex']) mkdirSync(join(dir, name));
  const first = register(dir);
  assert.deepEqual(first.names, ['claude', 'cursor', 'codex']);
  const entry = { command: 'npx', args: ['-y', `complex-md-mcp@${pkg.version}`, 'mcp'] };
  assert.deepEqual(json(join(dir, '.mcp.json')).mcpServers['complex-md'], entry);
  assert.deepEqual(json(join(dir, '.cursor/mcp.json')).mcpServers['complex-md'], entry);
  assert.ok(readFileSync(join(dir, '.codex/config.toml'), 'utf8').includes(`complex-md-mcp@${pkg.version}`));
  assert.deepEqual(register(dir).mcp, []);
});

test('register replaces a pinned core entry and keeps other MCP servers', () => {
  const dir = repo();
  mkdirSync(join(dir, '.claude'));
  const config = {
    mcpServers: {
      other: { command: 'other-server' },
      'complex-md': { command: 'npx', args: ['-y', '--prefer-offline', 'complex-md@0.9.2', 'mcp'] },
    },
  };
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify(config, null, 2) + '\n');
  const result = register(dir, { agents: ['claude'] });
  assert.deepEqual(result.replaced, ['.mcp.json']);
  const servers = json(join(dir, '.mcp.json')).mcpServers;
  assert.deepEqual(servers.other, { command: 'other-server' });
  assert.equal(servers['complex-md'].args[1], `complex-md-mcp@${pkg.version}`);
});

test('package register records MCP ownership so core unwire can remove it', () => {
  const dir = repo();
  mkdirSync(join(dir, '.claude'));
  const owned = 'owned by the earlier wire\n';
  writeFileSync(join(dir, 'owned.txt'), owned);
  mkdirSync(join(dir, '.complex-md'));
  writeFileSync(join(dir, '.complex-md/manifest.json'), JSON.stringify({
    generator: { name: 'complex-md', version: corePkg.version },
    spec: '0.3',
    profile: 'full',
    files: [{ path: 'owned.txt', sha256: createHash('sha256').update(owned).digest('hex') }],
    blocks: [],
    entries: [],
    dirs: [],
  }, null, 2) + '\n');
  register(dir, { agents: ['claude'] });
  const manifest = readManifest(dir);
  const record = manifest.entries.find((entry) => entry.kind === 'mcp-json');
  assert.match(record.records[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.files.map((file) => file.path), ['owned.txt']);
  unwire(dir);
  assert.equal(readManifest(dir), null);
});
