/* The benchmark's test suite plumbing: which files count as runnable tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRunnableTest, goldTestFiles } from '../../bench/suite.mjs';

test('a gold test is a file the runner can execute', () => {
  for (const f of ['test/issue-3897.js', 'test/buffer.test.js', 'test/node-test/util.mjs', 'test/a.cjs']) assert.ok(isRunnableTest(f), f);
  for (const f of [
    'test/types/errors.test-d.ts',
    'test/types/instance.tst.ts',
    'test/web-platform-tests/runner/certs/cacert.pem',
    'test/web-platform-tests/runner/config.json',
    'test/web-platform-tests/wpt-runner.mjs',
    'test/fixtures/key.pem',
  ]) assert.ok(!isRunnableTest(f), f);
});

test('gold tests drop what node --test cannot pass, so a task is not unpassable by construction', () => {
  // undici 445522ba1b: one real test and one type test.
  assert.deepEqual(goldTestFiles({ tests: ['test/issue-3897.js', 'test/types/errors.test-d.ts'] }), ['test/issue-3897.js']);
  // undici f3cbe48670: certificates, JSON and a WPT runner around one test.
  assert.deepEqual(goldTestFiles({ tests: [
    'test/web-platform-tests/expectation.json',
    'test/web-platform-tests/runner/certs/cacert.key',
    'test/web-platform-tests/wpt-runner.mjs',
    'test/websocket/stream/abort-before-open.js',
  ] }), ['test/websocket/stream/abort-before-open.js']);
  assert.deepEqual(goldTestFiles({}), []);
});

test('a TAP line with or without the dash after the number names its test', async () => {
  const { parseTap } = await import('../../bench/suite.mjs');
  // node --test writes "ok 1 - name"; mocha's tap reporter writes "ok 1 name".
  assert.deepEqual(parseTap('ok 1 - a\nnot ok 2 - b # TODO\n'), { a: true, b: false });
  assert.deepEqual(parseTap('ok 1 lib/utils clean() strips\nnot ok 2 lib/utils clean() keeps tabs\n# tests 2\n1..2\n'), { 'lib/utils clean() strips': true, 'lib/utils clean() keeps tabs': false });
});

test('a dataset suite names the runner, the files and its environment', async () => {
  const { detectRunner, listTestFiles, goldTestFiles, runTestFile } = await import('../../bench/suite.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const wt = mkdtempSync(join(tmpdir(), 'cx-suite-'));
  try {
    mkdirSync(join(wt, 'test/unit'), { recursive: true });
    mkdirSync(join(wt, 'test/fixtures'), { recursive: true });
    writeFileSync(join(wt, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
    writeFileSync(join(wt, 'test/unit/a.spec.cjs'), "if (process.env.CX_SUITE_ENV !== 'on') process.exit(1);\nconsole.log('ok 1 env is set');\n");
    writeFileSync(join(wt, 'test/unit/b.spec.ts'), '');
    writeFileSync(join(wt, 'test/fixtures/c.spec.cjs'), '');
    const suite = {
      runner: { name: 'script', cmd: process.execPath, args: [], env: { CX_SUITE_ENV: 'on' } },
      files: ['test/**/*.spec.{cjs,ts}'],
      include: '\\.spec\\.(cjs|ts)$',
      exclude: '^test/fixtures/',
    };
    const runner = detectRunner(wt, suite);
    assert.equal(runner.name, 'script');
    assert.equal(runner.tap, true, 'a dataset runner is read as TAP unless it says otherwise');
    assert.equal(detectRunner(wt).name, 'node', 'without a dataset suite the scripts decide');
    assert.deepEqual(listTestFiles(wt, suite), ['test/unit/a.spec.cjs', 'test/unit/b.spec.ts']);
    assert.deepEqual(goldTestFiles({ tests: ['test/unit/b.spec.ts', 'test/fixtures/c.spec.cjs', 'README.md'] }, suite), ['test/unit/b.spec.ts']);
    assert.deepEqual(goldTestFiles({ tests: ['test/unit/b.spec.ts'] }), [], 'the default rule still drops TypeScript');
    const r = await runTestFile(wt, runner, 'test/unit/a.spec.cjs');
    assert.equal(r.ok, true, 'the runner environment reaches the test');
    assert.deepEqual(r.tests, { 'env is set': true });
  } finally { rmSync(wt, { recursive: true, force: true }); }
});
