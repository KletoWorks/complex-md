/* The sandbox an agent runs in: what it can read and where it can connect.
   The namespace tests need root (or user namespaces) and util-linux; they
   skip, saying why, on a host without them. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planMasks, sandboxCommand, sandboxSupport, startProxy, innerPid } from '../../bench/sandbox.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { buildBenchRepo, runHarness, MARKER } from './fixtures/bench-repo.mjs';

const MARK = 'CXSECRET41f0';
const support = sandboxSupport();
const ns = { skip: support.ok ? false : `no sandbox on this host: ${support.reason}` };

function layout() {
  const t = realpathSync(mkdtempSync(join(tmpdir(), 'cx-sbx-')));
  mkdirSync(join(t, 'keep', 'deep'), { recursive: true });
  writeFileSync(join(t, 'keep', 'deep', 'visible.txt'), 'visible\n');
  writeFileSync(join(t, 'keep', 'sibling.txt'), MARK);
  mkdirSync(join(t, 'clone'));
  writeFileSync(join(t, 'clone', 'future.js'), MARK);
  writeFileSync(join(t, 'secret.txt'), MARK);
  symlinkSync(join(t, 'clone'), join(t, 'link'));
  return t;
}

test('the mask plan hides every entry beside the kept path, and leaves symlinks alone', () => {
  const t = layout();
  try {
    const ops = planMasks({ roots: [t], keeps: [join(t, 'keep', 'deep')] });
    const by = Object.fromEntries(ops.map((o) => [o.path, o.op]));
    assert.equal(by[join(t, 'clone')], 'tmpfs');
    assert.equal(by[join(t, 'secret.txt')], 'null');
    assert.equal(by[join(t, 'keep', 'sibling.txt')], 'null');
    assert.equal(by[join(t, 'keep', 'deep')], undefined);
    assert.equal(by[join(t, 'link')], undefined);
    // A root with nothing to keep is hidden whole; a root inside another root adds nothing.
    assert.deepEqual(planMasks({ roots: [join(t, 'clone'), t], keeps: [] }), [{ op: 'tmpfs', path: t }]);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

/* Runs `script` in the sandbox. `during(child)` runs once the child starts. */
function inSandbox(t, script, { keeps = [], allow, during } = {}) {
  return new Promise(async (resolve) => {
    const dir = join(t, 'sbx');
    mkdirSync(dir, { recursive: true });
    const [cmd, args, env, { socket }] = sandboxCommand({ cmd: process.execPath, args: ['-e', script], cwd: join(t, 'keep'), dir, roots: [t], keeps: [join(t, 'keep', 'deep'), ...keeps] });
    const proxy = await startProxy({ socket, allow });
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end('');
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    if (during) during(child);
    child.on('close', async (code) => { await proxy.close(); resolve({ code, out, err, proxy }); });
  });
}

const tryRead = (paths) => `const fs = require('fs'); for (const p of ${JSON.stringify(paths)}) { let s = ''; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { s = e.code; } console.log(p, '=>', s.trim()); }`;

