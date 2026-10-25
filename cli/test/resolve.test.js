// Declarative resolver fixtures: each case is a file tree plus the edges
// the graph must and must not find. One harness, one temp dir per case, no
// git; buildGraph takes the tracked list directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../src/graph.js';

const CASES = [
  {
    name: "require('..') and require('.') resolve the directory: package.json main first, then index",
    files: {
      'package.json': '{ "name": "pkg", "main": "lib/main.js" }',
      'lib/main.js': 'module.exports = 1;\n',
      'lib/index.js': 'module.exports = 2;\n',
      'lib/sub/x.js': "const lib = require('..');\n",
      'test/a.test.js': "const pkg = require('..');\n",
      'bin.js': "const pkg = require('.');\nconst up = require('../..');\n",
      'pkgs/x/package.json': '{ "main": "dist/x.js" }',
      'pkgs/x/dist/x.js': 'module.exports = 1;\n',
      'use.js': "const x = require('./pkgs/x');\n",
    },
    edges: [
      ['test/a.test.js', 'lib/main.js'],
      ['bin.js', 'lib/main.js'],
      ['lib/sub/x.js', 'lib/index.js'],
      ['use.js', 'pkgs/x/dist/x.js'],
    ],
  },
  {
    name: 'a trailing slash specifier resolves the directory only, never a same named file',
    files: {
      'lib.js': 'export default 0;\n',
      'lib/index.js': 'export default 1;\n',
      'src/util/index.ts': 'export default 1;\n',
      'src/app.js': "import x from '../lib/';\nconst u = require('./util/');\n",
      'src/index.js': 'export default 1;\n',
      'src/util/deep.js': "import s from '../';\n",
    },
    edges: [
      ['src/app.js', 'lib/index.js'],
      ['src/app.js', 'src/util/index.ts'],
      ['src/util/deep.js', 'src/index.js'],
    ],
    notEdges: [['src/app.js', 'lib.js']],
  },
  {
    name: 'workspace globs: ** matches nested package dirs, * matches one level only',
    files: {
      'package.json': '{ "workspaces": ["apps/**", "libs/*"] }',
      'apps/web/admin/package.json': '{ "name": "admin", "main": "index.js" }',
      'apps/web/admin/index.js': 'export default 1;\n',
      'libs/a/package.json': '{ "name": "liba", "main": "index.js" }',
      'libs/a/index.js': 'export default 1;\n',
      'libs/a/deep/package.json': '{ "name": "deep", "main": "index.js" }',
      'libs/a/deep/index.js': 'export default 1;\n',
      'main.js': "import a from 'admin';\nimport b from 'liba';\nimport d from 'deep';\n",
    },
    edges: [
      ['main.js', 'apps/web/admin/index.js'],
      ['main.js', 'libs/a/index.js'],
    ],
    notEdges: [['main.js', 'libs/a/deep/index.js']],
  },
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
    edges: [['scripts/tool.py', 'src/mypkg/core.py']],
    notEdges: [['scripts/tool.py', 'src/mypkg/__init__.py']],
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
    name: 'rust modules and crate-relative uses follow module paths and ignore comments and strings',
    files: {
      'Cargo.toml': '[package]\nname = "sample"\n',
      'src/lib.rs': [
        'mod direct;',
        'mod directory;',
        'mod outer;',
        '#[path = "override.rs"]',
        'mod replacement;',
        'use crate::tree::branch::Value;',
        'use crate::fallback::item::VALUE;',
        'use std::fmt::Debug;',
        'use external_crate::Thing;',
        '#[cfg(test)] mod tests { fn inline() {} }',
        '// mod commented;',
        '/* use crate::commented::Thing; */',
        'const SOURCE: &str = r#"',
        'mod raw;',
        'use crate::raw::Thing;',
        '"#;',
        '',
      ].join('\n'),
      'src/direct.rs': 'pub struct Item;\n',
      'src/direct/mod.rs': 'pub struct Other;\n',
      'src/directory/mod.rs': 'pub struct Item;\n',
      'src/outer.rs': 'mod child;\nuse self::child::Thing;\nuse super::direct::Item;\n',
      'src/outer/child.rs': 'pub struct Thing;\n',
      'src/override.rs': 'pub struct Replacement;\n',
      'src/tree/branch.rs': 'pub struct Value;\n',
      'src/fallback.rs': 'pub mod item;\n',
      'src/commented.rs': '',
      'src/raw.rs': '',
      'src/tests.rs': '',
    },
    edges: [
      ['src/lib.rs', 'src/direct.rs'],
      ['src/lib.rs', 'src/directory/mod.rs'],
      ['src/lib.rs', 'src/override.rs'],
      ['src/lib.rs', 'src/tree/branch.rs'],
      ['src/lib.rs', 'src/fallback.rs'],
      ['src/outer.rs', 'src/outer/child.rs'],
      ['src/outer.rs', 'src/direct.rs'],
    ],
    notEdges: [
      ['src/lib.rs', 'src/direct/mod.rs'],
      ['src/lib.rs', 'src/commented.rs'],
      ['src/lib.rs', 'src/raw.rs'],
      ['src/lib.rs', 'src/tests.rs'],
    ],
  },
  {
    name: 'rust self and super uses resolve in the current module tree',
    files: {
      'Cargo.toml': '[package]\nname = "nested"\n',
      'src/lib.rs': 'mod parent;\n',
      'src/parent/mod.rs': 'mod child;\nuse self::child::Item;\n',
      'src/parent/child.rs': 'use super::sibling::Sibling;\n',
      'src/parent/sibling.rs': 'pub struct Sibling;\n',
    },
    edges: [
      ['src/lib.rs', 'src/parent/mod.rs'],
      ['src/parent/mod.rs', 'src/parent/child.rs'],
      ['src/parent/mod.rs', 'src/parent/child.rs'],
      ['src/parent/child.rs', 'src/parent/sibling.rs'],
    ],
  },
  {
    name: 'rust workspace uses resolve each package root and hyphenated crate names',
    files: {
      'Cargo.toml': '[workspace]\nmembers = ["crates/app", "crates/core"]\n',
      'crates/app/Cargo.toml': '[package]\nname = "sample-app"\n',
      'crates/app/src/main.rs': 'mod local;\nuse crate::local::Item;\nuse core_lib::api::Thing;\nuse serde::Serialize;\n',
      'crates/app/src/local.rs': 'pub struct Item;\n',
      'crates/core/Cargo.toml': '[package]\nname = "core-lib"\n',
      'crates/core/src/lib.rs': 'pub mod api;\n',
      'crates/core/src/api.rs': 'pub struct Thing;\n',
      'src/lib.rs': 'pub struct WrongRoot;\n',
    },
    edges: [
      ['crates/app/src/main.rs', 'crates/app/src/local.rs'],
      ['crates/app/src/main.rs', 'crates/core/src/api.rs'],
      ['crates/core/src/lib.rs', 'crates/core/src/api.rs'],
    ],
    notEdges: [
      ['crates/app/src/main.rs', 'src/lib.rs'],
    ],
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
  {
    name: 'python from-import: imported names that are submodules resolve to the submodule, not __init__.py',
    files: {
      'src/pkg/__init__.py': 'from .app import App\n',
      'src/pkg/app.py': 'from . import cli\nfrom . import typing as ft\nfrom .helpers import (\n    get_debug,\n    sub as s,\n)\nfrom .. import top\n',
      'src/pkg/cli.py': 'X = 1\n',
      'src/pkg/typing.py': 'T = 1\n',
      'src/pkg/helpers.py': 'def get_debug(): pass\n',
      'src/pkg/blueprints.py': 'from pkg import cli, App\nfrom pkg.sansio import scaffold\n',
      'src/pkg/sansio/__init__.py': '',
      'src/pkg/sansio/scaffold.py': 'S = 1\n',
      'src/top.py': 'TOP = 1\n',
    },
    edges: [
      ['src/pkg/app.py', 'src/pkg/cli.py'],
      ['src/pkg/app.py', 'src/pkg/typing.py'],
      ['src/pkg/app.py', 'src/pkg/helpers.py'],
      ['src/pkg/app.py', 'src/top.py'],
      ['src/pkg/blueprints.py', 'src/pkg/cli.py'],
      ['src/pkg/blueprints.py', 'src/pkg/__init__.py'],
      ['src/pkg/blueprints.py', 'src/pkg/sansio/scaffold.py'],
      ['src/pkg/__init__.py', 'src/pkg/app.py'],
    ],
    notEdges: [
      ['src/pkg/app.py', 'src/pkg/__init__.py'],
      ['src/pkg/blueprints.py', 'src/pkg/sansio/__init__.py'],
    ],
  },
  {
    name: 'python from-import: comments in a name list and backslash continuations keep every submodule',
    files: {
      'pkg/__init__.py': '',
      'pkg/a.py': 'from . import (  # the views\n    b,  # first\n    c,\n)\nfrom . import d, \\\n    e\n',
      'pkg/b.py': '',
      'pkg/c.py': '',
      'pkg/d.py': '',
      'pkg/e.py': '',
    },
    edges: [
      ['pkg/a.py', 'pkg/b.py'],
      ['pkg/a.py', 'pkg/c.py'],
      ['pkg/a.py', 'pkg/d.py'],
      ['pkg/a.py', 'pkg/e.py'],
    ],
    notEdges: [['pkg/a.py', 'pkg/__init__.py']],
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

test('resolve.js holds no NUL byte, so ripgrep and grep read it as text', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/resolve.js', import.meta.url)));
  assert.equal(src.indexOf(0), -1, 'a literal NUL byte makes ripgrep skip the file; write it as an escape');
});
