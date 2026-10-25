// --via: the map's prose from an agent CLI the user already runs. Every CLI
// here is a stub executable on PATH; no test starts a real agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { VIA_CLIS, VIA_NAMES, viaInvocation, findExecutable, extractMap, checkMap, runVia, viaSelection } from '../src/via.js';

const FM = '---\ncomplex_md: "0.3"\ncommit: abc1234\nhotspots:\n  - path: src/a.js\n---\n';
const PROSE = '## Where the risk lives\n\nRisk sits in src/a.js.\n\n## Why these files are hot\n\nsrc/a.js holds the value. Before editing this file, run `node --test`.\n\n## Change coupling\n\nNone.\n\n## What to read first\n\n1. src/a.js: the value.';
const MAP = FM + '\n' + PROSE + '\n';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-via-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  return dir;
}

/* A stub agent CLI. It records its argv, its cwd and its stdin as JSON in
   STUB_LOG, then acts on STUB_MODE: print the reply in STUB_REPLY, sleep,
   fail, or write COMPLEX.md itself before it prints. */
const STUB = `#!/usr/bin/env node
const fs = require('fs');
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.STUB_LOG, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), input }));
  const mode = process.env.STUB_MODE || 'ok';
  if (mode === 'sleep') return setTimeout(() => {}, 60000);
  if (mode === 'fail') { process.stderr.write('not logged in\\n'); process.exit(3); }
  if (mode === 'write') fs.writeFileSync('COMPLEX.md', 'clobbered by the agent\\n');
  process.stdout.write(fs.readFileSync(process.env.STUB_REPLY, 'utf8'));
});
`;

function stubEnv(names, { mode = 'ok', reply = MAP } = {}) {
  const bin = mkdtempSync(join(tmpdir(), 'cx-via-bin-'));
  for (const n of names) {
    writeFileSync(join(bin, n), STUB);
    chmodSync(join(bin, n), 0o755);
  }
  const log = join(bin, 'log.json');
  const replyPath = join(bin, 'reply.txt');
  writeFileSync(replyPath, reply);
  /* PATH holds the stubs and node, nothing else: an agent CLI installed on
     the machine running the tests must never be found and started. */
  symlinkSync(process.execPath, join(bin, 'node'));
  const env = { ...process.env, PATH: bin, STUB_LOG: log, STUB_MODE: mode, STUB_REPLY: replyPath };
  return { env, bin, read: () => JSON.parse(readFileSync(log, 'utf8')) };
}

/* The stand-in agent CLIs are #! scripts. Windows starts no script as a
   program without a shell, and runVia starts a CLI without one, so these
   tests skip there. runVia's Windows lookup and its refusal of a .cmd
   shim are tested on every OS through the platform option. */
const SCRIPT_CLI = process.platform === 'win32' && 'Windows cannot start a #! stand-in CLI without a shell';

