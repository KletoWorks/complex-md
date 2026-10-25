// ci/gitlab/complex-md.gitlab-ci.yml: the job script runs against a fixture
// repository with a stub GitLab API on 127.0.0.1, and this bin in place of
// the npm install. No request leaves the machine. The script is sh for a
// Linux runner, so the run tests skip on Windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { NOTE_MARKER } from '../src/note.js';

const ROOT = join(import.meta.dirname, '..', '..');
const TEMPLATE = join(ROOT, 'ci', 'gitlab', 'complex-md.gitlab-ci.yml');
const BIN = join(import.meta.dirname, '..', 'bin', 'complex-md.js');
const inCheckout = existsSync(TEMPLATE);
const yaml = inCheckout ? readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n') : '';

/* The job's script block and its variables, read without a YAML library:
   the template keeps one `- |` block and plain KEY: "value" variables. */
function jobScript() {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => l === '    - |');
  assert.ok(start > 0, 'the job has one `- |` script block');
  const out = [];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && !l.startsWith('      ')) break;
    out.push(l.slice(6));
  }
  return out.join('\n');
}
function jobVariables() {
  const block = /\n {2}variables:\n((?: {4}.*\n)+)/.exec(yaml)[1];
  return Object.fromEntries([...block.matchAll(/^ {4}([A-Z_]+): "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
}

test('the template runs on merge request pipelines only, pins the CLI and runs no npx', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  assert.match(yaml, /rules:\n {4}- if: \$CI_PIPELINE_SOURCE == "merge_request_event"\n {2}variables:/);
  const v = jobVariables();
  assert.match(v.COMPLEX_MD_VERSION, /^\d+\.\d+\.\d+$/, 'an exact version, not a range or a tag');
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version;
  const n = (s) => s.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0);
  assert.ok(n(v.COMPLEX_MD_VERSION) >= n(pkg), `the pin ${v.COMPLEX_MD_VERSION} is not older than cli/package.json ${pkg}`);
  assert.equal(v.GIT_DEPTH, '0');
  const script = jobScript();
  assert.doesNotMatch(script, /\bnpx\b/, 'npx in the checkout would read the merge request .npmrc');
  assert.match(script, /\(cd "\$work" && npm install [^\n]*--ignore-scripts "complex-md@\$COMPLEX_MD_VERSION"\)/);
  assert.match(script, /env -u "\$token_var" -u CI_JOB_TOKEN \$cli check --base "\$base" --map-ref "origin\/\$target" --note --strict/);
});

const tools = process.platform !== 'win32'
  && spawnSync('sh', ['-c', 'exit 0']).status === 0
  && spawnSync('curl', ['--version']).status === 0;
const skipRun = !inCheckout ? 'not a repository checkout' : process.platform === 'win32' ? 'the job script is sh for a Linux runner' : !tools ? 'needs sh and curl' : false;

const MAP = (commit) => `---
complex_md: "0.3"
generated: 2026-10-01
commit: ${commit}
tool: complex-md/0.11.0
hotspots:
  - path: src/hot.js
    loc: 120
    churn: 17
    fixes: 4
    fan_in: 2
    tests: 2
    score: 1960
co_change:
  - files: [src/hot.js, src/partner.js]
    count: 7
    coupling: 44
---

## Why these files are hot

src/hot.js parses the input. Before editing this file, run \`npm test\`.
`;

/* An origin with a main branch that carries the map, and a clone on a
   merge request branch. */
function fixture() {
  const top = mkdtempSync(join(tmpdir(), 'cx-gitlab-'));
  const origin = join(top, 'origin.git');
  const dir = join(top, 'clone');
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: top, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
  const g = (cwd, ...a) => {
    const r = spawnSync('git', a, { cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const put = (p, s) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
  g(top, 'init', '-q', '--bare', '-b', 'main', origin);
  g(top, 'clone', '-q', origin, dir);
  g(dir, 'checkout', '-qb', 'main');
  for (const p of ['src/hot.js', 'src/partner.js', 'README.md']) put(p, `// ${p}\n`);
  g(dir, 'add', '.');
  g(dir, 'commit', '-qm', 'init');
  put('COMPLEX.md', MAP(g(dir, 'rev-parse', '--short=7', 'HEAD')));
  g(dir, 'add', '.');
  g(dir, 'commit', '-qm', 'map');
  g(dir, 'push', '-q', 'origin', 'main');
  g(dir, 'checkout', '-qb', 'feature');
  g(dir, 'update-ref', '-d', 'refs/remotes/origin/main');
  /* A stand in for the npm install, which also records whether the token
     reached the CLI's environment. */
  const cli = join(top, 'complex-md.sh');
  writeFileSync(cli, `#!/bin/sh\necho "\${COMPLEX_MD_GITLAB_TOKEN-unset} \${CI_JOB_TOKEN-unset}" > "${join(top, 'cli-env.txt')}"\nexec "${process.execPath}" "${BIN}" "$@"\n`);
  chmodSync(cli, 0o755);
  return { top, dir, env, g: (...a) => g(dir, ...a), put, cli };
}

/* A stub of the 3 GitLab endpoints the job calls. notes is the list GET
   returns; every request is recorded. */
async function stubApi({ notes = [], me = 7, deny = false } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), token: req.headers['private-token'], body: raw ? new URLSearchParams(raw).get('body') : null });
      const send = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method === 'GET' && url.pathname === '/api/v4/user') return send(200, { id: me, username: 'project_1_bot' });
      if (url.pathname === '/api/v4/projects/42/merge_requests/5/notes' && req.method === 'GET') {
        const page = Number(url.searchParams.get('page'));
        const per = Number(url.searchParams.get('per_page'));
        return send(200, notes.slice((page - 1) * per, page * per));
      }
      if (deny) return send(403, { message: '403 Forbidden' });
      if (req.method === 'POST' && url.pathname === '/api/v4/projects/42/merge_requests/5/notes') return send(201, { id: 900 });
      if (req.method === 'PUT' && /^\/api\/v4\/projects\/42\/merge_requests\/5\/notes\/\d+$/.test(url.pathname)) return send(200, { id: 1 });
      return send(404, { message: 'not stubbed' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/api/v4`, requests, close: () => new Promise((r) => server.close(r)) };
}

function runJob(fx, api, { token = 'glpat-test' } = {}) {
  const env = {
    ...fx.env,
    ...jobVariables(),
    CI_PIPELINE_SOURCE: 'merge_request_event',
    CI_MERGE_REQUEST_TARGET_BRANCH_NAME: 'main',
    CI_MERGE_REQUEST_PROJECT_ID: '42',
    CI_MERGE_REQUEST_IID: '5',
    CI_API_V4_URL: api.url,
    CI_JOB_TOKEN: 'job-token',
    COMPLEX_MD_CLI: fx.cli,
  };
  if (token) env.COMPLEX_MD_GITLAB_TOKEN = token;
  else delete env.COMPLEX_MD_GITLAB_TOKEN;
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', jobScript()], { cwd: fx.dir, env });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', (status) => resolve({ status, out }));
  });
}

const editHotspot = (fx) => {
  fx.put('src/hot.js', '// changed\n');
  /* The branch empties its own map; the note must still come from main. */
  fx.put('COMPLEX.md', '---\ncomplex_md: "0.3"\n---\n\n## Why these files are hot\n\nnothing.\n');
  fx.g('commit', '-qam', 'edit the hotspot');
};
const writes = (api) => api.requests.filter((r) => r.method !== 'GET');

test('a first push with findings creates one note from the target branch map', { skip: skipRun }, async () => {
  const fx = fixture();
  editHotspot(fx);
  const api = await stubApi({ notes: [{ id: 3, system: true, body: 'added 1 commit', author: { id: 7 } }] });
  try {
    const r = await runJob(fx, api);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /complex-md: note created\./);
    const w = writes(api);
    assert.equal(w.length, 1);
    assert.equal(w[0].method, 'POST');
    assert.equal(w[0].token, 'glpat-test');
    assert.ok(w[0].body.startsWith(NOTE_MARKER + '\n'), w[0].body);
    assert.match(w[0].body, /\*\*COMPLEX\.md\*\*: 1 hotspot touched, 1 co-change partner not in this merge request\./);
    assert.match(w[0].body, /\| `src\/hot\.js` \| 1960 \| 17 \| 4 \| 2 \| 2 \|/);
    assert.match(w[0].body, /Read from `COMPLEX\.md` at `origin\/main`/);
    assert.equal(readFileSync(join(fx.top, 'cli-env.txt'), 'utf8').trim(), 'unset unset', 'the CLI runs without the token or CI_JOB_TOKEN');
  } finally { await api.close(); }
});

test('a later push edits the note this token wrote, found past the first page', { skip: skipRun }, async () => {
  const fx = fixture();
  editHotspot(fx);
  const filler = Array.from({ length: 100 }, (_, i) => ({ id: 100 + i, system: false, body: 'looks good', author: { id: 1 } }));
  const pasted = { id: 300, system: false, body: `${NOTE_MARKER}\nquoted by a person`, author: { id: 1 } };
  const mine = { id: 301, system: false, body: `${NOTE_MARKER}\n**COMPLEX.md**: old`, author: { id: 7 } };
  const api = await stubApi({ notes: [...filler, pasted, mine] });
  try {
    const r = await runJob(fx, api);
    assert.equal(r.status, 0, r.out);
    const w = writes(api);
    assert.deepEqual(w.map((x) => `${x.method} ${x.path}`), ['PUT /api/v4/projects/42/merge_requests/5/notes/301']);
    assert.deepEqual(api.requests.filter((x) => x.path.endsWith('/notes')).map((x) => x.query.page), ['1', '2']);
  } finally { await api.close(); }
});

test('an unchanged note is not written again', { skip: skipRun }, async () => {
  const fx = fixture();
  editHotspot(fx);
  const first = await stubApi();
  let body;
  try {
    await runJob(fx, first);
    body = writes(first)[0].body;
  } finally { await first.close(); }
  const api = await stubApi({ notes: [{ id: 301, system: false, body: body.trimEnd(), author: { id: 7 } }] });
  try {
    const r = await runJob(fx, api);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /note unchanged/);
    assert.deepEqual(writes(api), []);
  } finally { await api.close(); }
});

test('a push that drops the hot files clears the note; with no note it posts nothing', { skip: skipRun }, async () => {
  const fx = fixture();
  fx.put('other.txt', 'x\n');
  fx.g('add', '.');
  fx.g('commit', '-qm', 'other');
  const api = await stubApi({ notes: [{ id: 301, system: false, body: `${NOTE_MARKER}\n**COMPLEX.md**: 1 hotspot touched.`, author: { id: 7 } }] });
  try {
    const r = await runJob(fx, api);
    assert.equal(r.status, 0, r.out);
    const w = writes(api);
    assert.equal(w.length, 1);
    assert.equal(w[0].method, 'PUT');
    assert.match(w[0].body, /no longer touches a hotspot/);
  } finally { await api.close(); }
  const none = await stubApi();
  try {
    const r = await runJob(fx, none);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /no note needed/);
    assert.deepEqual(writes(none), []);
  } finally { await none.close(); }
});

test('with no token variable the note goes to the log and no request is made', { skip: skipRun }, async () => {
  const fx = fixture();
  editHotspot(fx);
  const api = await stubApi();
  try {
    const r = await runJob(fx, api, { token: null });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes(NOTE_MARKER));
    assert.match(r.out, /the variable COMPLEX_MD_GITLAB_TOKEN is not set, so no note was posted/);
    assert.deepEqual(api.requests, []);
  } finally { await api.close(); }
});

test('a token that cannot write notes fails the job with the scope and role it needs', { skip: skipRun }, async () => {
  const fx = fixture();
  editHotspot(fx);
  const api = await stubApi({ deny: true });
  try {
    const r = await runJob(fx, api);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /needs the api scope and the Reporter role/);
  } finally { await api.close(); }
});
