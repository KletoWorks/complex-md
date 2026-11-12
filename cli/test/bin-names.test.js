import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('complex, complex.md and complex-md all run the one CLI entry', () => {
  assert.deepEqual(Object.keys(pkg.bin).sort(), ['complex', 'complex-md', 'complex.md']);
  for (const name of Object.keys(pkg.bin)) assert.equal(pkg.bin[name], 'bin/complex-md.js', name);
});

test('npx finds a bin named like the package under both published names', () => {
  // npx runs the bin whose name equals the package name when a package has more than one bin.
  assert.ok(pkg.bin[pkg.name], `no bin named ${pkg.name}`);
  assert.ok(pkg.bin['complex.md'], 'no bin named complex.md for the complex.md package');
});

test('the entry prints its version', () => {
  const entry = fileURLToPath(new URL('../bin/complex-md.js', import.meta.url));
  const r = spawnSync(process.execPath, [entry, '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout + r.stderr, new RegExp(pkg.version.replace(/\./g, '\\.')));
});
