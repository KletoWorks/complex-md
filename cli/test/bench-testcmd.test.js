/* Which Bash commands count as the agent running tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestCommand } from '../../bench/agent-events.mjs';

test('runner commands count as test runs', () => {
  for (const c of [
    'node --test test/a.test.js',
    'npm test',
    'npm run test -- --grep x',
    'npm run unit',
    'npm t',
    'npx borp -p "test/*.js"',
    'npx borp',
    'npx -y borp test/x.js',
    'npm exec borp -- test/x.js',
    './node_modules/.bin/tap test/x.js',
    'npx tap test/x.js',
  ]) assert.ok(isTestCommand(c), c);
});

test('a node:test file run directly with node counts as a test run', () => {
  for (const c of [
    'node test/fetch/issue-2021.js',
    'node --expose-gc test/issue-803.js',
    'cd /w/task && node test/a.test.js 2>&1 | tail -20',
    'NODE_DEBUG=x node test/node-test/util.js',
    'timeout 60 node "test/issue-4880.js"',
  ]) assert.ok(isTestCommand(c), c);
});

test('other node and shell commands do not', () => {
  for (const c of [
    'node -e "console.log(1)"',
    'node --version',
    'node scripts/build.js',
    'node lib/core/util.js',
    'cat test/a.test.js',
    'grep -rn test lib/',
    'ls test/',
  ]) assert.ok(!isTestCommand(c), c);
});
