// The repository's own health files and workflows. A tag such as `@v4` can
// be moved to other code after review, so every action runs from a full
// commit SHA. Runs only inside the repository checkout; the published
// package carries none of these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const workflows = () => (existsSync(WORKFLOWS) ? readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)) : []);

test('every workflow action is pinned by a full commit SHA with its version beside it', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const bad = [];
  for (const f of workflows()) {
    for (const line of readFileSync(join(WORKFLOWS, f), 'utf8').split('\n')) {
      const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/.exec(line);
      if (!m) continue;
      if (m[1].startsWith('./')) continue;
      if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(m[1]) || !/#\s*v\d+\.\d+\.\d+/.test(m[2])) bad.push(`${f}: ${line.trim()}`);
    }
  }
  assert.ok(workflows().length > 0, 'the repository has workflows');
  assert.deepEqual(bad, [], 'pin as owner/repo@<40 hex SHA> # vX.Y.Z');
});

/* A workflow with no permissions block gets the repository's default
   token, which can be read and write. Each workflow states its own. */
test('every workflow declares its token permissions at the top level', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const missing = workflows().filter((f) => !/^permissions:/m.test(readFileSync(join(WORKFLOWS, f), 'utf8')));
  assert.deepEqual(missing, [], 'add a top level permissions: block');
});

const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/* A reporter who finds a hole must find a private path before a public
   one. GitHub shows SECURITY.md on the Security tab and on the new issue
   page. */
test('SECURITY.md gives a private report path and the supported versions', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  assert.ok(existsSync(join(ROOT, 'SECURITY.md')), 'SECURITY.md exists');
  const s = read('SECURITY.md');
  assert.match(s, /https:\/\/github\.com\/KletoWorks\/complex-md\/security\/advisories\/new/);
  assert.match(s, /^## Supported versions/m);
});

/* The covenant ships with a placeholder for the enforcement contact. A
   copy that keeps it gives a reporter nowhere to go. */
test('CODE_OF_CONDUCT.md is Contributor Covenant 2.1 with a real contact', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  assert.ok(existsSync(join(ROOT, 'CODE_OF_CONDUCT.md')), 'CODE_OF_CONDUCT.md exists');
  const s = read('CODE_OF_CONDUCT.md');
  assert.match(s, /Contributor Covenant\]\[homepage\], version 2\.1/);
  assert.doesNotMatch(s, /\[INSERT CONTACT METHOD\]|^\+\+\+/m);
  assert.doesNotMatch(s, /[\w.+-]+@[\w-]+\.[\w.]+/, 'no email address');
  assert.match(s, /https:\/\/github\.com\/jameslcowan/);
});

/* A wrong map is the report that helps most and costs no code review, so
   its form asks for exactly what a rerun needs: the repository, the
   commit, the line and the truth. The other forms do the same for their
   case. Questions go to Discussions, not issues. */
const FORMS = {
  '.github/ISSUE_TEMPLATE/map-wrong.yml': ['repository', 'commit', 'wrong_line', 'truth'],
  '.github/ISSUE_TEMPLATE/new-language.yml': ['language', 'extensions', 'imports', 'fixture'],
  '.github/ISSUE_TEMPLATE/benchmark-task.yml': ['repository', 'fix_commit', 'issue', 'tests'],
  '.github/unlisted/page-removal.yml': ['page', 'repository', 'maintainer'],
};

test('the issue forms ask for the fields a fix needs, and questions go to Discussions', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const [p, ids] of Object.entries(FORMS)) {
    assert.ok(existsSync(join(ROOT, p)), `${p} exists`);
    const s = read(p);
    for (const key of ['name', 'description', 'body']) assert.match(s, new RegExp(`^${key}:`, 'm'), `${p} has ${key}`);
    for (const id of ids) assert.match(s, new RegExp(`^\\s+id: ${id}$`, 'm'), `${p} asks for ${id}`);
    assert.match(s, /required: true/, `${p} requires at least one field`);
  }
  // Each form files its issue under the label a maintainer triages by.
  for (const [p, label] of [['.github/ISSUE_TEMPLATE/map-wrong.yml', 'map'], ['.github/ISSUE_TEMPLATE/new-language.yml', 'language'], ['.github/ISSUE_TEMPLATE/benchmark-task.yml', 'bench'], ['.github/unlisted/page-removal.yml', 'removal']]) {
    const labels = /^labels: \[([^\]]*)\]$/m.exec(read(p))?.[1].split(',').map((l) => l.trim()) || [];
    assert.ok(labels.includes(label), `${p} labels ${label}, has ${labels}`);
  }
  // No hosted page exists yet, so the chooser offers no form to remove one.
  assert.ok(!existsSync(join(ROOT, '.github/ISSUE_TEMPLATE/page-removal.yml')), 'the removal form stays out of the chooser');
  const config = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.match(config, /^contact_links:/m);
  assert.match(config, /https:\/\/github\.com\/KletoWorks\/complex-md\/discussions/);
});