test('inside the sandbox the kept path is readable and nothing beside it is', ns, async () => {
  const t = layout();
  try {
    const { code, out, err } = await inSandbox(t, tryRead([join(t, 'keep', 'deep', 'visible.txt'), join(t, 'secret.txt'), join(t, 'clone', 'future.js'), join(t, 'link', 'future.js'), join(t, 'keep', 'sibling.txt')]));
    assert.equal(code, 0, err);
    assert.match(out, /visible\.txt => visible/);
    assert.doesNotMatch(out, new RegExp(MARK), out);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test('a directory too large to mask entry by entry is replaced whole with the kept path bound back', ns, async () => {
  const t = layout();
  try {
    for (let i = 0; i < 600; i++) writeFileSync(join(t, `junk${i}`), MARK);
    const { code, out, err } = await inSandbox(t, tryRead([join(t, 'keep', 'deep', 'visible.txt'), join(t, 'junk7'), join(t, 'secret.txt')]));
    assert.equal(code, 0, err);
    assert.match(out, /visible\.txt => visible/);
    assert.doesNotMatch(out, new RegExp(MARK), out);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test('the agent cannot unmount a mask or see host processes', ns, async () => {
  const t = layout();
  try {
    const script = `const { spawnSync } = require('child_process'); const fs = require('fs');
      const u = spawnSync('umount', ['-l', ${JSON.stringify(t)}], { encoding: 'utf8' });
      console.log('umount', u.status);
      let s = ''; try { s = fs.readFileSync(${JSON.stringify(join(t, 'secret.txt'))}, 'utf8'); } catch (e) { s = e.code; }
      console.log('after', s);
      console.log('pids', fs.readdirSync('/proc').filter((x) => /^\\d+$/.test(x)).length);
      let r = ''; for (const p of fs.readdirSync('/proc').filter((x) => /^\\d+$/.test(x))) { try { r += fs.readFileSync('/proc/' + p + '/root' + ${JSON.stringify(join(t, 'secret.txt'))}, 'utf8'); } catch {} }
      console.log('via proc', r);`;
    const { code, out, err } = await inSandbox(t, script);
    assert.equal(code, 0, err);
    assert.match(out, /umount [1-9]/);
    assert.doesNotMatch(out, new RegExp(MARK), out);
    assert.ok(Number(/pids (\d+)/.exec(out)[1]) < 10, out);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

function markerServer() {
  return new Promise((res) => {
    const s = createServer((req, r) => r.end(MARK));
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

const fetchBoth = (port) => `
  const net = require('net');
  (async () => {
    let direct = '';
    try { direct = await (await fetch('http://127.0.0.1:${port}/', { signal: AbortSignal.timeout(3000) })).text(); } catch (e) { direct = 'error ' + (e.cause?.code || e.name); }
    console.log('direct', direct);
    const u = new URL(process.env.HTTPS_PROXY);
    const c = net.connect(Number(u.port), u.hostname);
    let got = '';
    c.on('data', (d) => { got += d; if (/^HTTP\\/1\\.1 200/.test(got) && !got.includes('GET-SENT')) { got += 'GET-SENT'; c.write('GET / HTTP/1.1\\r\\nHost: x\\r\\nConnection: close\\r\\n\\r\\n'); } });
    c.on('close', () => console.log('proxy', got.replace(/\\r?\\n/g, ' ')));
    c.on('error', (e) => console.log('proxy error', e.code));
    c.write('CONNECT 127.0.0.1:${port} HTTP/1.1\\r\\nHost: 127.0.0.1:${port}\\r\\n\\r\\n');
  })();`;

test('the network: no route out, and the proxy admits only listed hosts', ns, async () => {
  const t = layout();
  const server = await markerServer();
  const port = server.address().port;
  try {
    const denied = await inSandbox(t, fetchBoth(port));
    assert.equal(denied.code, 0, denied.err);
    assert.match(denied.out, /direct error/);
    assert.match(denied.out, /proxy HTTP\/1\.1 403/);
    assert.doesNotMatch(denied.out, new RegExp(MARK));
    assert.deepEqual([...denied.proxy.denied], [`127.0.0.1:${port}`]);
    // The same request through a proxy that lists the host reaches it: the tunnel works.
    const allowed = await inSandbox(t, fetchBoth(port), { allow: [`127.0.0.1:${port}`] });
    assert.match(allowed.out, new RegExp(`proxy HTTP/1.1 200 .*${MARK}`));
  } finally { server.close(); rmSync(t, { recursive: true, force: true }); }
});

test('a stop signal reaches the agent inside the namespace', ns, async () => {
  const t = layout();
  try {
    const script = "process.on('SIGINT', () => { console.log('got SIGINT'); process.exit(0); }); console.log('up'); setInterval(() => {}, 1000);";
    const { out } = await inSandbox(t, script, {
      during: (child) => child.stdout.once('data', () => setTimeout(() => process.kill(innerPid(child.pid), 'SIGINT'), 200)),
    });
    assert.match(out, /got SIGINT/);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

/* The seeded leak test. The fixture's later commits, its tags, branches,
   stash and notes carry MARKER; so does a server on the host's loopback.
   The probe agent runs in every arm and tries git, the disk around its
   checkout, other processes' roots, a direct request, curl and the proxy. */
function serve(body) {
  return new Promise((res) => { const s = createServer((q, r) => r.end(body)); s.listen(0, '127.0.0.1', () => res(s)); });
}
const probes = (out) => readdirSync(join(out, 'transcripts')).map((t) => [t, readFileSync(join(out, 'transcripts', t), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === 'probe')]);

test('seeded leak test: no arm reaches the future through git, the disk or the network', ns, async () => {
  const fx = buildBenchRepo();
  const server = await serve(`upstream main ${MARKER}`);
  try {
    const env = { CX_PROBE_MARKER: MARKER, CX_PROBE_PATHS: fx.dir, CX_PROBE_URL: `http://127.0.0.1:${server.address().port}/` };
    const { status, stderr, rows, out } = await runHarnessAsync(fx, env);
    assert.equal(status, 0, stderr);
    assert.deepEqual(rows.map((r) => r.arm), ['none', 'front', 'file', 'hooks', 'mcp']);
    for (const r of rows) {
      assert.equal(r.error, null, `${r.arm}: ${r.error}`);
      assert.equal(r.sandbox, true);
      assert.ok(r.net_denied.includes(`127.0.0.1:${server.address().port}`), `${r.arm}: ${r.net_denied}`);
    }
    for (const [t, events] of probes(out)) {
      const routes = events.map((e) => e.route);
      for (const want of ['git log --all', `read ${fx.dir}`, 'fetch direct', 'curl', 'CONNECT through the proxy']) assert.ok(routes.includes(want), `${t}: no ${want} route`);
      assert.deepEqual(events.filter((e) => e.leaked).map((e) => e.route), [], `${t} leaked`);
    }
  } finally { server.close(); rmSync(fx.dir, { recursive: true, force: true }); }
});

test('control: without the sandbox the same probe finds the future on disk and over the network', ns, async () => {
  const fx = buildBenchRepo();
  const server = await serve(`upstream main ${MARKER}`);
  try {
    const env = { CX_PROBE_MARKER: MARKER, CX_PROBE_PATHS: fx.dir, CX_PROBE_URL: `http://127.0.0.1:${server.address().port}/` };
    const { status, stderr, out } = await runHarnessAsync(fx, env, ['--arms', 'none', '--no-sandbox']);
    assert.equal(status, 0, stderr);
    const [[, events]] = probes(out);
    const leaked = events.filter((e) => e.leaked).map((e) => e.route);
    for (const want of [`read ${fx.dir}`, 'fetch direct']) assert.ok(leaked.includes(want), `expected ${want} to leak; leaked: ${leaked}`);
  } finally { server.close(); rmSync(fx.dir, { recursive: true, force: true }); }
});

/* The marker server runs in this process, so the harness must run without
   blocking the event loop: spawnSync would starve the server. */
function runHarnessAsync(fx, env, extra = ['--arms', 'none,front,file,hooks,mcp']) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, 'fixtures', 'run-harness.mjs'), JSON.stringify({ fx, extra: ['--agent', 'probe', '--stop-at', 'none', ...extra], env, sandbox: !extra.includes('--no-sandbox') })], { stdio: ['ignore', 'pipe', 'inherit'] });
    let o = '';
    child.stdout.on('data', (d) => { o += d; });
    child.on('close', () => res(JSON.parse(o)));
  });
}
