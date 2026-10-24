// The MCP server lives in its own package, complex-md-mcp. The core keeps
// no MCP dependency, and both ways in (`mcp` and `--mcp`) say where the
// server went instead of failing on a missing module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'complex-md.js');
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };

function run(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...ENV, GIT_CEILING_DIRECTORIES: dirname(cwd) } });
}

test('the core package has no runtime dependencies and no MCP import', () => {
  assert.deepEqual(pkg.dependencies || {}, {});
  for (const f of readdirSync(join(here, '..', 'src'))) {
    const src = readFileSync(join(here, '..', 'src', f), 'utf8');
    assert.ok(!/@modelcontextprotocol|from 'zod'/.test(src), `${f} imports an MCP dependency`);
  }
});

test('complex-md mcp without the separate package exits 2 and names it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-moved-'));
  const r = run(dir, ['mcp']);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '', 'nothing on stdout: an MCP client reads it as protocol');
  assert.match(r.stderr, /the MCP server ships as its own package, complex-md-mcp/);
  assert.ok(r.stderr.includes(`npx -y complex-md-mcp@${pkg.version} register`), r.stderr);
});

test('wire --mcp prints how to install the server and writes no MCP config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-mcp-moved-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, env: ENV });
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  execFileSync('git', ['add', '-A'], { cwd: dir, env: ENV });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env: ENV });
  writeFileSync(join(dir, 'COMPLEX.md'), '---\ncomplex_md: "0.3"\nhotspots:\n  - path: src/a.js\n    kind: source\n    loc: 1\n    churn: 1\n    churn_w: 1.00\n    fixes: 0\n    authors: 1\n    owner_share: 1.00\n    fan_in: 0\n    tests: 0\n    score: 10\nco_change:\nblind_spots:\n---\n\n## Where the risk lives\n\nx\n');
  const r = run(dir, ['wire', '--mcp', '--no-hooks']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /complex-md-mcp/);
  assert.ok(!existsSync(join(dir, '.mcp.json')), 'the core no longer registers a server');
  assert.ok(existsSync(join(dir, 'AGENTS.md')), 'the rest of wire still runs');
});
