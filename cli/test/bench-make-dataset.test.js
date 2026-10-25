/* bench/make-dataset.mjs on a fixture history: no network, no model. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, commit } from './fixtures/bench-repo.mjs';

const MAKE = join(import.meta.dirname, '..', '..', 'bench', 'make-dataset.mjs');
const BODY = 'The helper returned the wrong value for an empty input, and every caller passed it on.';

function fixtureHistory() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-make-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  const users = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`lib/m${i}.js`, `import { core } from './core.js';\nexport const m${i} = () => core(${i});\n`]));
  commit(repo, 'feat: core and six users', {
    'package.json': '{"scripts":{"test":"node --test"}}\n',
    'lib/core.js': 'export const core = (x) => x;\n',
    'lib/leaf.js': 'export const leaf = 1;\n',
    'test/core.test.js': "import { core } from '../lib/core.js';\n",
    ...users,
  }, '2026-06-01T10:00:00Z');
  commit(repo, `fix: core handles empty input\n\n${BODY}`, { 'lib/core.js': 'export const core = (x) => x ?? 0;\n' }, '2026-06-05T10:00:00Z');
  commit(repo, `fix: leaf value\n\n${BODY}`, { 'lib/leaf.js': 'export const leaf = 2;\n' }, '2026-06-06T10:00:00Z');
  return { dir, repo };
}

test('--min-fan-in keeps the fixes that changed a file with that many importers and a covering test', () => {
  const { dir, repo } = fixtureHistory();
  try {
    const out = join(dir, 'ds.json');
    const r = spawnSync(process.execPath, [MAKE, repo, '--months', '120', '--min-fan-in', '6', '--min-tests', '1', '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const ds = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(ds.tasks.map((t) => t.title), ['fix: core handles empty input']);
    assert.deepEqual(ds.tasks[0].fan_in, { 'lib/core.js': 6 });
    assert.equal(ds.min_fan_in, 6);
    assert.match(r.stderr, /--min-fan-in 6: 1 of 2/);
    const all = spawnSync(process.execPath, [MAKE, repo, '--months', '120', '--out', out], { encoding: 'utf8' });
    assert.equal(all.status, 0, all.stderr);
    assert.equal(JSON.parse(readFileSync(out, 'utf8')).tasks.length, 2, 'without the flag both fixes stay');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
