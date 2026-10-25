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
const DASH_PROSE = FULL.replace('Risk.', 'Risk — sits in src/a.js.').replace('1. a', '1. a `x — y`');

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

/* A failed model call never writes the reply. With no map whose prose a
   model or a person wrote, the run lands template prose instead. */
function assertTemplateFallback(dir, r) {
  assert.equal(r.written, true);
  assert.equal(r.prose, 'template');
  assert.ok(r.fallback, 'the failure reason is returned');
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.match(out, /^prose: template$/m);
  assert.ok(!out.includes(FULL), 'the failed reply is not in the map');
  assert.ok(existsSync(join(dir, '.complex-md/prompt.md')));
}

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
  assertTemplateFallback(dir, net);
  assert.equal(net.fallback, 'fetch failed');
  const bad = await withFetch(async () => jsonResponse(529, { error: { message: 'overloaded' } }), () => generate(dir, { provider: 'anthropic' }));
  assertTemplateFallback(dir, bad);
  assert.match(bad.fallback, /Anthropic API 529: overloaded/);
});

test('generate: a reply without the four sections is not written', async () => {
  const dir = makeRepo();
  const r = await withFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: 'Sorry, no.' }], usage: {} }), () => generate(dir, { provider: 'anthropic' }));
  assertTemplateFallback(dir, r);
  assert.match(r.fallback, /missing required sections/);
  assert.ok(!readFileSync(join(dir, 'COMPLEX.md'), 'utf8').includes('Sorry, no.'));
});

test('generate: a failed call warns with the stop reason and lands template prose', async () => {
  const dir = makeRepo();
  const logs = [];
  const r = await withFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: FULL }], stop_reason: 'max_tokens', usage: { output_tokens: 16000 } }), () => generate(dir, { provider: 'anthropic', log: (s) => logs.push(s) }));
  assertTemplateFallback(dir, r);
  assert.ok(logs.some((l) => /^warning: model call failed \(.*stop_reason max_tokens.*\); wrote COMPLEX\.md with template prose instead/.test(l)), logs.join('\n'));
});

test('generate: a keyed run tells approve that the map waits for the model call', async () => {
  const dir = makeRepo();
  let seen = null;
  await withFetch(async () => { throw new Error('no call expected'); }, () => generate(dir, { provider: 'anthropic', approve: async (plan) => { seen = plan; return false; } }));
  assert.equal(seen.keyed, true);
  let local = null;
  await generate(dir, { template: true, approve: async (plan) => { local = plan; return false; } });
  assert.equal(local.keyed, false);
});

test('generate: a failed call replaces a map that a template wrote, never one a model wrote', async () => {
  const dir = makeRepo();
  await withFetch(async () => { throw new TypeError('fetch failed'); }, () => generate(dir, { provider: 'anthropic' }));
  const again = await withFetch(async () => { throw new TypeError('fetch failed'); }, () => generate(dir, { provider: 'anthropic' }));
  assertTemplateFallback(dir, again);
  writeFileSync(join(dir, 'COMPLEX.md'), FM + '\n' + FULL + '\n');
  const kept = await withFetch(async () => { throw new TypeError('fetch failed'); }, () => generate(dir, { provider: 'anthropic' }));
  assert.equal(kept.written, false);
  assert.equal(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), FM + '\n' + FULL + '\n');
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

test('generate: repairs only dash sentences and keeps code-span dashes', async () => {
  const dir = makeRepo();
  let calls = 0;
  let repairPrompt;
  const r = await withFetch(async (url, init) => {
    calls++;
    if (calls === 1) return jsonResponse(200, { content: [{ type: 'text', text: DASH_PROSE }], usage: { input_tokens: 2, output_tokens: 3 } });
    repairPrompt = JSON.parse(init.body).messages[0].content;
    return jsonResponse(200, { content: [{ type: 'text', text: JSON.stringify(['Risk sits in src/a.js.']) }], usage: { input_tokens: 5, output_tokens: 7 } });
  }, () => generate(dir, { provider: 'anthropic' }));
  assert.equal(calls, 2);
  assert.ok(repairPrompt.includes('Risk — sits in src/a.js.'));
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.ok(out.endsWith(DASH_PROSE.replace('Risk — sits in src/a.js.', 'Risk sits in src/a.js.') + '\n'));
  assert.ok(out.includes('`x — y`'));
  assert.equal(r.usage.input, 7);
  assert.equal(r.usage.output, 10);
});

test('generate: replaces dashes that remain after the repair reply and reports the count', async () => {
  const dir = makeRepo();
  const logs = [];
  const stillDashes = DASH_PROSE.replace('Hot.', 'Hot: alpha—beta.');
  let calls = 0;
  await withFetch(async () => {
    calls++;
    const text = calls === 1
      ? stillDashes
      : JSON.stringify(['Risk — sits in src/a.js.', 'Hot: alpha—beta.']);
    return jsonResponse(200, { content: [{ type: 'text', text }], usage: {} });
  }, () => generate(dir, { provider: 'anthropic', log: (line) => logs.push(line) }));
  assert.equal(calls, 2);
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.ok(out.endsWith(stillDashes.replace('Risk — sits in src/a.js.', 'Risk, sits in src/a.js.').replace('alpha—beta', 'alpha beta') + '\n'));
  assert.ok(out.includes('`x — y`'));
  assert.ok(logs.includes('dash repair fallback: replaced 2 punctuation dashes with commas or spaces.'));
});

// A reply cut at the output cap can still carry all four headings, so the
// section check alone would write a truncated map. The stop reason decides.
test('generate: the Anthropic call asks for a 16,000 token output cap', async () => {
  const dir = makeRepo();
  let body;
  await withFetch(async (url, i) => { body = JSON.parse(i.body); return jsonResponse(200, { content: [{ type: 'text', text: FULL }], stop_reason: 'end_turn', usage: {} }); }, () => generate(dir, { provider: 'anthropic' }));
  assert.equal(body.max_tokens, 16000);
});

test('generate: an Anthropic reply stopped at max_tokens is never written, even with all four sections', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'COMPLEX.md'), 'KEEP ME\n');
  const logs = [];
  const r = await withFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: FULL + '\n2. src/b' }], stop_reason: 'max_tokens', usage: { input_tokens: 9, output_tokens: 16000 } }), () => generate(dir, { provider: 'anthropic', log: (s) => logs.push(s) }));
  assert.equal(r.written, false);
  assert.match(r.fallback, /reply stopped at the 16000 token output cap \(stop_reason max_tokens, 16000 output tokens\)/);
  assert.equal(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), 'KEEP ME\n');
  assert.ok(logs.some((l) => /model call failed: .*max_tokens/.test(l)));
});

