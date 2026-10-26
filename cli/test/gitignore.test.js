// The working directory .complex-md/ holds a prompt of about 60 KB. A later
// `git add -A` committed it, because nothing told git to ignore it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ignoresWorkDir, ignoreWorkDir, gitignoreAction, keepExposureConfig } from '../src/gitignore.js';

const dir = () => mkdtempSync(join(tmpdir(), 'cx-ignore-'));

test('a repository with no .gitignore gets one that ignores .complex-md/', () => {
  const d = dir();
  assert.equal(gitignoreAction(d), 'create');
  assert.equal(ignoreWorkDir(d), 'create');
  assert.match(readFileSync(join(d, '.gitignore'), 'utf8'), /^\.complex-md\/\*$/m);
  assert.equal(gitignoreAction(d), null);
});

test('an existing .gitignore gets one entry appended, after a newline it lacked', () => {
  const d = dir();
  writeFileSync(join(d, '.gitignore'), 'node_modules/');
  assert.equal(ignoreWorkDir(d), 'change');
  const text = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(text.startsWith('node_modules/\n'));
  assert.equal(text.match(/^\.complex-md\/\*$/gm).length, 1);
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

test('the entry ignores the working files and leaves .complex-md/bounds.json to commit', () => {
  const d = dir();
  execFileSync('git', ['init', '-q'], { cwd: d });
  ignoreWorkDir(d);
  mkdirSync(join(d, '.complex-md'));
  for (const f of ['prompt.md', 'front-matter.yaml', 'report.html', 'bounds.json']) writeFileSync(join(d, '.complex-md', f), '{}\n');
  const untracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: d, encoding: 'utf8' });
  assert.match(untracked, /^\?\? \.complex-md\/bounds\.json$/m, 'bounds.json is an engineer file that CI reads');
  assert.ok(!/prompt\.md|front-matter\.yaml|report\.html/.test(untracked), untracked);
});

test('an entry written before exposure.json existed gets its keep line once', () => {
  const d = dir();
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, '.gitignore'), 'dist/\n.complex-md/*\n!.complex-md/bounds.json\n!.complex-md/manifest.json');
  assert.equal(keepExposureConfig(d), 'added');
  const text = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(text.endsWith('!.complex-md/manifest.json\n!.complex-md/exposure.json\n'), text);
  assert.equal(keepExposureConfig(d), null, 'a second run adds nothing');
  assert.equal(readFileSync(join(d, '.gitignore'), 'utf8'), text);
  mkdirSync(join(d, '.complex-md'));
  for (const f of ['exposure.json', 'exposure-report.json', 'exposure.sarif']) writeFileSync(join(d, '.complex-md', f), '{}\n');
  const untracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: d, encoding: 'utf8' });
  assert.match(untracked, /^\?\? \.complex-md\/exposure\.json$/m);
  assert.doesNotMatch(untracked, /exposure-report|exposure\.sarif/);
});

test('no keep line is written where it cannot work or is not needed', () => {
  const whole = dir();
  writeFileSync(join(whole, '.gitignore'), '.complex-md/\n');
  assert.equal(keepExposureConfig(whole), 'blocked', 'git never looks inside an ignored folder');
  assert.equal(readFileSync(join(whole, '.gitignore'), 'utf8'), '.complex-md/\n');
  const none = dir();
  writeFileSync(join(none, '.gitignore'), 'dist/\n');
  assert.equal(keepExposureConfig(none), null, 'no entry, nothing to keep');
  const fresh = dir();
  ignoreWorkDir(fresh);
  assert.match(readFileSync(join(fresh, '.gitignore'), 'utf8'), /^!\.complex-md\/exposure\.json$/m, 'a new entry has the line already');
  assert.equal(keepExposureConfig(fresh), null);
});
