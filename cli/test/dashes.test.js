// Em and en dashes in model prose: 1 repair call rewrites the sentences
// that use one, a replacement handles the rest, and a dash in a code span,
// a path or a code block stays. Every model here is a stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, chmodSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dashSentences, replaceDashes, parseRepair, removeDashes } from '../src/dashes.js';
import { generate, templateMap } from '../src/generate.js';
import { computeSignals } from '../src/signals.js';

const EM = '\u2014';
const EN = '\u2013';
const ANY = /[\u2013\u2014]/;

const HOT = `src/a.js holds the value ${EM} every caller reads it. Before editing this file, run \`npm test -- --grep a${EM}b\`.`;
const PROSE = [
  '## Where the risk lives',
  '',
  `Risk sits in src/a.js. Fixes landed in commits 2${EN}4.`,
  '',
  '## Why these files are hot',
  '',
  HOT,
  '',
  '```sh',
  `echo "a ${EM} b"`,
  '```',
  '',
  '## Change coupling',
  '',
  'None.',
  '',
  '## What to read first',
  '',
  `1. src/a.js: the value${EM}and its history.`,
  '',
].join('\n');

test('dashSentences finds each sentence with a punctuation dash and skips code', () => {
  const found = dashSentences(PROSE).map((s) => s.text);
  assert.deepEqual(found, [
    `Fixes landed in commits 2${EN}4.`,
    `src/a.js holds the value ${EM} every caller reads it.`,
    `src/a.js: the value${EM}and its history.`,
  ]);
  for (const s of dashSentences(PROSE)) assert.equal(PROSE.slice(s.start, s.end), s.text);
  assert.deepEqual(dashSentences(`Run \`a ${EM} b\` and read docs/a${EN}b.md first.`), []);
});

test('replaceDashes uses a comma, a space or "to", and keeps code and paths', () => {
  const r = replaceDashes(PROSE);
  assert.equal(r.count, 3);
  assert.match(r.text, /commits 2 to 4\./);
  assert.match(r.text, /holds the value, every caller reads it\./);
  assert.match(r.text, /the value and its history\./);
  assert.ok(r.text.includes(`\`npm test -- --grep a${EM}b\``), 'a dash in a code span stays');
  assert.ok(r.text.includes(`echo "a ${EM} b"`), 'a dash in a code block stays');
  assert.equal(replaceDashes(`- ${EM} first`).text, '- first');
  assert.equal(replaceDashes(`It ends ${EM}.`).text, 'It ends.');
  assert.equal(replaceDashes(`a, ${EM} b`).text, 'a, b');
  assert.equal(replaceDashes(`see docs/a${EN}b.md`).count, 0);
});

test('parseRepair refuses a rewrite with a dash, a lost code span or a new path', () => {
  const items = dashSentences(`A ${EM} \`x\` is set. B ${EM} c.`);
  assert.equal(items.length, 2);
  assert.deepEqual(parseRepair(`1. A sets \`x\`.\n2. B is c.`, items), ['A sets `x`.', 'B is c.']);
  assert.deepEqual(parseRepair(`1. A sets x.\n2. B ${EM} c.`, items), [null, null]);
  assert.deepEqual(parseRepair('1. A sets `x` in src/z.js.\n', items), [null, null]);
});

test('removeDashes splices the rewrites in and replaces what the repair left', async () => {
  let prompt = null;
  const ask = async (p) => {
    prompt = p;
    return `Here they are:\n1. Fixes landed in commits 2 to 4.\n2. src/a.js holds the value. Every caller reads it.\n3. still ${EM} wrong`;
  };
  const r = await removeDashes(PROSE, { ask });
  for (const s of dashSentences(PROSE)) assert.ok(prompt.includes(s.text), `the request lists "${s.text}"`);
  assert.ok(!prompt.includes('None.'), 'the request lists only the dash sentences');
  assert.equal(r.sentences, 3);
  assert.equal(r.repaired, 2);
  assert.equal(r.replaced, 1);
  assert.match(r.prose, /src\/a\.js holds the value\. Every caller reads it\. Before editing this file/);
  assert.match(r.prose, /the value and its history\./);
  assert.equal(dashSentences(r.prose).length, 0);
  assert.ok(r.prose.includes(`a${EM}b\``) && r.prose.includes(`"a ${EM} b"`));
});

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-dash-'));
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

const reply = (text) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: {} }) });

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

const body = (init) => JSON.parse(init.body).messages[0].content;

