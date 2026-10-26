// The CLI sends no telemetry. Its only network requests are the model
// calls in src/generate.js, and those run only when a provider key or
// --provider selects one. Two checks hold this: a scan of every source
// file for network code, and a real run of the commands with no key while
// every socket, DNS lookup and fetch is trapped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PROVIDERS } from '../src/providers.js';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(CLI, 'bin', 'complex-md.js');
const sources = () => ['bin', 'src'].flatMap((d) => readdirSync(join(CLI, d)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`));

test('no source file imports a network module or opens a socket', () => {
  const NET = /(?:from\s+|import\(\s*|require\(\s*)['"](?:node:)?(?:https?|http2|net|tls|dgram|dns|undici|ws)['"]|XMLHttpRequest|WebSocket|sendBeacon|EventSource/;
  const hits = sources().filter((f) => NET.test(readFileSync(join(CLI, f), 'utf8')));
  assert.deepEqual(hits, []);
});

test('fetch appears only in the two model calls in src/generate.js', () => {
  const calls = sources().flatMap((f) => [...readFileSync(join(CLI, f), 'utf8').matchAll(/\bfetch\s*\(/g)].map(() => f));
  assert.deepEqual(calls, ['src/generate.js', 'src/generate.js']);
  const gen = readFileSync(join(CLI, 'src', 'generate.js'), 'utf8');
  assert.match(gen, /async function callAnthropic[\s\S]*?await fetch\('https:\/\/api\.anthropic\.com\/v1\/messages'/);
  assert.match(gen, /async function callOpenAICompat[\s\S]*?await fetch\(`\$\{p\.base\}\/chat\/completions`/);
});

test('the core CLI has no runtime package dependencies', () => {
  const bare = new Set();
  for (const f of sources()) {
    for (const m of readFileSync(join(CLI, f), 'utf8').matchAll(/(?:from\s+|import\(\s*)['"]([^'".][^'"]*)['"]/g)) {
      if (!m[1].startsWith('node:')) bare.add(m[1]);
    }
  }
  assert.deepEqual([...bare].sort(), []);
  assert.deepEqual(JSON.parse(readFileSync(join(CLI, 'package.json'), 'utf8')).dependencies || {}, {});
});

/* Loaded before the CLI: any socket, DNS lookup or fetch is written to a
   log and refused. */
const TRAP = `
import net from 'node:net';
import dns from 'node:dns';
import { appendFileSync } from 'node:fs';
const log = (what) => { appendFileSync(process.env.CX_NET_LOG, what + '\\n'); };
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) { log('socket ' + JSON.stringify(a[0]?.host ?? a[0]?.path ?? a[0])); return connect.apply(this, a); };
const lookup = dns.lookup;
dns.lookup = function (h, ...a) { log('dns ' + h); return lookup.call(this, h, ...a); };
globalThis.fetch = async (u) => { log('fetch ' + String(u)); throw new Error('network trapped'); };
`;

test('a run of every local command with no key makes no network request', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-net-'));
  const side = mkdtempSync(join(tmpdir(), 'cx-trap-'));
  const trap = join(side, 'trap.mjs');
  writeFileSync(trap, TRAP);
  const logFile = join(side, 'net.log');
  const env = { ...process.env, CX_NET_LOG: logFile, GIT_CEILING_DIRECTORIES: dirname(dir), GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  for (const p of PROVIDERS) for (const k of [p.env, p.hostEnv, p.baseEnv]) if (k) delete env[k];
  delete env.COMPLEX_MD_PROVIDER;
  const g = (...a) => spawnSync('git', a, { cwd: dir, env });
  g('init', '-q');
  writeFileSync(join(dir, 'a.js'), "import { b } from './b.js';\nexport const a = b + 1;\n");
  writeFileSync(join(dir, 'b.js'), 'export const b = 1;\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  writeFileSync(join(dir, 'b.js'), 'export const b = 2;\n');
  g('commit', '-qam', 'fix: b');

  const run = (args, input) => spawnSync(process.execPath, ['--import', pathToFileURL(trap).href, BIN, ...args], { cwd: dir, env, encoding: 'utf8', input });
  const ran = [];
  for (const args of [[], ['signals'], ['wire'], ['report'], ['impact', 'a.js'], ['check'], ['exposure', '--sarif']]) {
    const r = run(args);
    ran.push(`${args.join(' ') || '(default)'}: ${r.status}`);
  }
  run(['hook', 'pre'], JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(dir, 'b.js') } }));
  assert.ok(existsSync(join(dir, '.complex-md', 'prompt.md')), `the default run wrote the prompt bundle (${ran.join(', ')})`);
  const net = existsSync(logFile) ? readFileSync(logFile, 'utf8').trim() : '';
  assert.equal(net, '', `network attempts:\n${net}`);
});
