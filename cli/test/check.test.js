// formatCheck over synthetic findings: the grouping of partners by changed
// file, the cap with "and N more", the test lines, and the heading switch
// the Stop hooks use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCheck, PARTNERS_SHOWN } from '../src/check.js';

const row = (score) => ({ score, churn: 4, fixes: 1, fan_in: 2 });
const base = { map_present: true, clean: false, hotspots: [], partners: [], tests: [], changed: [], test_command: null };

test('no map: one pointer line whatever the heading option', () => {
  const f = { ...base, map_present: false };
  assert.equal(formatCheck(f), 'No COMPLEX.md at the repository root. Generate one: npx complex-md');
  assert.equal(formatCheck(f, { heading: false }), 'No COMPLEX.md at the repository root. Generate one: npx complex-md');
});

test('clean: a sentence with the heading, an empty string without', () => {
  const f = { ...base, clean: true };
  assert.equal(formatCheck(f), 'COMPLEX.md check: no hotspot or co-change partner in this change.');
  assert.equal(formatCheck(f, { heading: false }), '');
});

test('hotspots: directive, covering tests or the verify prompt, then the Run line', () => {
  const f = {
    ...base,
    hotspots: [
      { path: 'src/a.js', row: row(450), directive: 'Before editing this file, run test/a.test.js.', tests: ['test/a.test.js'] },
      { path: 'src/c.js', row: { score: 90, churn: 3, fan_in: 0 }, directive: null, tests: [] },
    ],
    tests: ['test/a.test.js'],
    test_command: 'npm test',
  };
  assert.equal(
    formatCheck(f),
    ['COMPLEX.md check', 'Hotspots touched (2):', '- src/a.js  (score 450, churn 4, fixes 1, fan_in 2)', '  Before editing this file, run test/a.test.js.', '  covering tests: test/a.test.js', '- src/c.js  (score 90, churn 3, fixes ?, fan_in 0)', '  no test references this file: say how you verified this change.', 'Run: test/a.test.js  (or npm test)'].join('\n'),
  );
  const noTests = formatCheck({ ...f, tests: [] });
  assert.match(noTests, /\nRun: npm test$/, 'with hotspots but no covering tests the test command alone is the Run line');
  assert.ok(!/Run:/.test(formatCheck({ ...f, tests: [], test_command: null })), 'nothing invented when no command is known');
});

test('partners: grouped by changed file, capped at PARTNERS_SHOWN with the remainder counted', () => {
  const partners = [];
  for (let i = 1; i <= PARTNERS_SHOWN + 2; i++) partners.push({ changed: 'src/a.js', partner: `src/p${i}.js`, count: 20 - i, coupling: null });
  partners.push({ changed: 'src/z.js', partner: 'src/y.js', count: 7, coupling: 50 });
  const out = formatCheck({ ...base, partners }, { heading: false });
  const lines = out.split('\n');
  assert.equal(lines[0], `Co-change partners not touched (${PARTNERS_SHOWN + 3}):`);
  assert.equal(lines.length, 3, 'one line per changed file, not per partner');
  assert.ok(!/^COMPLEX\.md check$/m.test(out), 'heading: false drops the title line');
  assert.equal(lines[1], `- src/a.js changed; unchanged partners: ${Array.from({ length: PARTNERS_SHOWN }, (_, i) => `src/p${i + 1}.js (${19 - i} commits together)`).join(', ')}, and 2 more in COMPLEX.md. State whether each needs a change.`);
  assert.equal(lines[2], '- src/z.js changed; unchanged partners: src/y.js (7 commits together). State whether each needs a change.');
});
