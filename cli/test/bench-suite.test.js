/* The benchmark's test suite plumbing: which files count as runnable tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isRunnableTest, goldTestFiles, listTestFiles } from '../../bench/suite.mjs';

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

/* git ls-files and the import graph name files with /, and the selectors
   match suite files against them. fs.globSync and path.join write \ on
   Windows, so the suite must come back with / there too. */
test('listTestFiles names the suite with / on every OS, from a glob and from the folder walk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-suite-'));
  try {
    mkdirSync(join(dir, 'test', 'deep'), { recursive: true });
    writeFileSync(join(dir, 'test', 'a.test.js'), '');
    writeFileSync(join(dir, 'test', 'deep', 'b.test.js'), '');
    assert.deepEqual(listTestFiles(dir), ['test/a.test.js', 'test/deep/b.test.js'], 'the folder walk');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test "test/**/*.test.js"' } }));
    assert.deepEqual(listTestFiles(dir), ['test/a.test.js', 'test/deep/b.test.js'], 'the glob in the test script');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
