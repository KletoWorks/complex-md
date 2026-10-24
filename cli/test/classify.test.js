// Classification fixtures: a file tree in, the kind of each file and the
// covering tests out. Each case runs buildGraph on a temp dir with no git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGraph } from '../src/graph.js';

function graphOf(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-kind-'));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(p)), { recursive: true });
    writeFileSync(join(dir, p), content);
  }
  return buildGraph(dir, Object.keys(files));
}

const testsOf = (g, f) => [...(g.tests.get(f) || [])].sort();

test('flask layout: testing.py is library source, not the covering test of app.py', () => {
  const g = graphOf({
    'src/flask/__init__.py': 'from .app import Flask\n',
    'src/flask/app.py': 'class Flask: pass\n',
    'src/flask/testing.py': 'from .app import Flask\nclass FlaskClient: pass\n',
    'tests/test_basic.py': 'from flask.app import Flask\n',
  });
  assert.equal(g.kinds.get('src/flask/testing.py'), 'source');
  assert.deepEqual(testsOf(g, 'src/flask/app.py'), ['tests/test_basic.py']);
  assert.ok(g.fanIn.get('src/flask/app.py').has('src/flask/testing.py'), 'library code that imports app.py counts as a dependent');
});

test('go helper packages: testutil.go and testhelpers.go are source', () => {
  const g = graphOf({
    'internal/testutil/testutil.go': 'package testutil\n',
    'pkg/testhelpers.go': 'package pkg\n',
    'pkg/server_test.go': 'package pkg\n',
  });
  assert.equal(g.kinds.get('pkg/testhelpers.go'), 'source');
  assert.equal(g.kinds.get('pkg/server_test.go'), 'test');
});

test('test helpers inside test directories are never named as covering tests', () => {
  const g = graphOf({
    'src/pkg/__init__.py': '',
    'src/pkg/core.py': 'X = 1\n',
    'src/pkg/utils.py': 'Y = 1\n',
    'conftest.py': 'from pkg.core import X\n',
    'tests/conftest.py': 'from pkg.core import X\n',
    'tests/test_utils.py': 'from pkg.core import X\n',
    'tests/helpers.py': 'from pkg.core import X\n',
    'tests/test_core.py': 'from pkg.core import X\n',
    'spec/spec_helper.rb': "require_relative '../lib/thing'\n",
    'lib/thing.rb': 'class Thing; end\n',
  });
  assert.deepEqual(testsOf(g, 'src/pkg/core.py'), ['tests/test_core.py']);
  assert.deepEqual(testsOf(g, 'src/pkg/utils.py'), [], 'tests/test_utils.py is a helper, not a name-adjacent test of utils.py');
  assert.deepEqual(testsOf(g, 'lib/thing.rb'), []);
  assert.equal(g.kinds.get('conftest.py'), 'test', 'conftest.py stays out of the ranking');
  assert.equal(g.kinds.get('tests/helpers.py'), 'test');
});

test('a test file name with underscores outside a test directory is still a test', () => {
  const g = graphOf({
    'pkg/core.py': 'X = 1\n',
    'pkg/test_core_edge.py': 'from pkg.core import X\n',
  });
  assert.equal(g.kinds.get('pkg/test_core_edge.py'), 'test');
  assert.deepEqual(testsOf(g, 'pkg/core.py'), ['pkg/test_core_edge.py']);
});

test('pytest python_files decides: a configured pattern makes a helper name a test', () => {
  const g = graphOf({
    'pyproject.toml': '[project]\nname = "x"\n\n[tool.pytest.ini_options]\npython_files = ["check_*.py", "testing.py"]\n',
    'src/x/__init__.py': '',
    'src/x/core.py': 'X = 1\n',
    'src/x/testing.py': 'from x.core import X\n',
    'src/x/check_core.py': 'from x.core import X\n',
  });
  assert.equal(g.kinds.get('src/x/testing.py'), 'test');
  assert.equal(g.kinds.get('src/x/check_core.py'), 'test');
  assert.deepEqual(testsOf(g, 'src/x/core.py'), ['src/x/check_core.py', 'src/x/testing.py']);
});

test('pytest.ini and setup.cfg python_files, multi-line form', () => {
  const ini = graphOf({
    'pytest.ini': '[pytest]\npython_files =\n    test_*.py\n    verify_*.py\n',
    'app/verify_api.py': 'import os\n',
  });
  assert.equal(ini.kinds.get('app/verify_api.py'), 'test');
  const cfg = graphOf({
    'setup.cfg': '[metadata]\nname = x\n\n[tool:pytest]\npython_files = it_*.py\n',
    'app/it_flow.py': 'import os\n',
  });
  assert.equal(cfg.kinds.get('app/it_flow.py'), 'test');
});

