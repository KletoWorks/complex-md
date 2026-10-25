// Line endings. A Windows clone with core.autocrlf=true checks text files
// out with CRLF, and some users keep CRLF files in any case. wire writes in
// each file's own line ending, unwire returns the user's bytes, and a CRLF
// checkout is not an edit. These tests run on Linux; they model a Windows
// checkout with git's own conversion, not a Windows file system.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { unwire } from '../src/unwire.js';
import { runCheck } from '../src/check.js';
import { planWire } from '../src/plan.js';
import { readManifest } from '../src/manifest.js';
import { repo, snapshot } from './fixtures/wire-repo.mjs';

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' };
const g = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const crlf = (s) => s.replace(/\n/g, '\r\n');
const mixed = (s) => /\r\n/.test(s) && /(^|[^\r])\n/.test(s);

const CRLF_FILES = {
  'AGENTS.md': crlf('# House rules\n\nNever rebase a shared branch.\n'),
  'CLAUDE.md': crlf('# Claude notes\n\nUse pnpm.\n'),
  'REVIEW.md': crlf('# Review\n\nReport at most five Nits.'),
  '.gitattributes': crlf('*.png binary\n'),
  '.github/copilot-instructions.md': crlf('# Copilot\n'),
  '.claude/settings.json': crlf(JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }, null, 2) + '\n'),
  '.codex/config.toml': crlf('model = "o4"\n'),
  '.cursor': null,
};

for (const profile of ['minimal', 'full']) {
  test(`CRLF user files, core.autocrlf=true: wire --profile ${profile} then unwire leaves every byte`, () => {
    const dir = repo(CRLF_FILES);
    g(dir, 'config', 'core.autocrlf', 'true');
    const before = snapshot(dir);
    wire(dir, { profile, hooks: true, mcp: true, agents: profile === 'full' ? ['claude', 'cursor', 'codex', 'review', 'copilot'] : null });
    for (const f of Object.keys(CRLF_FILES).filter((f) => CRLF_FILES[f] !== null)) {
      assert.ok(!mixed(read(dir, f)), `${f} has one line ending after wire`);
    }
    unwire(dir);
    assert.deepEqual(snapshot(dir), before);
  });
}

/* A wired repository committed on Linux and cloned with core.autocrlf=true:
   user files arrive with CRLF, generated files with LF because of the
   eol=lf entries. Nothing reads as edited, and unwire still works. */
test('a clone with core.autocrlf=true reads the wiring as unedited, rewires to no change, and unwires to the CRLF original', () => {
  const src = repo({ 'AGENTS.md': '# House rules\n\nNever rebase.\n', 'CLAUDE.md': '# Claude\n', '.claude': null, '.claude/keep': '' });
  g(src, 'add', '-A');
  g(src, 'commit', '-q', '-m', 'before wire');
  wire(src, { profile: 'full' });
  g(src, 'add', '-A');
  g(src, 'commit', '-q', '-m', 'wire');

  const clone = join(mkdtempSync(join(tmpdir(), 'cx-crlf-')), 'clone');
  execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=true', src, clone], { env: GIT_ENV });
  assert.match(read(clone, 'AGENTS.md'), /\r\n/, 'the user file is checked out with CRLF');
  const briefs = readdirSync(join(clone, '.claude/rules/complex-md')).map((f) => `.claude/rules/complex-md/${f}`);
  for (const b of [...briefs, 'COMPLEX.md', '.complex-md/manifest.json']) assert.doesNotMatch(read(clone, b), /\r\n/, `${b} stays LF`);

  assert.deepEqual(runCheck(clone, { files: briefs }).generated, [], 'no generated file reads as edited');
  assert.deepEqual(planWire(clone, read(clone, 'COMPLEX.md'), { profile: 'full' }), [], 'a rewire changes nothing');
  assert.equal(g(clone, 'status', '--porcelain'), '');

  const r = unwire(clone);
  assert.deepEqual(r.left, []);
  g(clone, 'stash', '-q', '--include-untracked');
  g(clone, 'checkout', '-q', 'HEAD~1');
  const original = snapshot(clone);
  g(clone, 'checkout', '-q', '-');
  g(clone, 'stash', 'pop', '-q');
  const after = snapshot(clone);
  for (const f of ['AGENTS.md', 'CLAUDE.md']) assert.equal(after.get(f), original.get(f), `${f} matches its CRLF checkout before wire`);
  assert.ok(!after.has('.gitattributes') && !after.has(`${briefs[0]}`), 'generated files are gone');
  assert.equal(readManifest(clone), null);
});
