// The working directory .complex-md/ holds a prompt of about 60 KB. A later
// `git add -A` committed it, because nothing told git to ignore it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ignoresWorkDir, ignoreWorkDir, gitignoreAction } from '../src/gitignore.js';

const dir = () => mkdtempSync(join(tmpdir(), 'cx-ignore-'));

test('a repository with no .gitignore gets one that ignores .complex-md/', () => {
  const d = dir();
  assert.equal(gitignoreAction(d), 'create');
  assert.equal(ignoreWorkDir(d), 'create');
  assert.match(readFileSync(join(d, '.gitignore'), 'utf8'), /^\.complex-md\/$/m);
  assert.equal(gitignoreAction(d), null);
});

test('an existing .gitignore gets one entry appended, after a newline it lacked', () => {
  const d = dir();
  writeFileSync(join(d, '.gitignore'), 'node_modules/');
  assert.equal(ignoreWorkDir(d), 'change');
  const text = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(text.startsWith('node_modules/\n'));
  assert.equal(text.match(/^\.complex-md\/$/gm).length, 1);
  assert.equal(ignoreWorkDir(d), null, 'a second run adds nothing');
  assert.equal(readFileSync(join(d, '.gitignore'), 'utf8'), text);
});

test('each common spelling of the entry counts as present', () => {
  for (const line of ['.complex-md', '.complex-md/', '/.complex-md', '/.complex-md/', '.complex-md/*', '/.complex-md/**']) {
    const d = dir();
    writeFileSync(join(d, '.gitignore'), `dist/\n  ${line}  \n`);
    assert.ok(ignoresWorkDir(d), line);
    assert.equal(ignoreWorkDir(d), null, line);
  }
  const d = dir();
  writeFileSync(join(d, '.gitignore'), '# .complex-md/\n!.complex-md/\n');
  assert.ok(!ignoresWorkDir(d), 'a comment or a negation is not the entry');
  assert.ok(!existsSync(join(d, '.gitignore.bak')));
});
