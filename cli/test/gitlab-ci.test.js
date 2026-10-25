// The GitLab include file runs its script against a fixture repository and
// a stubbed GitLab API on localhost. No real GitLab call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'complex-md.js');
const CI_FILE = join(here, '..', '..', 'ci', 'gitlab', 'complex-md.gitlab-ci.yml');
const inCheckout = (() => { try { readFileSync(CI_FILE); return true; } catch { return false; } })();
const skip = inCheckout ? false : 'ci/gitlab is not in the published package';

const MAP = `---
complex_md: "0.3"
hotspots:
  - path: src/core.js
    churn: 9
    fixes: 3
    fan_in: 5
    tests: 1
    score: 900
co_change:
  - files: [src/render.js, src/render.css]
    count: 4
    coupling: 100
---

## Where the risk lives

x

## Why these files are hot

src/core.js is the hub. Before editing this file, run test/core.test.js.

## Change coupling

x

## What to read first

1. src/core.js
`;

/* The script is the first item of the job's script list: the lines under
   "- |", indented 6 spaces. */
function jobScript() {
  const lines = readFileSync(CI_FILE, 'utf8').split('\n');
  const start = lines.findIndex((l) => l === '    - |') + 1;
  const body = [];
  for (let i = start; i < lines.length && (lines[i] === '' || lines[i].startsWith('      ')); i++) body.push(lines[i].slice(6));
  return body.join('\n');
}

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

/** An origin whose main has the map, and a clone on a merge request branch that edits `edited`. */
function fixture(edited, { mrMap = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cx-gl-'));
  const origin = join(root, 'origin');
  mkdirSync(join(origin, 'src', ''), { recursive: true });
  git(origin, 'init', '-q', '-b', 'main');
  for (const f of ['src/core.js', 'src/render.js', 'src/render.css', 'src/other.js']) writeFileSync(join(origin, f), '// x\n');
  writeFileSync(join(origin, 'COMPLEX.md'), MAP);
  git(origin, 'add', '-A');
  git(origin, 'commit', '-q', '-m', 'init');
  const work = join(root, 'work');
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'feature');
  for (const f of edited) writeFileSync(join(work, f), '// y\n');
  if (mrMap) writeFileSync(join(work, 'COMPLEX.md'), mrMap);
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'change');
  return { root, work };
}

function stub(initial = []) {
  const notes = [...initial];
  const calls = [];
  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const body = data ? JSON.parse(data) : null;
      calls.push({ method: req.method, url: req.url, token: req.headers['private-token'] || req.headers['job-token'], via: req.headers['private-token'] ? 'private' : 'job', body });
      const m = req.url.match(/\/notes(?:\/(\d+))?(?:\?.*)?$/);
      const send = (code, v) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(v === undefined ? '' : JSON.stringify(v)); };
      if (!m) return send(404, {});
      if (req.method === 'GET') return send(200, notes);
      if (req.method === 'POST') { const n = { id: 100 + notes.length, body: body.body, system: false }; notes.push(n); return send(201, n); }
      const i = notes.findIndex((n) => n.id === Number(m[1]));
      if (i < 0) return send(404, {});
      if (req.method === 'PUT') { notes[i].body = body.body; return send(200, notes[i]); }
      if (req.method === 'DELETE') { notes.splice(i, 1); return send(204); }
      send(405, {});
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, notes, calls, url: `http://127.0.0.1:${server.address().port}/api/v4` })));
}

async function run(work, api, extra = {}) {
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CI_|COMPLEX_MD_)/.test(k))),
    CI_API_V4_URL: api.url, CI_PROJECT_ID: '7', CI_MERGE_REQUEST_IID: '3', CI_MERGE_REQUEST_TARGET_BRANCH_NAME: 'main', CI_JOB_TOKEN: 'job-secret',
    COMPLEX_MD_CMD: `${process.execPath} ${BIN}`, TMPDIR: mkdtempSync(join(tmpdir(), 'cx-gl-tmp-')), GIT_CEILING_DIRECTORIES: dirname(work), ...extra,
  };
  const p = spawn('sh', ['-c', jobScript()], { cwd: work, env });
  let out = '';
  p.stdout.on('data', (c) => (out += c));
  p.stderr.on('data', (c) => (out += c));
  const code = await new Promise((r) => p.on('close', r));
  api.server.close();
  return { code, out };
}

