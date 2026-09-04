// normalizeOutput and validateOutput: the guard between a model reply and
// the COMPLEX.md on disk. Plus the generate() fallback: a failed or
// malformed model call writes the prompt bundle and leaves COMPLEX.md alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { normalizeOutput, validateOutput, REQUIRED_SECTIONS, generate } from '../src/generate.js';

const FM = '---\ncomplex_md: "0.3"\n---\n';
const FULL = '## Where the risk lives\n\nRisk.\n\n## Why these files are hot\n\nHot.\n\n## Change coupling\n\nCoupled.\n\n## What to read first\n\n1. a';

test('validateOutput names every missing section, in spec order', () => {
  assert.deepEqual(validateOutput(FULL), []);
  assert.deepEqual(validateOutput(''), REQUIRED_SECTIONS);
  assert.deepEqual(validateOutput(FULL.replace('## Change coupling', '## Coupling')), ['## Change coupling']);
});

test('normalizeOutput rejects an empty reply', () => {
  assert.throws(() => normalizeOutput('', FM), /no prose/);
  assert.throws(() => normalizeOutput('   \n', FM), /no prose/);
});

test('normalizeOutput rejects an apology instead of a map', () => {
  assert.throws(() => normalizeOutput("I'm sorry, but I cannot produce this file without more context.", FM), /missing required sections "## Where the risk lives", "## Why these files are hot", "## Change coupling", "## What to read first"/);
});

test('normalizeOutput rejects a reply missing one section and names it', () => {
  const partial = FULL.replace(/## What to read first[\s\S]*$/, '');
  assert.throws(() => normalizeOutput(partial, FM), /missing required section "## What to read first"; COMPLEX\.md not written/);
});

test('normalizeOutput keeps fences nested inside an outer fence', () => {
  const inner = FULL.replace('Hot.', 'Hot. Run:\n\n```sh\nnpm test\n```');
  const out = normalizeOutput('```markdown\n' + inner + '\n```', FM);
  assert.equal(out, FM + '\n' + inner + '\n');
  assert.match(out, /```sh\nnpm test\n```/);
});

test('normalizeOutput accepts prose without front matter and prepends the computed one', () => {
  const out = normalizeOutput(FULL, FM);
  assert.equal(out, FM + '\n' + FULL + '\n');
  assert.equal(out.indexOf('---'), 0);
});

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-gen-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 3; i++) {
    writeFileSync(join(dir, 'src/a.js'), `export const a = ${i + 2};\n`);
    g('add', '.');
    g('commit', '-q', '-m', `fix: a (${i})`);
  }
  return dir;
}

async function withFetch(fake, fn) {
  const realFetch = globalThis.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;
  globalThis.fetch = fake;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = realKey;
  }
}

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('generate: a malformed 200 body falls back to the bundle and leaves COMPLEX.md alone', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'COMPLEX.md'), 'KEEP ME\n');
  const logs = [];
  const r = await withFetch(async () => jsonResponse(200, { id: 'x' }), () => generate(dir, { provider: 'anthropic', log: (s) => logs.push(s) }));
  assert.equal(r.written, false);
  assert.match(r.fallback, /malformed response/);
  assert.equal(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), 'KEEP ME\n');
  assert.ok(existsSync(join(dir, '.complex-md/prompt.md')));
  assert.ok(existsSync(join(dir, '.complex-md/front-matter.yaml')));
  assert.ok(logs.some((l) => /model call failed: .*malformed/.test(l)));
});

test('generate: a network error and a non-2xx both fall back with the reason', async () => {
  const dir = makeRepo();
  const net = await withFetch(async () => { throw new TypeError('fetch failed'); }, () => generate(dir, { provider: 'anthropic' }));
  assert.equal(net.written, false);
  assert.equal(net.fallback, 'fetch failed');
  const bad = await withFetch(async () => jsonResponse(529, { error: { message: 'overloaded' } }), () => generate(dir, { provider: 'anthropic' }));
  assert.equal(bad.written, false);
  assert.match(bad.fallback, /Anthropic API 529: overloaded/);
  assert.ok(!existsSync(join(dir, 'COMPLEX.md')));
});

test('generate: a reply without the four sections is not written', async () => {
  const dir = makeRepo();
  const r = await withFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: 'Sorry, no.' }], usage: {} }), () => generate(dir, { provider: 'anthropic' }));
  assert.equal(r.written, false);
  assert.match(r.fallback, /missing required sections/);
  assert.ok(!existsSync(join(dir, 'COMPLEX.md')));
});

test('generate: a complete reply is written with the computed front matter and a timeout signal on the call', async () => {
  const dir = makeRepo();
  let init;
  const r = await withFetch(async (url, i) => { init = i; return jsonResponse(200, { content: [{ type: 'text', text: '---\nbogus: 1\n---\n' + FULL }], usage: { input_tokens: 1, output_tokens: 2 } }); }, () => generate(dir, { provider: 'anthropic' }));
  assert.equal(r.written, true);
  assert.ok(init.signal instanceof AbortSignal, 'fetch was given an abort signal');
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.match(out, /^---\ncomplex_md: "0\.3"\n/);
  assert.ok(!out.includes('bogus'));
  assert.ok(out.endsWith(FULL + '\n'));
});
