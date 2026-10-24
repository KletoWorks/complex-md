// bench/repro/nul-byte.sh prints what each search tool does with a NUL byte
// file. Runs only inside the repository checkout, with rg, GNU grep and git
// on the PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'bench/repro/nul-byte.sh');
const has = (cmd, args, re) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0 && re.test(r.stdout);
};

/* rg finds no match in the file and exits 1. GNU grep counts it as a binary
   match and exits 0. The script printed exit 0 for every tool, because it
   read the status of the variable assignment and not of the search. */
test('the NUL repro prints the exit code of each search', (t) => {
  if (!existsSync(SCRIPT)) return t.skip('not a repository checkout');
  if (!has('rg', ['--version'], /^ripgrep/) || !has('grep', ['--version'], /GNU grep/)) return t.skip('needs rg and GNU grep');
  const env = { ...process.env };
  for (const k of ['CLAUDE_BIN', 'CODEX_BIN', 'CURSOR_AGENT_BIN']) delete env[k];
  const out = execFileSync('bash', [SCRIPT], { encoding: 'utf8', env });
  const exit = (label) => {
    const m = new RegExp(`^\\$ ${label}.*\\n {2}exit: +(\\d+)$`, 'm').exec(out);
    assert.ok(m, `the output has a "${label}" block`);
    return Number(m[1]);
  };
  assert.equal(exit('rg -n /api/widgets +\\(ripgrep'), 1, 'rg finds no match');
  assert.equal(exit('grep -rn /api/widgets \\. +\\(grep \\(GNU'), 0, 'GNU grep reports a binary match');
  assert.equal(exit('git grep -n /api/widgets +\\(git'), 0, 'git grep finds the line');
  assert.match(out, /stdout: routes\.js:2: {2}"\/api\/widgets": listWidgets,/);
});
