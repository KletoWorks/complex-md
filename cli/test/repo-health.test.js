// The repository's own health files and workflows. A tag such as `@v4` can
// be moved to other code after review, so every action runs from a full
// commit SHA. Runs only inside the repository checkout; the published
// package carries none of these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const workflows = () => (existsSync(WORKFLOWS) ? readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)) : []);

test('every workflow action is pinned by a full commit SHA with its version beside it', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const bad = [];
  for (const f of workflows()) {
    for (const line of readFileSync(join(WORKFLOWS, f), 'utf8').split('\n')) {
      const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/.exec(line);
      if (!m) continue;
      if (m[1].startsWith('./')) continue;
      if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(m[1]) || !/#\s*v\d+\.\d+\.\d+/.test(m[2])) bad.push(`${f}: ${line.trim()}`);
    }
  }
  assert.ok(workflows().length > 0, 'the repository has workflows');
  assert.deepEqual(bad, [], 'pin as owner/repo@<40 hex SHA> # vX.Y.Z');
});

/* A workflow with no permissions block gets the repository's default
   token, which can be read and write. Each workflow states its own. */
test('every workflow declares its token permissions at the top level', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const missing = workflows().filter((f) => !/^permissions:/m.test(readFileSync(join(WORKFLOWS, f), 'utf8')));
  assert.deepEqual(missing, [], 'add a top level permissions: block');
});

const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/* A reporter who finds a hole must find a private path before a public
   one. GitHub shows SECURITY.md on the Security tab and on the new issue
   page. */
test('SECURITY.md gives a private report path and the supported versions', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  assert.ok(existsSync(join(ROOT, 'SECURITY.md')), 'SECURITY.md exists');
  const s = read('SECURITY.md');
  assert.match(s, /https:\/\/github\.com\/KletoWorks\/complex-md\/security\/advisories\/new/);
  assert.match(s, /^## Supported versions/m);
});
