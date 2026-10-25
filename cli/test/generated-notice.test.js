// A file that complex-md writes whole says so at its top. Front matter must
// open a rule file on its first line for every agent that reads one, so
// there the notice is the first line inside the front matter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { GENERATED_NOTICE, withNotice } from '../src/targets.js';
import { runCheck } from '../src/check.js';

function walk(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === '.git') continue;
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(relative(base, p).split('\\').join('/'));
  }
  return out;
}

test('withNotice puts the notice on line 1, or on line 2 inside front matter', () => {
  assert.equal(withNotice('# Title\n'), `<!-- ${GENERATED_NOTICE} -->\n# Title\n`);
  assert.equal(withNotice('---\npaths: a.js\n---\nbody\n'), `---\n# ${GENERATED_NOTICE}\npaths: a.js\n---\nbody\n`);
});

test('every file wire writes whole carries the notice, and check still finds no drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-gen-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), readFileSync(join(import.meta.dirname, 'fixtures', 'brief-map.md'), 'utf8'));
  writeFileSync(join(dir, 'GEMINI.md'), '# Gemini\n');
  for (const d of ['.claude', '.cursor', '.openhands', '.kiro', '.devin', '.windsurf', '.clinerules', '.agents/rules', '.github/instructions']) mkdirSync(join(dir, d), { recursive: true });
  wire(dir, { agents: ['claude', 'cursor', 'openhands', 'antigravity', 'copilot', 'devin', 'kiro', 'windsurf', 'cline', 'openclaw'], profile: 'full' });
  /* AGENTS.md and GEMINI.md are files the user keeps; what wire puts in
     them is a marked section, and the created AGENTS.md opens on its
     begin marker. */
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8').split('\n')[0], /^<!-- BEGIN complex-md /);
  const written = walk(dir).filter((f) => !['COMPLEX.md', 'GEMINI.md', 'AGENTS.md'].includes(f) && !f.startsWith('.complex-md/') && f !== '.gitattributes');
  assert.ok(written.length > 30, `${written.length} files`);
  for (const f of written) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    const top = lines[0] === '---' ? lines[1] : lines[0];
    assert.ok(top.includes(GENERATED_NOTICE), `${f} starts with the notice: ${top}`);
  }
  assert.deepEqual(runCheck(dir, { files: written }).generated, []);
});
