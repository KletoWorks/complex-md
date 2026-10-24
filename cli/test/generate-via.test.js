// generate --via: the prose comes from a stub agent CLI on PATH, the front
// matter from the tool, and a failed run leaves COMPLEX.md as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { generate } from '../src/generate.js';
import { VIA_NAMES } from '../src/via.js';

const BIN = join(import.meta.dirname, '..', 'bin', 'complex-md.js');
const PROSE = '## Where the risk lives\n\nRisk sits in src/a.js.\n\n## Why these files are hot\n\nsrc/a.js holds the value. Before editing this file, read src/b.js.\n\n## Change coupling\n\nNone.\n\n## What to read first\n\n1. src/a.js: the value.\n';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-genvia-'));
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

/* A stub `claude` that prints the reply file, or exits 3 when STUB_FAIL is
   set. PATH holds only the stub, node and git, so no installed agent runs. */
const GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
function stubPath(reply = PROSE) {
  const bin = mkdtempSync(join(tmpdir(), 'cx-genvia-bin-'));
  writeFileSync(join(bin, 'reply.txt'), reply);
  writeFileSync(join(bin, 'claude'), `#!/usr/bin/env node
const fs = require('fs');
process.stdin.resume();
process.stdin.on('end', () => {
  if (process.env.STUB_FAIL) { process.stderr.write('please log in\\n'); process.exit(3); }
  process.stdout.write(fs.readFileSync(${JSON.stringify(join(bin, 'reply.txt'))}, 'utf8'));
});
`);
  chmodSync(join(bin, 'claude'), 0o755);
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync(GIT, join(bin, 'git'));
  return bin;
}

async function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const posix = process.platform !== 'win32';

test('generate --via writes the computed front matter and the CLI prose', { skip: !posix }, async () => {
  const root = makeRepo();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('--via makes no API call');
  try {
    const r = await withEnv({ PATH: stubPath(), ANTHROPIC_API_KEY: 'set-but-unused' }, () => generate(root, { via: 'claude' }));
    assert.equal(r.written, true);
  } finally {
    globalThis.fetch = realFetch;
  }
  const out = readFileSync(join(root, 'COMPLEX.md'), 'utf8');
  assert.match(out, /^---\ncomplex_md: "0\.3"\n[\s\S]*\n---\n\n## Where the risk lives/);
  assert.ok(out.endsWith(PROSE));
});

test('a failed --via run keeps COMPLEX.md and writes the bundle instead', { skip: !posix }, async () => {
  const root = makeRepo();
  writeFileSync(join(root, 'COMPLEX.md'), 'the reviewed map\n');
  const r = await withEnv({ PATH: stubPath(), STUB_FAIL: '1' }, () => generate(root, { via: 'claude' }));
  assert.equal(r.written, false);
  assert.match(r.fallback, /claude exited with code 3: please log in/);
  assert.equal(readFileSync(join(root, 'COMPLEX.md'), 'utf8'), 'the reviewed map\n');
  assert.ok(existsSync(join(root, '.complex-md/prompt.md')));
});

test('a --via reply that names a missing file is not written', { skip: !posix }, async () => {
  const root = makeRepo();
  const r = await withEnv({ PATH: stubPath(PROSE.replace('read src/b.js', 'read src/c.js')) }, () => generate(root, { via: 'claude' }));
  assert.equal(r.written, false);
  assert.match(r.fallback, /src\/c\.js/);
  assert.ok(!existsSync(join(root, 'COMPLEX.md')));
});

test('the bin passes --via and --via-timeout, and names every CLI in --help', { skip: !posix }, () => {
  const root = makeRepo();
  const env = { ...process.env, PATH: stubPath() };
  const ok = spawnSync(process.execPath, [BIN, 'generate', '--via', 'claude', '--via-timeout', '30', '--no-wire'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stderr, /via: claude/);
  assert.ok(readFileSync(join(root, 'COMPLEX.md'), 'utf8').endsWith(PROSE));
  const bad = spawnSync(process.execPath, [BIN, 'generate', '--via', 'aider'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown --via "aider"; one of: claude, codex/);
  const help = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' }).stdout;
  assert.match(help, /--via <cli>/);
  // The help text is a constant, so the bin starts without loading via.js;
  // this keeps its hand written list equal to the table.
  for (const n of VIA_NAMES) assert.ok(help.includes(n), `--help names ${n}`);
});
