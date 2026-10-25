// The manifest is committed, so a cloned repository can carry one that
// someone else wrote. wire, unwire and their dry runs act only on paths
// inside the repository: a listed path that climbs out of it, is
// absolute, passes through a symbolic link or points into .git is
// ignored, whatever hash it carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, mkdtempSync, existsSync, symlinkSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { planUnwire, planWire } from '../src/plan.js';
import { readManifest, MANIFEST_PATH } from '../src/manifest.js';
import { repo, MAP } from './fixtures/wire-repo.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

/* A repository whose manifest lists files outside it, each with the hash
   that matches, and the files it points at. */
function hostile() {
  const dir = repo({ 'AGENTS.md': '# Rules\n' });
  const outside = mkdtempSync(join(tmpdir(), 'cx-outside-'));
  writeFileSync(join(outside, 'secret.txt'), 'secret\n');
  writeFileSync(join(outside, 'conf.json'), '{"a":1}\n');
  mkdirSync(join(outside, 'empty'));
  mkdirSync(join(outside, 'linked'));
  writeFileSync(join(outside, 'linked', 'note.md'), 'note\n');
  symlinkSync(join(outside, 'linked'), join(dir, 'link'));
  const climb = '../'.repeat(30) + outside.replace(/^\//, '');
  const rel = relative(dir, outside);
  const head = readFileSync(join(dir, '.git/HEAD'), 'utf8');
  const manifest = {
    files: [
      { path: `${climb}/secret.txt`, sha256: sha('secret\n') },
      { path: `${rel}/secret.txt`, sha256: sha('secret\n') },
      { path: `${outside}/secret.txt`, sha256: sha('secret\n') },
      { path: 'link/note.md', sha256: sha('note\n') },
      { path: '.git/HEAD', sha256: sha(head) },
      { path: 'a/../../secret.txt', sha256: sha('secret\n') },
    ],
    blocks: [],
    entries: [{ path: `${climb}/conf.json`, kind: 'mcp-json', created: true, added: ['a'] }],
    dirs: [`${climb}/empty`],
  };
  mkdirSync(join(dir, '.complex-md'), { recursive: true });
  writeFileSync(join(dir, MANIFEST_PATH), JSON.stringify(manifest));
  return { dir, outside, head };
}

function untouched({ dir, outside, head }) {
  assert.equal(readFileSync(join(outside, 'secret.txt'), 'utf8'), 'secret\n');
  assert.equal(readFileSync(join(outside, 'conf.json'), 'utf8'), '{"a":1}\n');
  assert.ok(existsSync(join(outside, 'empty')), 'the empty folder outside stays');
  assert.equal(readFileSync(join(outside, 'linked', 'note.md'), 'utf8'), 'note\n');
  assert.equal(readFileSync(join(dir, '.git/HEAD'), 'utf8'), head);
}

test('readManifest drops entries whose path leaves the repository or points into .git', () => {
  const h = hostile();
  const m = readManifest(h.dir);
  assert.deepEqual(m.files.map((f) => f.path), ['link/note.md']);
  assert.deepEqual(m.entries, []);
  assert.deepEqual(m.dirs, []);
  assert.equal(m.rejected.length, 7);
});

test('unwire --dry-run touches nothing outside the repository', () => {
  const h = hostile();
  planUnwire(h.dir);
  untouched(h);
});

test('unwire removes nothing outside the repository and nothing through a link', () => {
  const h = hostile();
  const lines = [];
  unwire(h.dir, { log: (l) => lines.push(l) });
  untouched(h);
  assert.ok(lines.some((l) => /outside the repository/.test(l)), lines.join('\n'));
});

test('wire and its dry run remove nothing outside the repository', () => {
  const h = hostile();
  planWire(h.dir, MAP, {});
  untouched(h);
  wire(h.dir, {});
  untouched(h);
});

test('wire writes nothing through a config folder linked outside the repository', () => {
  const dir = repo({ 'AGENTS.md': '# Rules\n' });
  const outside = mkdtempSync(join(tmpdir(), 'cx-outside-'));
  symlinkSync(outside, join(dir, '.cursor'));
  symlinkSync(outside, join(dir, '.claude'));
  wire(dir, { profile: 'full', agents: ['cursor', 'claude'], hooks: true, mcp: true });
  assert.deepEqual(readdirSync(outside), []);
});

test('a CLAUDE.md that links to AGENTS.md inside the repository is still wired and unwired', () => {
  const dir = repo({ 'AGENTS.md': '# Rules\n' });
  symlinkSync('AGENTS.md', join(dir, 'CLAUDE.md'));
  wire(dir, {});
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /BEGIN complex-md/);
  unwire(dir);
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), '# Rules\n');
});