test('the table names each supported CLI once, with an argv builder and its docs', () => {
  assert.deepEqual(VIA_NAMES, ['claude', 'codex', 'gemini', 'opencode', 'qwen', 'kimi', 'crush', 'goose', 'cursor-agent', 'copilot', 'hermes', 'openclaw']);
  for (const c of VIA_CLIS) {
    assert.ok(c.bins.length, `${c.name} has a binary name`);
    assert.match(c.docs, /^https:\/\//, `${c.name} cites the page its headless mode comes from`);
    assert.ok(['stdin', 'file'].includes(c.input));
    for (const model of [null, 'some-model']) {
      const inv = viaInvocation(c.name, { model, promptRel: '.complex-md/prompt.md' });
      assert.ok(Array.isArray(inv.args) && inv.args.every((a) => typeof a === 'string'), `${c.name} argv is an array of strings`);
      if (model) assert.ok(inv.args.some((a) => a.includes('some-model')), `${c.name} passes --model`);
    }
  }
});

test('each CLI gets the headless argv its docs give, and no write permission', () => {
  const args = (n, model = null) => viaInvocation(n, { model, promptRel: '.complex-md/prompt.md' }).args;
  assert.deepEqual(args('claude'), ['-p', '--tools', '', '--disallowedTools', 'mcp__*', '--no-session-persistence', '--output-format', 'text']);
  assert.deepEqual(args('claude', 'sonnet').slice(-2), ['--model', 'sonnet']);
  assert.deepEqual(args('codex'), ['exec', '--sandbox', 'read-only', '--ephemeral', '-']);
  assert.deepEqual(args('codex', 'gpt-6').slice(-3), ['--model', 'gpt-6', '-']);
  assert.deepEqual(args('gemini').slice(0, 4), ['--approval-mode', 'plan', '--output-format', 'text']);
  assert.deepEqual(args('qwen').slice(0, 4), ['--approval-mode', 'plan', '--output-format', 'text']);
  assert.deepEqual(args('goose'), ['run', '--instructions', '-', '--no-session', '--quiet']);
  assert.deepEqual(args('openclaw'), ['agent', 'exec', '--message-file', '-']);
  assert.deepEqual(args('copilot'), ['--silent', '--no-ask-user', '--deny-tool=shell,write']);
  assert.equal(args('crush')[0], 'run');
  // hermes: the bundle is the query on stdin, and --source tool keeps the
  // run out of the user's session list. It has no read only mode.
  assert.deepEqual(args('hermes'), ['chat', '--query-file', '-', '--quiet', '--source', 'tool']);
  assert.deepEqual(args('hermes', 'm').slice(-2), ['--model', 'm']);
  // The CLIs that take the prompt only as an argument read the bundle from a file.
  assert.ok(args('opencode').includes('--file') && args('opencode').includes('.complex-md/prompt.md'));
  assert.match(args('kimi').at(-1), /\.complex-md\/prompt\.md/);
  assert.match(args('cursor-agent').at(-1), /\.complex-md\/prompt\.md/);
  assert.ok(args('cursor-agent').includes('--trust'), 'print mode stops on an untrusted workspace without --trust');
  assert.ok(!args('cursor-agent').includes('--force'), 'cursor-agent without --force only proposes changes');
});

test('an unknown CLI name lists every supported one', () => {
  assert.throws(() => viaSelection('aider'), /unknown --via "aider"; one of: claude, codex, gemini/);
  assert.deepEqual(viaSelection('codex', 'gpt-6'), { via: 'codex', name: 'via:codex', model: 'gpt-6' });
});

test('findExecutable searches PATH and, on Windows, PATHEXT', () => {
  const d = mkdtempSync(join(tmpdir(), 'cx-via-path-'));
  writeFileSync(join(d, 'claude.cmd'), '@echo off\n');
  assert.equal(findExecutable(['claude'], { env: { PATH: d, PATHEXT: '.EXE;.CMD' }, platform: 'win32' }), join(d, 'claude.cmd'));
  assert.equal(findExecutable(['claude'], { env: { PATH: d }, platform: 'linux' }), null);
  assert.equal(findExecutable(['nothere'], { env: { PATH: d }, platform: 'linux' }), null);
});

test('extractMap drops a preamble, terminal colors and an outer fence', () => {
  assert.equal(extractMap('Here is the file:\n\n' + MAP), MAP);
  assert.equal(extractMap('\u001b[32mDone.\u001b[0m\n' + MAP), MAP);
  assert.equal(checkMap(extractMap('Done.\n```markdown\n' + MAP + '```\n'), FM, ['src/a.js']).text, MAP);
  assert.equal(extractMap('Sure.\n' + PROSE), PROSE);
});

test('checkMap writes the computed front matter and refuses an invented path', () => {
  const files = ['src/a.js'];
  const altered = MAP.replace('commit: abc1234', 'commit: 0000000');
  const r = checkMap(altered, FM, files);
  assert.equal(r.text, MAP);
  assert.equal(r.frontMatterKept, false);
  assert.equal(checkMap(MAP, FM, files).frontMatterKept, true);
  assert.throws(() => checkMap(MAP.replace('run `node --test`', 'run test/a.test.js'), FM, files), /names 1 path the repository does not have: test\/a\.test\.js; COMPLEX\.md not written/);
  assert.throws(() => checkMap('I cannot do that.', FM, files), /missing required sections/);
});

test('runVia sends the bundle on stdin and returns the checked map', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['claude']);
  const r = await runVia('claude', { root, bundle: 'THE BUNDLE', fm: FM, env: s.env, timeoutMs: 20000 });
  assert.equal(r.text, MAP);
  const seen = s.read();
  assert.match(seen.input, /^THE BUNDLE\n/);
  assert.match(seen.input, /Print the complete COMPLEX\.md to standard output/);
  assert.equal(seen.argv[0], '-p');
  // The child reads its working folder with links resolved: /private/var for /var on macOS.
  assert.equal(seen.cwd, realpathSync.native(root));
});

test('a file mode CLI reads the bundle from .complex-md/prompt.md', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['kimi']);
  await runVia('kimi', { root, bundle: 'THE BUNDLE', fm: FM, env: s.env, timeoutMs: 20000 });
  assert.equal(readFileSync(join(root, '.complex-md/prompt.md'), 'utf8'), 'THE BUNDLE');
  const seen = s.read();
  assert.equal(seen.input, '');
  assert.match(seen.argv.at(-1), /Read the file \.complex-md\/prompt\.md/);
});

test('cursor-agent falls back to the agent binary name', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['agent']);
  const r = await runVia('cursor-agent', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 20000 });
  assert.equal(r.text, MAP);
});

