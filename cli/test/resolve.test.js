// Declarative resolver fixtures: each case is a file tree plus the edges
// the graph must and must not find. One harness, one temp dir per case, no
// git; buildGraph takes the tracked list directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGraph } from '../src/graph.js';

const CASES = [
  {
    name: 'npm workspaces: bare package name and subpath resolve via main and dir',
    files: {
      'package.json': '{ "name": "root", "workspaces": ["packages/*"] }',
      'packages/ui/package.json': '{ "name": "@acme/ui", "main": "src/index.js" }',
      'packages/ui/src/index.js': 'export const ui = 1;\n',
      'packages/ui/src/button.js': 'export const b = 1;\n',
      'apps/web/app.js': "import { ui } from '@acme/ui';\nimport { b } from '@acme/ui/src/button';\n",
    },
    edges: [
      ['apps/web/app.js', 'packages/ui/src/index.js'],
      ['apps/web/app.js', 'packages/ui/src/button.js'],
    ],
  },
  {
    name: 'pnpm workspaces: pnpm-workspace.yaml globs define the package set',
    files: {
      'pnpm-workspace.yaml': 'packages:\n  - "libs/*"\n',
      'package.json': '{ "name": "root" }',
      'libs/core/package.json': '{ "name": "core", "main": "index.js" }',
      'libs/core/index.js': 'export const c = 1;\n',
      'src/main.js': "import { c } from 'core';\n",
    },
    edges: [['src/main.js', 'libs/core/index.js']],
  },
  {
    name: 'workspace exports: dot, subpath, wildcard resolve; the fence holds',
    files: {
      'package.json': '{ "workspaces": ["packages/*"] }',
      'packages/kit/package.json': '{ "name": "kit", "exports": { ".": "./lib/main.js", "./x": "./lib/x.js", "./utils/*": "./src/utils/*.js" } }',
      'packages/kit/lib/main.js': 'export default 1;\n',
      'packages/kit/lib/x.js': 'export default 1;\n',
      'packages/kit/lib/secret.js': 'export default 1;\n',
      'packages/kit/src/utils/fmt.js': 'export default 1;\n',
      'app.js': "import kit from 'kit';\nimport x from 'kit/x';\nimport fmt from 'kit/utils/fmt';\nimport s from 'kit/lib/secret';\n",
    },
    edges: [
      ['app.js', 'packages/kit/lib/main.js'],
      ['app.js', 'packages/kit/lib/x.js'],
      ['app.js', 'packages/kit/src/utils/fmt.js'],
    ],
    notEdges: [['app.js', 'packages/kit/lib/secret.js']],
  },
  {
    name: 'workspace exports with one level of conditions',
    files: {
      'package.json': '{ "workspaces": ["packages/*"] }',
      'packages/dual/package.json': '{ "name": "dual", "exports": { ".": { "import": "./esm.js", "require": "./cjs.js" } } }',
      'packages/dual/esm.js': 'export default 1;\n',
      'packages/dual/cjs.js': 'module.exports = 1;\n',
      'app.js': "import d from 'dual';\n",
    },
    edges: [['app.js', 'packages/dual/esm.js']],
  },
  {
    name: 'per-package tsconfig paths, scoped to the package, with single-level extends',
    files: {
      'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@shared/*": ["shared/*"] } } }',
      'packages/web/tsconfig.json': '{ "extends": "../../tsconfig.base.json", "compilerOptions": { "paths": { "@c/*": ["src/components/*"] } } }',
      'packages/web/src/components/button.ts': 'export const b = 1;\n',
      'packages/web/src/page.ts': "import { b } from '@c/button';\n",
      'other/outside.ts': "import { b } from '@c/button';\n",
    },
    edges: [['packages/web/src/page.ts', 'packages/web/src/components/button.ts']],
    notEdges: [['other/outside.ts', 'packages/web/src/components/button.ts']],
  },
  {
    name: 'tsconfig extends: paths inherited from the base config apply in the child scope',
    files: {
      'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@lib/*": ["src/lib/*"] } } }',
      'app/tsconfig.json': '{ "extends": "../tsconfig.base.json" }',
      'app/src/lib/db.ts': 'export const db = 1;\n',
      'app/src/main.ts': "import { db } from '@lib/db';\n",
    },
    edges: [['app/src/main.ts', 'app/src/lib/db.ts']],
  },
  {
    name: 'package.json imports: # specifiers rewrite by prefix, nearest package wins',
    files: {
      'package.json': '{ "name": "root", "imports": { "#lib/*": "./src/lib/*.js", "#config": "./config.js" } }',
      'src/lib/db.js': 'export const db = 1;\n',
      'config.js': 'export default {};\n',
      'src/app.js': "import { db } from '#lib/db';\nimport cfg from '#config';\n",
    },
    edges: [
      ['src/app.js', 'src/lib/db.js'],
      ['src/app.js', 'config.js'],
    ],
  },
  {
    name: 'vite alias: path.resolve(__dirname, ...) form, scoped to the config dir',
    files: {
      'vite.config.js': "import path from 'node:path';\nexport default { resolve: { alias: { '@': path.resolve(__dirname, 'src') } } };\n",
      'src/store.js': 'export const s = 1;\n',
      'src/app.js': "import { s } from '@/store';\n",
    },
    edges: [['src/app.js', 'src/store.js']],
  },
  {
    name: 'webpack alias: fileURLToPath(new URL(...)) and plain string forms',
    files: {
      'webpack.config.mjs': "import { fileURLToPath } from 'node:url';\nexport default { resolve: { alias: { '~lib': fileURLToPath(new URL('./lib', import.meta.url)), 'helpers': './src/helpers' } } };\n",
      'lib/x.js': 'export const x = 1;\n',
      'src/helpers/h.js': 'export const h = 1;\n',
      'main.js': "import { x } from '~lib/x';\nimport { h } from 'helpers/h';\n",
    },
    edges: [
      ['main.js', 'lib/x.js'],
      ['main.js', 'src/helpers/h.js'],
    ],
  },
  {
    name: 'python src layout: package roots come from __init__.py chains, not a hardcoded list',
    files: {
      'src/mypkg/__init__.py': '',
      'src/mypkg/core.py': 'X = 1\n',
      'scripts/tool.py': 'import mypkg.core\nfrom mypkg import core\n',
    },
    edges: [
      ['scripts/tool.py', 'src/mypkg/core.py'],
      ['scripts/tool.py', 'src/mypkg/__init__.py'],
    ],
  },
  {
    name: 'python nested root: a deeper parent of a top-level package is also a root',
    files: {
      'services/api/app/__init__.py': '',
      'services/api/app/models.py': 'M = 1\n',
      'services/api/run.py': 'from app import models\nimport app.models\n',
    },
    edges: [['services/api/run.py', 'services/api/app/models.py']],
  },
  {
    name: 'ruby: require_relative is file-relative; plain require goes through lib/, not siblings',
    files: {
      'lib/foo.rb': "require 'foo/bar'\n",
      'lib/foo/bar.rb': 'BAR = 1\n',
      'app/util/helper.rb': 'H = 1\n',
      'app/util/local.rb': "require_relative 'helper'\n",
      'app/util/gemlike.rb': "require 'helper'\n",
    },
    edges: [
      ['lib/foo.rb', 'lib/foo/bar.rb'],
      ['app/util/local.rb', 'app/util/helper.rb'],
    ],
    notEdges: [['app/util/gemlike.rb', 'app/util/helper.rb']],
  },
  {
    name: 'go: an import of a package depends on every non-test file in its directory',
    files: {
      'go.mod': 'module example.com/m\n',
      'a/a.go': 'package a\n',
      'a/b.go': 'package a\n',
      'a/a_test.go': 'package a\n',
      'main.go': 'package main\n\nimport "example.com/m/a"\n',
    },
    edges: [
      ['main.go', 'a/a.go'],
      ['main.go', 'a/b.go'],
    ],
    notEdges: [['main.go', 'a/a_test.go']],
  },
  {
    name: 'odd filenames: dots, dashes and @ in path segments survive resolution',
    files: {
      'src/weird-name.v2.js': 'export const w = 1;\n',
      'src/@scoped.thing/index.js': 'export const t = 1;\n',
      'src/app.js': "import { w } from './weird-name.v2.js';\nimport { t } from './@scoped.thing';\n",
    },
    edges: [
      ['src/app.js', 'src/weird-name.v2.js'],
      ['src/app.js', 'src/@scoped.thing/index.js'],
    ],
  },
];

for (const c of CASES) {
  test(c.name, () => {
    const dir = mkdtempSync(join(tmpdir(), 'cx-fix-'));
    for (const [p, content] of Object.entries(c.files)) {
      mkdirSync(join(dir, dirname(p)), { recursive: true });
      writeFileSync(join(dir, p), content);
    }
    const g = buildGraph(dir, Object.keys(c.files));
    for (const [from, to] of c.edges) {
      assert.ok(g.edges.get(from)?.has(to), `${from} -> ${to} missing; got ${JSON.stringify([...(g.edges.get(from) || [])])}`);
    }
    for (const [from, to] of c.notEdges || []) {
      assert.ok(!g.edges.get(from)?.has(to), `${from} -> ${to} must not resolve`);
    }
  });
}
