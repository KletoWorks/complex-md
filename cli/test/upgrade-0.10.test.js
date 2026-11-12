// A repository that complex-md 0.10.0 wired: a CLAUDE.md with only the 2
// import lines, briefs in folders named after complex-md, and no manifest.
// A wire from this version records that CLAUDE.md, removes the brief
// folders it empties, and unwire then leaves no trace of either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { readManifest } from '../src/manifest.js';
import { OWN_BRIEF_DIRS } from '../src/targets.js';
import { repo } from './fixtures/wire-repo.mjs';

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const LEAD = '# src/a.js\n\nListed in COMPLEX.md as a file where edits are risky.\n';

/* The files 0.10.0 left: its briefs had no generated notice, only the
   front matter, the path as a heading and the lead line. */
function repo010(claude, extra = {}) {
  return repo({
    'AGENTS.md': '# House rules\n',
    'CLAUDE.md': claude,
    '.claude/rules/complex-md/src-a.js-1abc.md': `---\nalwaysApply: false\npaths: src/a.js\n---\n${LEAD}`,
    '.cursor/rules/complex-md/src-a.js-1abc.mdc': `---\ndescription: COMPLEX.md brief for src/a.js\nglobs: src/a.js\nalwaysApply: false\n---\n${LEAD}`,
    '.github/instructions/complex-md/src-a.js-1abc.instructions.md': `---\napplyTo: "src/a.js"\n---\n${LEAD}`,
    ...extra,
  });
}

test('the brief folders named after complex-md are the 3 without a file prefix', () => {
  assert.deepEqual(OWN_BRIEF_DIRS, ['.claude/rules/complex-md', '.cursor/rules/complex-md', '.github/instructions/complex-md']);
});

for (const [name, claude] of [['LF', '@AGENTS.md\n@COMPLEX.md\n'], ['CRLF', '@AGENTS.md\r\n@COMPLEX.md\r\n'], ['no final newline', '@AGENTS.md\n@COMPLEX.md']]) {
  for (const profile of ['minimal', 'full']) {
    test(`a ${profile} wire records the 0.10.0 CLAUDE.md (${name}) and unwire removes it`, () => {
      const dir = repo010(claude);
      wire(dir, { profile });
      assert.equal(read(dir, 'CLAUDE.md'), claude, 'wire does not change it');
      const entry = readManifest(dir).files.find((f) => f.path === 'CLAUDE.md');
      assert.equal(entry?.adopted, '0.10.0');
      assert.ok(!read(dir, '.gitattributes').includes('/CLAUDE.md'), 'the file is not marked as generated');
      wire(dir, { profile });
      assert.ok(readManifest(dir).files.some((f) => f.path === 'CLAUDE.md'), 'a rewire keeps the record');
      const r = unwire(dir);
      assert.ok(r.deleted.includes('CLAUDE.md'));
      assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
      assert.equal(read(dir, 'AGENTS.md'), '# House rules\n');
    });
  }
}

for (const claude of ['# Claude\n@AGENTS.md\n@COMPLEX.md\n', '@AGENTS.md\n@COMPLEX.md\n\n', '@AGENTS.md\n@COMPLEX.md\nUse pnpm.\n']) {
  test(`a CLAUDE.md with 1 more byte stays the user's: ${JSON.stringify(claude)}`, () => {
    const dir = repo010(claude);
    const logs = [];
    wire(dir, { log: (l) => logs.push(l) });
    assert.ok(!readManifest(dir).files.some((f) => f.path === 'CLAUDE.md'));
    assert.ok(logs.some((l) => /^CLAUDE\.md holds the 2 import lines that complex-md 0\.10\.0 wrote, and other text, so it is yours/.test(l)), logs.join('\n'));
    unwire(dir);
    assert.equal(read(dir, 'CLAUDE.md'), claude);
  });
}

test('an adopted CLAUDE.md edited after wire is left in place', () => {
  const dir = repo010('@AGENTS.md\n@COMPLEX.md\n');
  wire(dir, {});
  const edited = '@AGENTS.md\n@COMPLEX.md\nUse pnpm.\n';
  writeFileSync(join(dir, 'CLAUDE.md'), edited);
  const r = unwire(dir);
  assert.ok(r.left.some((e) => e.path === 'CLAUDE.md'));
  assert.equal(read(dir, 'CLAUDE.md'), edited);
});

test('a minimal rewire removes the brief folders it empties', () => {
  const dir = repo010('@AGENTS.md\n@COMPLEX.md\n');
  wire(dir, {});
  for (const d of OWN_BRIEF_DIRS) assert.ok(!existsSync(join(dir, d)), `${d} is gone`);
  assert.ok(existsSync(join(dir, '.claude/rules')), 'the parent folder stays');
});

test('a brief folder that holds another file stays, with that file', () => {
  const dir = repo010('# Claude\n', { '.claude/rules/complex-md/mine.md': 'mine\n' });
  wire(dir, {});
  assert.deepEqual(readdirSync(join(dir, '.claude/rules/complex-md')), ['mine.md']);
  assert.ok(!existsSync(join(dir, '.cursor/rules/complex-md')));
  unwire(dir);
  assert.equal(read(dir, '.claude/rules/complex-md/mine.md'), 'mine\n');
});

test('unwire removes the brief folders that a full rewire filled', () => {
  const dir = repo010('@AGENTS.md\n@COMPLEX.md\n');
  wire(dir, { profile: 'full' });
  assert.ok(readdirSync(join(dir, '.claude/rules/complex-md')).length > 0, 'the full profile writes briefs');
  assert.ok(!(readManifest(dir).dirs || []).includes('.claude/rules/complex-md'), '0.10.0 created the folder, so no manifest records it');
  unwire(dir);
  for (const d of OWN_BRIEF_DIRS) assert.ok(!existsSync(join(dir, d)), `${d} is gone`);
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
});
