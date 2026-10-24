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