test('generate: an Anthropic refusal is not written', async () => {
  const dir = makeRepo();
  const r = await withFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: FULL }], stop_reason: 'refusal', usage: {} }), () => generate(dir, { provider: 'anthropic' }));
  assertTemplateFallback(dir, r);
  assert.match(r.fallback, /stop_reason refusal/);
});

test('generate: an OpenAI-compatible reply with finish_reason length is never written', async () => {
  const dir = makeRepo();
  const realKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  try {
    const r = await withFetch(async () => jsonResponse(200, { choices: [{ message: { content: FULL }, finish_reason: 'length' }], usage: { completion_tokens: 4096 } }), () => generate(dir, { provider: 'openai' }));
    assertTemplateFallback(dir, r);
    assert.match(r.fallback, /openai API: reply stopped at the provider's output limit \(finish_reason length, 4096 output tokens\)/);
    const ok = await withFetch(async () => jsonResponse(200, { choices: [{ message: { content: FULL }, finish_reason: 'stop' }], usage: {} }), () => generate(dir, { provider: 'openai' }));
    assert.equal(ok.written, true);
  } finally {
    if (realKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = realKey;
  }
});

/* Every provider key the resolver reads, cleared for one call, so a key in
   the developer's own shell cannot turn a no-key test into a model call. */
const KEY_ENV = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY', 'MOONSHOT_API_KEY', 'DASHSCOPE_API_KEY', 'ZAI_API_KEY', 'MINIMAX_API_KEY', 'FIREWORKS_API_KEY', 'CEREBRAS_API_KEY', 'COMPLEX_MD_API_KEY', 'COMPLEX_MD_BASE_URL', 'COMPLEX_MD_PROVIDER', 'COMPLEX_MD_MODEL'];
async function withoutKeys(fn) {
  const saved = Object.fromEntries(KEY_ENV.map((k) => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  for (const k of KEY_ENV) delete process.env[k];
  globalThis.fetch = async () => { throw new Error('a no-key run called fetch'); };
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

test('generate with no key writes COMPLEX.md with the computed front matter and template prose', async () => {
  const dir = makeRepo();
  const r = await withoutKeys(() => generate(dir));
  assert.equal(r.written, true);
  assert.equal(r.prose, 'template');
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  const fm = readFileSync(join(dir, '.complex-md/front-matter.yaml'), 'utf8');
  assert.equal(out.slice(0, out.indexOf('\n---\n') + 5), fm.replace(/^(tool: .*\n)/m, '$1prose: template\n'));
  assert.deepEqual(validateOutput(out), []);
  assert.match(out, /Before editing this file, /);
});

test('generate with no key gives byte identical output for the same commit', async () => {
  const dir = makeRepo();
  await withoutKeys(() => generate(dir));
  const first = readFileSync(join(dir, 'COMPLEX.md'));
  await withoutKeys(() => generate(dir));
  assert.ok(first.equals(readFileSync(join(dir, 'COMPLEX.md'))));
});

test('generate with no key keeps a COMPLEX.md whose prose did not come from the template', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'COMPLEX.md'), FM + '\n' + FULL + '\n');
  const logs = [];
  const r = await withoutKeys(() => generate(dir, { log: (s) => logs.push(s) }));
  assert.equal(r.written, false);
  assert.equal(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), FM + '\n' + FULL + '\n');
  assert.ok(existsSync(join(dir, '.complex-md/prompt.md')));
  assert.ok(logs.some((l) => /--template/.test(l)));
});

test('generate --template replaces any prose, and makes no model call with a key set', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'COMPLEX.md'), FM + '\n' + FULL + '\n');
  let calls = 0;
  const r = await withFetch(async () => { calls++; return jsonResponse(500, {}); }, () => generate(dir, { template: true }));
  assert.equal(calls, 0);
  assert.equal(r.written, true);
  assert.match(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), /^prose: template$/m);
});

test('a run that writes .complex-md/ adds it to .gitignore once', async () => {
  const dir = makeRepo();
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
  await withoutKeys(() => generate(dir));
  await withoutKeys(() => generate(dir, { agent: true }));
  const text = readFileSync(join(dir, '.gitignore'), 'utf8');
  assert.equal(text.match(/^\.complex-md\/\*$/gm)?.length, 1);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }).includes('.complex-md/'), false);
});

test('generate --agent still writes only the prompt bundle', async () => {
  const dir = makeRepo();
  const r = await withoutKeys(() => generate(dir, { agent: true }));
  assert.equal(r.written, false);
  assert.ok(!existsSync(join(dir, 'COMPLEX.md')));
  assert.ok(existsSync(join(dir, '.complex-md/prompt.md')));
});
