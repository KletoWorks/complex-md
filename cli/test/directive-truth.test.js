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
import { computeSignals, findCoveringTests, testCommandFor } from '../src/signals.js';
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

test('a TypeScript file in a Python repository gets the test command of its own package.json', () => {
  // hkuds/nanobot: webui/src/lib/types.ts was told to run pytest, though
  // webui/package.json runs vitest.
  const dir = repo({
    'pyproject.toml': PYTEST,
    'bot/__init__.py': 'from . import core\n',
    'bot/core.py': pyLines(20),
    'tests/test_core.py': 'from bot import core\n\ndef test_core():\n    assert core.V0 == 0\n',
    'webui/package.json': JSON.stringify({ name: 'webui', main: 'src/main.ts', scripts: { test: 'vitest run' } }),
    'webui/src/main.ts': "import { t0 } from './lib/types';\nimport { a } from './a';\nexport const m = t0 + a;\n",
    'webui/src/a.ts': "import { t1 } from './lib/types';\nexport const a = t1;\n",
    'webui/src/b.ts': "import { t2 } from './lib/types';\nexport const b = t2;\n",
    'webui/src/c.ts': "import { t3 } from './lib/types';\nexport const c = t3;\n",
    'webui/src/lib/types.ts': lines(60, 't'),
  });
  const { sig, map } = mapOf(dir);
  assert.ok(sig.hotspots.some((h) => h.path === 'webui/src/lib/types.ts'), 'types.ts is a hotspot');
  assert.equal(map.directive('webui/src/lib/types.ts'), 'Before editing this file, run the full test suite in `webui` with `npm test`.');
});

test('a Python file gets pytest, not the npm test of a JavaScript suite at the root', () => {
  // debpalash/voicestudio: backend/services/*.py were told to run npm test,
  // which runs only the Electron suite; pytest runs the Python tests.
  const files = {
    'package.json': JSON.stringify({ name: 'studio', scripts: { test: 'bun run --cwd electron test' } }),
    'electron/package.json': JSON.stringify({ name: 'electron', scripts: { test: 'bun test' } }),
    'electron/main.ts': 'export const e = 1;\n',
    'backend/__init__.py': 'from backend.services import model\n',
    'backend/services/__init__.py': '',
    'backend/services/model.py': pyLines(40),
    'backend/api.py': 'from backend.services import model\n',
    'backend/jobs.py': 'from backend.services import model\n',
    'backend/cli.py': 'from backend.services import model\n',
    'tests/test_model.py': 'from backend.services import model\n\ndef test_model():\n    assert model.V0 == 0\n',
  };
  const withPytest = mapOf(repo({ ...files, 'pyproject.toml': PYTEST }));
  assert.ok(withPytest.sig.hotspots.some((h) => h.path === 'backend/services/model.py'), 'model.py is a hotspot');
  assert.equal(withPytest.map.directive('backend/services/model.py'), 'Before editing this file, run the full test suite with `pytest`.');
  // No Python test setup at all: the directive names no command rather than a wrong one.
  const { 'tests/test_model.py': _, ...noPython } = files;
  const bare = mapOf(repo(noPython));
  assert.equal(bare.map.directive('backend/services/model.py'), 'Before editing this file, run the full test suite.');
});

test('testCommandFor takes the nearest setup of the file\'s own language, and null when none fits', () => {
  const dir = repo({
    'package.json': JSON.stringify({ name: 'root', scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    'web/package.json': JSON.stringify({ name: 'web', scripts: { test: 'vitest run' } }),
    'web/src/app.ts': 'export const a = 1;\n',
    'svc/go.mod': 'module example.com/svc\n',
    'svc/main.go': 'package main\n',
    'core/Cargo.toml': '[package]\nname = "core"\n',
    'core/src/lib.rs': 'pub fn f() {}\n',
    'tools/build.js': 'export const b = 1;\n',
    'App.java': 'class App {}\n',
    'scripts/run.py': 'X = 1\n',
  });
  assert.deepEqual(testCommandFor(dir, 'web/src/app.ts'), { command: 'npm test', dir: 'web' });
  assert.deepEqual(testCommandFor(dir, 'svc/main.go'), { command: 'go test ./...', dir: 'svc' });
  assert.deepEqual(testCommandFor(dir, 'core/src/lib.rs'), { command: 'cargo test', dir: 'core' });
  assert.equal(testCommandFor(dir, 'tools/build.js'), null, 'the root test script is the npm placeholder');
  assert.equal(testCommandFor(dir, 'App.java'), null);
  assert.equal(testCommandFor(dir, 'scripts/run.py'), null, 'no pytest setup and no Python test');
});

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