test('generate: a provider reply with dashes gets 1 repair call and keeps the front matter', async () => {
  const dir = makeRepo();
  const calls = [];
  const logs = [];
  const r = await withFetch(async (url, init) => {
    calls.push(body(init));
    if (calls.length === 1) return reply(`---\ncomplex_md: "9"\n---\n\n${PROSE}`);
    return reply('1. Fixes landed in commits 2 to 4.\n2. src/a.js holds the value. Every caller reads it.\n3. src/a.js: the value and its history.\n');
  }, () => generate(dir, { provider: 'anthropic', log: (s) => logs.push(s) }));
  assert.equal(r.written, true);
  assert.equal(calls.length, 2);
  assert.ok(!calls[1].includes('complex_md'), 'the repair request carries no front matter');
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  const fm = out.slice(0, out.indexOf('\n---\n') + 5);
  assert.match(fm, /^---\ncomplex_md: "0\.3"\n/);
  assert.match(out, /src\/a\.js holds the value\. Every caller reads it\./);
  assert.ok(out.includes(`\`npm test -- --grep a${EM}b\``), 'a dash in a code span survives');
  assert.ok(out.includes(`echo "a ${EM} b"`), 'a dash in a code block survives');
  assert.equal(dashSentences(out).length, 0);
  assert.ok(logs.some((l) => /^the model rewrote 3 of 3 sentences/.test(l)), logs.join('\n'));
  assert.ok(!logs.some((l) => /^replaced /.test(l)));
});

test('generate: a failed repair call replaces each dash and says how many', async () => {
  const dir = makeRepo();
  let n = 0;
  const logs = [];
  const r = await withFetch(async () => {
    if (++n === 1) return reply(PROSE);
    throw new TypeError('fetch failed');
  }, () => generate(dir, { provider: 'anthropic', log: (s) => logs.push(s) }));
  assert.equal(r.written, true);
  assert.equal(n, 2);
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.match(out, /holds the value, every caller reads it\./);
  assert.match(out, /commits 2 to 4\./);
  assert.ok(out.includes(`a${EM}b\``) && out.includes(`"a ${EM} b"`));
  assert.ok(logs.includes('replaced 3 em or en dashes in the prose with a comma or a space.'), logs.join('\n'));
  assert.ok(logs.some((l) => /dash repair call failed \(fetch failed\)/.test(l)));
});

test('generate: a reply with no dash makes no repair call', async () => {
  const dir = makeRepo();
  let n = 0;
  const clean = replaceDashes(PROSE).text;
  await withFetch(async () => (n++, reply(clean)), () => generate(dir, { provider: 'anthropic' }));
  assert.equal(n, 1);
  assert.ok(readFileSync(join(dir, 'COMPLEX.md'), 'utf8').endsWith(clean));
});

test('template prose has no em dash and no en dash', () => {
  const dir = makeRepo();
  const map = templateMap(dir, computeSignals(dir), 'complex-md/test');
  assert.ok(!ANY.test(map), 'the template map has no dash');
  assert.ok(!ANY.test(readFileSync(join(import.meta.dirname, '..', 'src', 'template.js'), 'utf8')), 'template.js holds no dash');
});

/* A stub `claude` on PATH: the map on the first call, the rewrites on the
   repair call. Windows starts no #! script without a shell. */
const SCRIPT_CLI = process.platform === 'win32' && 'Windows cannot start a #! stand-in CLI without a shell';
const GIT = process.platform === 'win32' ? null : execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

test('generate --via sends the repair to the same CLI', { skip: SCRIPT_CLI }, async () => {
  const dir = makeRepo();
  const bin = mkdtempSync(join(tmpdir(), 'cx-dash-bin-'));
  writeFileSync(join(bin, 'map.txt'), PROSE);
  writeFileSync(join(bin, 'fix.txt'), '1. Fixes landed in commits 2 to 4.\n2. src/a.js holds the value. Every caller reads it.\n');
  writeFileSync(join(bin, 'claude'), `#!/usr/bin/env node
const fs = require('fs');
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  const repair = input.includes('Each numbered sentence below');
  if (repair) fs.writeFileSync(${JSON.stringify(join(bin, 'asked.txt'))}, input);
  process.stdout.write(fs.readFileSync(${JSON.stringify(bin)} + (repair ? '/fix.txt' : '/map.txt'), 'utf8'));
});
`);
  chmodSync(join(bin, 'claude'), 0o755);
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync(GIT, join(bin, 'git'));
  const logs = [];
  const saved = process.env.PATH;
  process.env.PATH = bin;
  try {
    const r = await generate(dir, { via: 'claude', log: (s) => logs.push(s) });
    assert.equal(r.written, true);
  } finally {
    process.env.PATH = saved;
  }
  const asked = readFileSync(join(bin, 'asked.txt'), 'utf8');
  assert.match(asked, /Print only the reply that the text asks for/);
  assert.ok(!asked.includes('Print the complete COMPLEX.md'));
  const out = readFileSync(join(dir, 'COMPLEX.md'), 'utf8');
  assert.match(out, /src\/a\.js holds the value\. Every caller reads it\./);
  assert.match(out, /the value and its history\./, 'the sentence the CLI skipped is replaced');
  assert.equal(dashSentences(out).length, 0);
  assert.ok(logs.includes('replaced 1 em or en dash in the prose with a comma or a space.'), logs.join('\n'));
});