test('a hotspot and an unchanged partner: one note in the action format, created', { skip }, async () => {
  const { work } = fixture(['src/core.js', 'src/render.js']);
  const api = await stub();
  const r = await run(work, api, { COMPLEX_MD_TOKEN: 'proj-secret' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(api.calls.map((c) => c.method), ['GET', 'POST']);
  assert.equal(api.calls[1].token, 'proj-secret');
  assert.equal(api.calls[1].via, 'private');
  const body = api.notes[0].body;
  assert.match(body, /^<!-- complex-md -->\n\*\*COMPLEX\.md\*\*: 1 hotspot touched, 1 co-change partner not in this merge request\./);
  assert.match(body, /\| `src\/core\.js` \| 900 \| 9 \| 3 \| 5 \| \d+ \|/);
  assert.match(body, /- `src\/core\.js`: Before editing this file, run test\/core\.test\.js\./);
  assert.match(body, /\*\*Co-change partners not in this merge request\*\*/);
  assert.match(body, /- `src\/render\.js` changed\. Unchanged: `src\/render\.css` \(4 commits together\)\. Say whether each needs a change\./);
});

test('a later push edits the same note; a clean change clears it', { skip }, async () => {
  const { work } = fixture(['src/core.js']);
  const old = { id: 5, system: false, body: '<!-- complex-md -->\nstale' };
  const api = await stub([{ id: 4, system: false, body: 'someone else' }, old]);
  const r = await run(work, api, { COMPLEX_MD_TOKEN: 'proj-secret' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(api.calls.map((c) => c.method), ['GET', 'PUT']);
  assert.equal(api.notes.length, 2);
  assert.match(api.notes[1].body, /1 hotspot touched/);

  const clean = fixture(['src/other.js']);
  const api2 = await stub([{ id: 9, system: false, body: '<!-- complex-md -->\nstale' }]);
  const r2 = await run(clean.work, api2, { COMPLEX_MD_TOKEN: 'proj-secret' });
  assert.equal(r2.code, 0, r2.out);
  assert.deepEqual(api2.calls.map((c) => c.method), ['GET', 'DELETE']);
  assert.equal(api2.notes.length, 0);
});

test('a clean change with no earlier note posts nothing', { skip }, async () => {
  const { work } = fixture(['src/other.js']);
  const api = await stub();
  const r = await run(work, api, { COMPLEX_MD_TOKEN: 'proj-secret' });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(api.calls.map((c) => c.method), ['GET']);
});

test('the map comes from the target branch, not the merge request', { skip }, async () => {
  const { work } = fixture(['src/core.js'], { mrMap: MAP.replace('score: 900', 'score: 1') });
  const api = await stub();
  const r = await run(work, api, { COMPLEX_MD_TOKEN: 'proj-secret' });
  assert.equal(r.code, 0, r.out);
  assert.match(api.notes[0].body, /\| `src\/core\.js` \| 900 \|/);
});

test('the token variable is the one the user names, and CI_JOB_TOKEN is the fallback', { skip }, async () => {
  const { work } = fixture(['src/core.js']);
  const api = await stub();
  const r = await run(work, api, { COMPLEX_MD_TOKEN_VAR: 'MY_GL_TOKEN', MY_GL_TOKEN: 'mine' });
  assert.equal(r.code, 0, r.out);
  assert.equal(api.calls[0].token, 'mine');

  const api2 = await stub();
  const r2 = await run(work, api2);
  assert.equal(r2.code, 0, r2.out);
  assert.equal(api2.calls[0].via, 'job');
  assert.equal(api2.calls[0].token, 'job-secret');
});

test('a bad token variable name stops the job before any request', { skip }, async () => {
  const { work } = fixture(['src/core.js']);
  const api = await stub();
  const r = await run(work, api, { COMPLEX_MD_TOKEN_VAR: 'X; echo pwned' });
  assert.equal(r.code, 2);
  assert.ok(!/pwned\n/.test(r.out.replace('X; echo pwned', '')));
  assert.equal(api.calls.length, 0);
});

test('a rejected token fails the job with the reason', { skip }, async () => {
  const { work } = fixture(['src/core.js']);
  const api = await stub();
  api.server.removeAllListeners('request');
  api.server.on('request', (req, res) => { res.writeHead(403); res.end('{}'); });
  const r = await run(work, api);
  assert.equal(r.code, 1);
  assert.match(r.out, /GitLab answered 403/);
});

test('the include file runs on merge request pipelines only', { skip }, () => {
  const yml = readFileSync(CI_FILE, 'utf8');
  assert.match(yml, /\$CI_PIPELINE_SOURCE == "merge_request_event"/);
  assert.match(yml, /npx -y complex-md@\$\{COMPLEX_MD_VERSION:-/);
  assert.match(yml, /COMPLEX_MD_VERSION: "\d+\.\d+\.\d+"/);
});