test('a missing binary is a clear error that names it, before anything runs', async () => {
  const root = makeRepo();
  await assert.rejects(runVia('goose', { root, bundle: 'B', fm: FM, env: { PATH: mkdtempSync(join(tmpdir(), 'cx-empty-')) } }), /--via goose: no goose executable on PATH/);
});

test('a Windows .cmd shim is refused: it cannot start without a shell', async () => {
  const d = mkdtempSync(join(tmpdir(), 'cx-via-win-'));
  writeFileSync(join(d, 'gemini.cmd'), '@echo off\n');
  await assert.rejects(runVia('gemini', { root: d, bundle: 'B', fm: FM, env: { PATH: d, PATHEXT: '.CMD' }, platform: 'win32' }), /gemini\.cmd.*without a shell/);
});

test('a CLI that exits non-zero reports its exit code and its last stderr line', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['codex'], { mode: 'fail' });
  await assert.rejects(runVia('codex', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 20000 }), /codex exited with code 3: not logged in/);
});

test('a CLI that does not finish is stopped at the timeout', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['qwen'], { mode: 'sleep' });
  const t0 = Date.now();
  await assert.rejects(runVia('qwen', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 500 }), /qwen did not finish within 0\.5 s/);
  assert.ok(Date.now() - t0 < 10000);
});

test('a reply that names an invented path is refused', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  const s = stubEnv(['gemini'], { reply: MAP.replace('run `node --test`', 'run src/b.test.js') });
  await assert.rejects(runVia('gemini', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 20000 }), /src\/b\.test\.js/);
});

test('a CLI that writes COMPLEX.md itself has the file put back', { skip: SCRIPT_CLI }, async () => {
  const root = makeRepo();
  writeFileSync(join(root, 'COMPLEX.md'), 'the reviewed map\n');
  const s = stubEnv(['goose'], { mode: 'write' });
  const logs = [];
  const r = await runVia('goose', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 20000, log: (l) => logs.push(l) });
  assert.equal(readFileSync(join(root, 'COMPLEX.md'), 'utf8'), 'the reviewed map\n');
  assert.equal(r.text, MAP);
  assert.ok(logs.some((l) => /goose wrote COMPLEX\.md itself; complex-md put the previous file back/.test(l)), logs.join('\n'));
  rmSync(join(root, 'COMPLEX.md'));
  await runVia('goose', { root, bundle: 'B', fm: FM, env: s.env, timeoutMs: 20000 });
  assert.ok(!existsSync(join(root, 'COMPLEX.md')), 'a map the agent created is removed; the caller writes the checked one');
});

test('Ctrl-C on complex-md stops the agent CLI and puts COMPLEX.md back', { skip: SCRIPT_CLI }, async () => {
  // The CLI runs in its own process group, so the terminal's SIGINT reaches
  // only complex-md. Without a handler the agent would keep running, and
  // keep spending, after complex-md exits.
  const root = makeRepo();
  writeFileSync(join(root, 'COMPLEX.md'), 'the reviewed map\n');
  const s = stubEnv([]);
  const pidFile = join(s.bin, 'pid');
  writeFileSync(join(s.bin, 'claude'), `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync('COMPLEX.md', 'clobbered by the agent\\n');
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
setTimeout(() => {}, 60000);
`);
  chmodSync(join(s.bin, 'claude'), 0o755);
  const driver = join(s.bin, 'driver.mjs');
  const viaUrl = new URL('../src/via.js', import.meta.url).href;
  writeFileSync(driver, `import { runVia } from ${JSON.stringify(viaUrl)};
await runVia('claude', { root: ${JSON.stringify(root)}, bundle: 'B', fm: ${JSON.stringify(FM)}, env: { ...process.env, PATH: ${JSON.stringify(s.bin)} }, timeoutMs: 60000 }).catch(() => {});
console.log('runVia returned');
`);
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [driver], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const t0 = Date.now();
  while (!existsSync(pidFile) && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 50));
  assert.ok(existsSync(pidFile), 'the stub started');
  const agentPid = Number(readFileSync(pidFile, 'utf8'));
  child.kill('SIGINT');
  const [code, signal] = await new Promise((r) => child.on('close', (c, sg) => r([c, sg])));
  assert.equal(signal, 'SIGINT', `complex-md exits by the signal it got (code ${code}, stdout ${out})`);
  assert.ok(!out.includes('runVia returned'), 'the run does not go on to the fallback');
  let alive = true;
  for (let i = 0; i < 40 && alive; i++) {
    try {
      process.kill(agentPid, 0);
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      alive = false;
    }
  }
  if (alive) process.kill(agentPid, 'SIGKILL');
  assert.equal(alive, false, 'the agent CLI was stopped with complex-md');
  assert.equal(readFileSync(join(root, 'COMPLEX.md'), 'utf8'), 'the reviewed map\n');
});
