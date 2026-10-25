import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { npxExecutable } from '../src/invoke.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');
const VERSION = JSON.parse(readFileSync(join(dirname(BIN), '..', 'package.json'), 'utf8')).version;

test('complex-md mcp delegates to its matching complex-md-mcp version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-handoff-'));
  const npx = join(dir, 'npx');
  writeFileSync(npx, '#!/bin/sh\nprintf "%s\\n" "$@"\ncat\nexit 7\n');
  chmodSync(npx, 0o755);
  const root = join(dir, 'repo');
  const r = spawnSync(process.execPath, [BIN, 'mcp', '--root', root], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:/usr/bin:/bin` },
    input: 'transport input\n',
  });
  assert.equal(r.status, 7);
  assert.deepEqual(r.stdout.split('\n').slice(0, 4), ['-y', `complex-md-mcp@${VERSION}`, 'mcp', '--root']);
  assert.ok(r.stdout.endsWith(`${root}\ntransport input\n`));
  assert.equal(r.stderr.trim(), `complex-md: handing MCP to complex-md-mcp@${VERSION}.`);
});

test('the Windows handoff invokes npm’s JavaScript entrypoint without a shell', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-windows-'));
  const bin = join(dir, 'node_modules', 'npm', 'bin');
  const script = join(bin, 'npx-cli.js');
  mkdirSync(bin, { recursive: true });
  writeFileSync(script, '');
  const result = npxExecutable({
    platform: 'win32',
    env: { npm_execpath: join(bin, 'npm-cli.js') },
    nodePath: 'node.exe',
  });
  assert.deepEqual(result, { command: 'node.exe', args: [script] });
});
