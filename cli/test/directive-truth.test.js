// The "Before editing this file" directive of template prose must be true
// on the repository it names. An audit of 20 hosted maps found 11 false
// directives from 3 causes; each test below rebuilds 1 reported case in a
// small file tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { computeSignals, findCoveringTests } from '../src/signals.js';
import { templateMap } from '../src/generate.js';
import { parseComplexMd } from '../src/complexmd.js';

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-truth-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' };
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env });
  g('init', '-q', '-b', 'main');
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return dir;
}

const lines = (n, word) => Array.from({ length: n }, (_, i) => `export const ${word}${i} = ${i};`).join('\n') + '\n';
const pyLines = (n) => Array.from({ length: n }, (_, i) => `V${i} = ${i}`).join('\n') + '\n';

function mapOf(dir) {
  const sig = computeSignals(dir);
  return { sig, map: parseComplexMd(templateMap(dir, sig, 'complex-md/test')) };
}

const PYTEST = '[project]\nname = "bot"\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';

test('a test is never named for a file it does not test: __init__.py, a file with no test, or a same-name file of another package', () => {
  // jamiepine/voicebox named backend/tests/__init__.py; vitejs/vite named
  // packages/plugin-legacy/src/__tests__/index.spec.ts for
  // packages/vite/src/node/server/index.ts. That spec imports '../index',
  // which the graph resolves correctly; the name pass matched the stem
  // "index" anywhere under the same top folder.
  const dir = repo({
    'backend/__init__.py': '',
    'backend/backends/__init__.py': pyLines(30),
    'backend/tests/__init__.py': '',
    'backend/tests/test_designed.py': 'from backend.backends import V0\n\ndef test_designed():\n    assert V0 == 0\n',
    'backend/tests/test_payloads.py': 'from backend.backends import V1\n\nPAYLOAD = {"v": V1}\n',
    'packages/legacy/package.json': JSON.stringify({ name: 'legacy' }),
    'packages/legacy/src/index.ts': lines(10, 'l'),
    'packages/legacy/src/__tests__/index.spec.ts': "import { l0 } from '../index';\nimport { test, expect } from 'vitest';\ntest('l0', () => expect(l0).toBe(0));\n",
    'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
    'packages/vite/src/node/server/index.ts': lines(10, 's'),
  });
  assert.deepEqual(findCoveringTests(dir, 'backend/backends/__init__.py'), ['backend/tests/test_designed.py']);
  assert.deepEqual(findCoveringTests(dir, 'packages/vite/src/node/server/index.ts'), []);
  assert.deepEqual(findCoveringTests(dir, 'packages/legacy/src/index.ts'), ['packages/legacy/src/__tests__/index.spec.ts']);
});