test('source under data/ ranks; data files under data/ do not', () => {
  const g = graphOf({
    'src/data/loader.ts': "export const load = () => 1;\n",
    'src/app.ts': "import { load } from './data/loader';\n",
    'data/catalog.json': '{}\n',
    'data/rows.csv': 'a,b\n',
    'fixtures/user.js': 'module.exports = {};\n',
    'test/fixtures/a.js': 'module.exports = {};\n',
  });
  assert.equal(g.kinds.get('src/data/loader.ts'), 'source');
  assert.ok(g.fanIn.get('src/data/loader.ts').has('src/app.ts'));
  assert.equal(g.kinds.get('data/catalog.json'), 'data');
  assert.equal(g.kinds.get('data/rows.csv'), 'data');
  assert.equal(g.kinds.get('fixtures/user.js'), 'data', 'fixture directories stay data');
});

test('a tracked build/ directory of scripts ranks; a declared output directory stays generated', () => {
  const g = graphOf({
    'package.json': '{ "name": "lib", "main": "out/index.js", "files": ["out"] }',
    'build/release.js': "import { bump } from './bump.js';\n",
    'build/bump.js': 'export const bump = 1;\n',
    'out/index.js': 'module.exports = 1;\n',
    'dist/lib.js': 'module.exports = 1;\n',
  });
  assert.equal(g.kinds.get('build/release.js'), 'source');
  assert.equal(g.kinds.get('build/bump.js'), 'source');
  assert.ok(g.fanIn.get('build/bump.js').has('build/release.js'));
  assert.equal(g.kinds.get('out/index.js'), 'generated', 'package.json main points into out/');
  assert.equal(g.kinds.get('dist/lib.js'), 'generated');
});

test('build/ named as output by tsconfig outDir or package exports stays generated', () => {
  const g = graphOf({
    'tsconfig.json': '{ "compilerOptions": { "outDir": "./build" } }',
    'build/index.js': 'module.exports = 1;\n',
    'packages/ui/package.json': '{ "exports": { ".": { "import": "./build/index.mjs" } } }',
    'packages/ui/build/index.mjs': 'export default 1;\n',
    'packages/ui/src/index.ts': 'export default 1;\n',
  });
  assert.equal(g.kinds.get('build/index.js'), 'generated');
  assert.equal(g.kinds.get('packages/ui/build/index.mjs'), 'generated');
  assert.equal(g.kinds.get('packages/ui/src/index.ts'), 'source');
});

test('a NUL byte in a script under a build/ directory that is not output is still reported', () => {
  const g = graphOf({
    'package.json': '{ "name": "x", "main": "dist/index.js" }',
    'build/release.js': "const SEP = '\u0000';\n",
    'dist/index.js': "const SEP = '\u0000';\n",
  });
  assert.deepEqual(g.grepBlind, ['build/release.js']);
});

test('tests.rs, tests.js and test.go stay tests', () => {
  const g = graphOf({
    'src/parser/tests.rs': '',
    'lib/tests.js': '',
    'cmd/test.go': 'package main\n',
  });
  assert.equal(g.kinds.get('src/parser/tests.rs'), 'test');
  assert.equal(g.kinds.get('lib/tests.js'), 'test');
  assert.equal(g.kinds.get('cmd/test.go'), 'test');
});

test('pytest python_files = *.py with testpaths names only the files under testpaths', () => {
  const g = graphOf({
    'pytest.ini': '[pytest]\ntestpaths = tests integration\npython_files = *.py\n',
    'src/pkg/__init__.py': '',
    'src/pkg/core.py': 'X = 1\n',
    'tests/check_core.py': 'from pkg.core import X\n',
    'integration/flow.py': 'from pkg.core import X\n',
  });
  assert.equal(g.kinds.get('src/pkg/core.py'), 'source');
  assert.equal(g.kinds.get('src/pkg/__init__.py'), 'source');
  assert.equal(g.kinds.get('integration/flow.py'), 'test');
  assert.deepEqual(testsOf(g, 'src/pkg/core.py'), ['integration/flow.py', 'tests/check_core.py']);
});

test('a catch-all python_files without testpaths does not turn the source tree into tests', () => {
  const g = graphOf({
    'pyproject.toml': '[tool.pytest.ini_options]\npython_files = ["*.py"]\n',
    'src/pkg/__init__.py': '',
    'src/pkg/core.py': 'X = 1\n',
    'src/pkg/testing.py': 'from pkg.core import X\n',
    'tests/check_core.py': 'from pkg.core import X\n',
  });
  assert.equal(g.kinds.get('src/pkg/core.py'), 'source');
  assert.equal(g.kinds.get('src/pkg/testing.py'), 'source');
  assert.deepEqual(testsOf(g, 'src/pkg/core.py'), ['tests/check_core.py']);
});
