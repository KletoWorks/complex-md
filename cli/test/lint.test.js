/* complex-md lint: the 0.4 fixtures, and the rules the schema cannot express. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { lintMap, lintFile, SIZE_CAP } from '../src/lint.js';
import { validate, loadSchema } from '../src/schema.js';

const SPEC = join(import.meta.dirname, '..', '..', 'spec', '0.4');
const FIXTURES = join(SPEC, 'fixtures');
const BIN = join(import.meta.dirname, '..', 'bin', 'complex-md.js');
const inCheckout = existsSync(FIXTURES);

/* The same gaps as spec-fixtures.test.js: where the reader's front matter
   differs from the data a YAML parser returns, lint cannot give the result. */
const READER_GAPS = {
  'comma-path': 'the reader splits a flow list at every comma, also inside a double quoted path',
  'empty-test-files': 'the reader reads an empty flow list inside a list item as [""]',
};

const MAP = readFileSync(join(FIXTURES, 'minimal', 'COMPLEX.md'), 'utf8');
const rules = (r) => r.errors.map((e) => e.rule);

if (inCheckout) {
  for (const d of readdirSync(FIXTURES, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name).sort()) {
    const dir = join(FIXTURES, d);
    const file = join(dir, 'COMPLEX.md');
    if (!readdirSync(dir).includes('COMPLEX.md')) continue;
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    if (!expected.document) continue;
    test(`lint fixture ${d}: gives the result the fixture states`, READER_GAPS[d] ? { todo: READER_GAPS[d] } : {}, () => {
      // The fixture paths name files of an imagined repository, so they are not looked up here.
      const r = lintMap(readFileSync(file), { root: null });
      const want = expected.document.errors;
      assert.deepEqual(rules(r).filter((x, i, a) => a.indexOf(x) === i).sort(), want.filter((c) => c !== 'size').sort());
      assert.equal(r.warnings.some((w) => w.rule === 'size'), want.includes('size'));
      assert.equal(r.ok, want.every((c) => c === 'size'));
    });
  }
}

test('lint reports a path that is missing from the working tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'lint-'));
  try {
    const file = join(root, 'COMPLEX.md');
    writeFileSync(file, MAP);
    const r = lintFile(file, { root });
    assert.deepEqual(rules(r), ['path-missing']);
    assert.match(r.errors[0].message, /lib\/router\.js/);
    mkdirSync(join(root, 'lib'));
    writeFileSync(join(root, 'lib', 'router.js'), '');
    assert.equal(lintFile(file, { root }).ok, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('lint reports an absolute path once, as path-relative', () => {
  const r = lintMap(MAP.replaceAll('lib/router.js', '/home/me/lib/router.js'), { root: null });
  assert.equal(r.ok, false);
  assert.ok(rules(r).includes('path-relative'));
  assert.ok(!rules(r).includes('schema'), 'the schema pattern does not repeat the finding');
  assert.match(r.errors[0].message, /absolute/);
});

test('lint warns about a map over the size cap and does not fail', () => {
  const big = MAP + '\n' + 'x'.repeat(SIZE_CAP) + '\n';
  const r = lintMap(big, { root: null });
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.map((w) => w.rule), ['size']);
});

test('the validator still throws on a keyword it does not implement', () => {
  assert.throws(() => validate({}, 1, { oneOf: [] }), /does not implement/);
  assert.ok(Array.isArray(validate(loadSchema(), {})));
});

test('the packaged schema equals the spec schema', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  assert.equal(readFileSync(join(import.meta.dirname, '..', 'schema', 'complex-md.schema.json'), 'utf8'), readFileSync(join(SPEC, 'complex-md.schema.json'), 'utf8'));
});

test('lint on the command line: findings, --json and the exit code', () => {
  const root = mkdtempSync(join(tmpdir(), 'lint-cli-'));
  try {
    writeFileSync(join(root, 'COMPLEX.md'), MAP);
    const run = (...a) => spawnSync(process.execPath, [BIN, 'lint', ...a], { cwd: root, encoding: 'utf8' });
    const bad = run();
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^COMPLEX\.md:\d+: path-missing: /m);
    const json = JSON.parse(run('--json').stdout);
    assert.equal(json.ok, false);
    assert.equal(json.errors[0].rule, 'path-missing');
    assert.deepEqual(json.warnings, []);
    mkdirSync(join(root, 'lib'));
    writeFileSync(join(root, 'lib', 'router.js'), '');
    const good = run('COMPLEX.md');
    assert.equal(good.status, 0);
    assert.equal(good.stdout, '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('lint reports a list key of the wrong type as a schema finding and does not throw', () => {
  for (const key of ['hotspots', 'load_bearing', 'co_change']) {
    const map = MAP.replace(new RegExp(`^${key}:[\\s\\S]*?(?=^\\w)`, 'm'), `${key}: invalid\n`);
    const r = lintMap(map, { root: null });
    assert.equal(r.ok, false, key);
    assert.ok(r.errors.some((e) => e.rule === 'schema' && e.message.startsWith(`/${key}: expected array`)), `${key}: ${JSON.stringify(r.errors)}`);
  }
});

test('lint checks the commit as written: an unquoted all digit sha is a number', () => {
  const r = lintMap(MAP.replace('commit: "3f2a9c1"', 'commit: 1234567'), { root: null });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.rule === 'schema' && e.message.startsWith('/commit')), JSON.stringify(r.errors));
});