/* The pull request template asks for the change, the test and an AI
   disclosure, and the disclosure links to a section that exists. */
test('the pull request template asks for the change, the test and an AI disclosure', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const s = read('.github/PULL_REQUEST_TEMPLATE.md');
  for (const h of ['What changed', 'How it was tested', 'AI assistance']) assert.match(s, new RegExp(`^## ${h}$`, 'm'), `asks: ${h}`);
  assert.match(s, /^- \[ \] /m, 'has a disclosure checkbox');
  assert.match(s, /CONTRIBUTING\.md#ai-assistance/);
  assert.match(read('CONTRIBUTING.md'), /^## AI assistance$/m, 'CONTRIBUTING.md has the section the template links to');
});

/* AGENTS.md is what a contributor's agent reads first. A path it names
   that no longer exists sends the agent to a dead end, and wire keeps the
   integration block only while its heading and text stay as written. */
test('AGENTS.md names only paths that exist and keeps the integration block', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const s = read('AGENTS.md');
  assert.match(s, /^## Working on this repository$/m);
  assert.match(s, /cd cli && npm test/);
  const block = read('prompts/integration.md').trim();
  assert.ok(s.includes(block), 'the integration block matches prompts/integration.md');
  const named = [...s.split(block)[0].matchAll(/`([\w.-]+\/[\w./-]*|[\w-]+\.(?:md|js|mjs|json))`/g)].map((m) => m[1].replace(/\/$/, ''));
  assert.ok(named.length >= 5, `AGENTS.md names ${named.length} paths`);
  // dist/ is build output and exists only after npm run build.
  const missing = named.filter((p) => p !== 'dist' && !existsSync(join(ROOT, p)));
  assert.deepEqual(missing, [], 'paths named in AGENTS.md exist');
});

/* Scorecard rejects a published result from a workflow with write
   permissions at the top level, and only its own job may hold id-token. */
test('the Scorecard workflow publishes with no token permissions at the top level', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const s = read('.github/workflows/scorecard.yml');
  assert.match(s, /^permissions: \{\}$/m);
  assert.match(s, /uses: ossf\/scorecard-action@[0-9a-f]{40}/);
  assert.match(s, /publish_results: true/);
  assert.match(s, /persist-credentials: false/);
  for (const f of workflows().filter((w) => w !== 'scorecard.yml' && w !== 'release.yml')) {
    assert.doesNotMatch(read(`.github/workflows/${f}`), /id-token: write/, `${f} does not ask for id-token`);
  }
});

/* The SHA pins above go stale without a bot that proposes the next one.
   Dependabot opens those pull requests for the workflows and for the CLI's
   two runtime dependencies. */
test('dependabot.yml keeps the actions and the CLI dependencies current', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const s = read('.github/dependabot.yml');
  assert.match(s, /^version: 2$/m);
  for (const [eco, dir] of [['github-actions', '/'], ['npm', '/cli']]) {
    assert.match(s, new RegExp(`package-ecosystem: "${eco}"\\n\\s+directory: "${dir}"\\n\\s+schedule:\\n\\s+interval: "weekly"`), `${eco} in ${dir}, weekly`);
  }
});

/* `npm@latest` installs whatever npm is newest on the day of a release,
   so two releases of the same commit could build with different tools.
   The release pins an exact npm, 11.5 or later for trusted publishing. */
test('the release workflow installs an exact npm version', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const s = read('.github/workflows/release.yml');
  assert.doesNotMatch(s, /npm@latest/);
  const m = /npm install -g npm@(\d+)\.(\d+)\.(\d+)\b/.exec(s);
  assert.ok(m, 'npm install -g npm@X.Y.Z');
  assert.ok(Number(m[1]) > 11 || (Number(m[1]) === 11 && Number(m[2]) >= 5), `npm ${m[1]}.${m[2]} supports trusted publishing`);
});

/* A clone of this repository should not run code on a contributor's
   machine before they ask for it. Committed hook settings run the CLI on
   every edit in Claude Code, and a committed .mcp.json starts a server.
   The CLI writes neither by default, and this repository follows its own
   default. */
test('this repository commits no edit hooks and no MCP server config', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const f of ['.claude/settings.json', '.cursor/hooks.json', '.mcp.json']) assert.ok(!existsSync(join(ROOT, f)), `${f} is not committed`);
});
