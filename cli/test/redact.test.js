// redact.js: each rule replaces its fake token, code that only names a
// secret stays byte for byte, and buildBundle carries no original value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { redact, redactionLine, entropy, RULES } from '../src/redact.js';
import { buildBundle, frontMatter, templateMap, generate } from '../src/generate.js';
import { computeSignals } from '../src/signals.js';
import { generatePrompt } from '../src/prompts.js';
import { FAKE, ALL_FAKES, leakyFile, leakyRepo } from './fixtures/fake-secrets.mjs';

test('each rule replaces its fake token with the rule placeholder', () => {
  assert.deepEqual(Object.keys(FAKE).sort(), [...RULES].sort(), 'the fixtures cover every rule');
  for (const [rule, values] of Object.entries(FAKE)) {
    for (const v of values) {
      const line = rule === 'generic-assignment' ? `const apiSecret = "${v}";` : `const x = '${v}';`;
      const r = redact(line);
      assert.equal(r.total, 1, `${rule}: 1 match in ${JSON.stringify(line.slice(0, 40))}`);
      assert.deepEqual(r.counts, { [rule]: 1 });
      assert.ok(r.text.includes(`[redacted:${rule}]`), r.text);
      assert.ok(!r.text.includes(v), `${rule}: the value is gone`);
    }
  }
});

test('the assignment rule keeps the name and the quotes, and takes bare values', () => {
  const [v] = FAKE['generic-assignment'];
  assert.equal(redact(`password: "${v}"`).text, 'password: "[redacted:generic-assignment]"');
  assert.equal(redact(`"client_secret": '${v}',`).text, `"client_secret": '[redacted:generic-assignment]',`);
  assert.equal(redact(`GITHUB_TOKEN=${v}\n`).text, 'GITHUB_TOKEN=[redacted:generic-assignment]\n');
  assert.equal(redact(`auth_token := "${v}"`).text, 'auth_token := "[redacted:generic-assignment]"');
  assert.equal(redact(`'apiKey' => '${v}'`).text, "'apiKey' => '[redacted:generic-assignment]'");
});

test('a private key cut off before its END line is still replaced', () => {
  const pem = FAKE['private-key'][0];
  const cut = pem.slice(0, pem.indexOf('-----END'));
  const r = redact(`const k = \`${cut}`);
  assert.equal(r.counts['private-key'], 1);
  assert.ok(!r.text.includes('FAKEfakeFAKEfake'));
});

test('near misses and code that only names a secret stay unchanged', () => {
  const code = [
    "const token = req.headers.authorization;",
    "const password = process.env.DB_PASSWORD;",
    'const apiKey = "${API_KEY}";',
    "secret = 'changeme-1234567890'",
    "tokenCount: 1200000000000,",
    "const key = 'web-article-v1';",
    "dedupeKey: 'booking:b1:created',",
    "primaryKey: \"user_id\",",
    "tokenUri: 'https://oauth2.example.com/token2024',",
    "const secretKey = Buffer.from(raw, 'base64');",
    "password: 'short1'",
    "const sha = 'c3c51d5a8e0fbe0c77692a1234567890abcdef12';",
    "const ghp = 'ghp_tooShort123';",
    "const aws = 'AKIAlowercase0000000';",
    "const stripeTest = 'sk_test_0000';",
    "const head = '-----BEGIN PUBLIC KEY-----';",
    "const notJwt = 'eyJhbGciOi';",
    "x-api-key: process.env.ANTHROPIC_API_KEY",
    '',
  ].join('\n');
  const r = redact(code);
  assert.equal(r.total, 0, r.text);
  assert.equal(r.text, code);
});

test("the CLI's own source and the generation prompt pass through unchanged", () => {
  const files = [];
  for (const d of ['src', 'bin']) for (const f of readdirSync(join(import.meta.dirname, '..', d))) if (f.endsWith('.js')) files.push(join(import.meta.dirname, '..', d, f));
  assert.ok(files.length > 20);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const r = redact(text);
    assert.equal(r.total, 0, `${f}: ${JSON.stringify(r.counts)}`);
    assert.equal(r.text, text);
  }
  assert.equal(redact(generatePrompt()).total, 0);
});

test('entropy is in bits per character', () => {
  assert.equal(entropy('aaaa'), 0);
  assert.equal(entropy('abcd'), 2);
});

test('the log line names rules and counts, never a value', () => {
  assert.equal(redactionLine({ total: 0, counts: {} }), null);
  const r = redact(leakyFile());
  const line = redactionLine(r);
  assert.match(line, /^redacted \d+ secret-shaped values in the prompt bundle \(private-key 1, aws-access-key 2, /);
  for (const v of ALL_FAKES) assert.ok(!line.includes(v));
});

test('buildBundle carries no original value, and the front matter stays computed', () => {
  const dir = leakyRepo();
  const sig = computeSignals(dir);
  assert.ok(sig.hotspots.some((h) => h.path === 'src/a.js'), 'src/a.js is a hotspot');
  const { bundle, frontMatter: fm, redacted } = buildBundle(dir, sig, 'complex-md/test');
  for (const v of ALL_FAKES) assert.ok(!bundle.includes(v), `the bundle holds no ${v.slice(0, 6)}... value`);
  for (const rule of RULES) assert.ok(bundle.includes(`[redacted:${rule}]`), `the bundle names ${rule}`);
  assert.equal(redacted.total, ALL_FAKES.length);
  assert.equal(fm, frontMatter(sig, 'complex-md/test'));
  assert.ok(bundle.includes(fm.trim()), 'the bundle carries the computed front matter verbatim');
  // The rest of the excerpt is the file as written.
  assert.ok(bundle.includes('export function a() { return 1; }\nexport const n = 3;'));
});

test('a bundle with nothing to redact is the same as before', () => {
  const dir = leakyRepo();
  writeFileSync(join(dir, 'src/a.js'), 'export function a() { return 1; }\n');
  const sig = computeSignals(dir);
  const { bundle, redacted } = buildBundle(dir, sig, 'complex-md/test');
  assert.equal(redacted.total, 0);
  assert.ok(bundle.includes('```\nexport function a() { return 1; }\n\n```'));
});

test('the template path writes the same map, and the saved bundle is redacted', async () => {
  const dir = leakyRepo();
  const logs = [];
  const r = await generate(dir, { template: true, log: (s) => logs.push(s) });
  assert.equal(r.prose, 'template');
  const map = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  const tool = map.match(/^tool: (.*)$/m)[1];
  assert.equal(map, templateMap(dir, computeSignals(dir), tool));
  assert.equal(readFileSync(join(dir, '.complex-md/front-matter.yaml'), 'utf8'), frontMatter(computeSignals(dir), tool));
  const prompt = readFileSync(join(dir, '.complex-md/prompt.md'), 'utf8');
  for (const v of ALL_FAKES) assert.ok(!prompt.includes(v));
  for (const v of ALL_FAKES) assert.ok(!logs.join('\n').includes(v), 'no log line holds a value');
  assert.equal(logs.filter((l) => l.startsWith('redacted ')).length, 1, 'one line with the count');
});
