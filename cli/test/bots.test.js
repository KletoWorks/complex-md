/* Commits made by bots are not evidence about the code.
 *
 * A dependency bot touches the same manifest and lock pair every week, and a
 * sync workflow commits the same generated pair on every run. Counted as
 * history, they rank those files as hot, label them as fixed ("fix: bump"),
 * and fill the co-change list with pairs no person ever edited together.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { computeSignals, isBotIdentity } from '../src/signals.js';

const ALICE = { name: 'Alice', email: 'alice@example.com' };
const BOB = { name: 'Bob', email: 'bob@example.com' };
const DEPENDABOT = { name: 'dependabot[bot]', email: '49699333+dependabot[bot]@users.noreply.github.com' };
const ACTIONS = { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' };
const RENOVATE = { name: 'Renovate Bot', email: 'bot@renovateapp.com' };

function botRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-bots-'));
  let t = 1_600_000_000;
  const commit = (msg, files, author, committer = author) => {
    for (const f of files) appendFileSync(join(dir, f), `// ${msg}\n`);
    t += 3600;
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email, GIT_AUTHOR_DATE: `${t} +0000`,
      GIT_COMMITTER_NAME: committer.name, GIT_COMMITTER_EMAIL: committer.email, GIT_COMMITTER_DATE: `${t} +0000`,
    };
    execFileSync('git', ['add', ...files], { cwd: dir, env });
    execFileSync('git', ['commit', '-q', '-m', msg], { cwd: dir, env });
  };
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, 'src'));
  for (const f of ['a', 'b', 'c']) writeFileSync(join(dir, `src/${f}.js`), `export const ${f} = 1;\n`);
  commit('init', ['src/a.js', 'src/b.js', 'src/c.js'], ALICE);
  for (let i = 0; i < 3; i++) commit(`tune a ${i}`, ['src/a.js'], i % 2 ? BOB : ALICE);
  for (let i = 0; i < 3; i++) commit(`tune c ${i}`, ['src/c.js'], BOB);
  for (let i = 0; i < 4; i++) commit(`fix: bump dependency ${i}`, ['src/a.js', 'src/b.js'], DEPENDABOT);
  // A person's change that a workflow committed: the committer is a bot.
  for (let i = 0; i < 2; i++) commit(`fix: sync ${i}`, ['src/a.js', 'src/b.js'], ALICE, ACTIONS);
  commit('fix: lock file maintenance', ['src/a.js', 'src/b.js'], RENOVATE);
  return dir;
}

test('bot identities: [bot] suffixes, known bots by name, and never a person or the GitHub web committer', () => {
  for (const [name, email] of [
    ['dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com'],
    ['github-actions[bot]', 'x@users.noreply.github.com'],
    ['GitHub Actions', 'actions@github.com'],
    ['renovate[bot]', 'x@users.noreply.github.com'],
    ['Renovate Bot', 'bot@renovateapp.com'],
    ['dependabot-preview[bot]', 'x'],
    ['pre-commit-ci[bot]', 'x'],
    ['someone', '12345+some-app[bot]@users.noreply.github.com'],
  ]) assert.ok(isBotIdentity(name, email), `${name} <${email}> is a bot`);
  for (const [name, email] of [
    ['Alice', 'alice@example.com'],
    ['GitHub', 'noreply@github.com'],
    ['Abbot Smith', 'abbot@example.com'],
  ]) assert.ok(!isBotIdentity(name, email), `${name} <${email}> is not a bot`);
});

test('churn, fixes, authors and co-change ignore commits a bot authored or committed', () => {
  const s = computeSignals(botRepo());
  const row = (p) => s.table.find((r) => r.path === p);
  assert.equal(row('src/a.js').churn, 4, 'init and three human edits; seven bot commits left out');
  assert.equal(row('src/a.js').fixes, 0, 'every "fix:" commit here was a bot commit');
  assert.equal(row('src/b.js')?.churn ?? 1, 1);
  assert.equal(s.fix_commits, 0);
  assert.equal(s.profile.authors_total, 2, 'Alice and Bob only');
  assert.ok(!s.co_change.some((c) => c.files.includes('src/a.js') && c.files.includes('src/b.js')), 'the bot pair is not coupling');
  assert.equal(s.window_commits, 7);
  const note = s.blind_spots.find((b) => /bot/.test(b));
  assert.ok(note, 'the exclusion is stated');
  assert.match(note, /^7 commits by bots/);
});
