// Hook handlers run as the bin, the way Claude Code and Cursor run them:
// JSON on stdin, JSON (or nothing) on stdout, exit code as the verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js');

function hook(kind, input, cwd, args = []) {
  return spawnSync(process.execPath, [BIN, 'hook', kind, ...args], { cwd, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(cwd) } });
}

test('hook stop and cursor-stop outside a git repository exit 0 with no output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-hook-norepo-'));
  for (const kind of ['stop', 'cursor-stop']) {
    const r = hook(kind, { cwd: dir, session_id: 'norepo' }, dir);
    assert.equal(r.status, 0, `${kind}: ${r.stderr}`);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  }
});

test('hook pre and cursor-pre outside a git repository let the edit through', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-hook-norepo-'));
  const pre = hook('pre', { cwd: dir, tool_input: { file_path: join(dir, 'x.js') } }, dir);
  assert.equal(pre.status, 0);
  assert.equal(pre.stdout, '');
  const cur = hook('cursor-pre', { workspace_roots: [dir], tool_input: { file_path: join(dir, 'x.js') } }, dir);
  assert.equal(cur.status, 0);
  assert.deepEqual(JSON.parse(cur.stdout), { permission: 'allow' });
});

// ---- JSON shapes, on a repository with a map ------------------------------
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// One hotspot (src/a.js) and one pair (a, b), so src/b.js is a partner and
// nothing more. Commits are backdated so the stop hook's "since the session
// started" window does not sweep the fixture's own history in.
const FM = `---
complex_md: "0.3"
generated: 2020-01-01
commit: abc1234
tool: test
window_commits: 6
files_analyzed: 2
profile:
  confidence: structure-only, single author
hotspots:
  - path: src/a.js
    kind: source
    loc: 1
    churn: 6
    churn_w: 5.80
    fixes: 2
    authors: 1
    owner_share: 1.00
    fan_in: 1
    tests: 1
    score: 108
load_bearing:
co_change:
  - files: [src/a.js, src/b.js]
    count: 6
    coupling: 100
seams:
blind_spots:
---
`;

function makeMappedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-hook-'));
  const g = (...a) => spawnSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x', GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'test'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  writeFileSync(join(dir, 'test/a.test.js'), "import { a } from '../src/a.js';\n");
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(dir, 'src/a.js'), `export const a = ${i + 2};\n`);
    writeFileSync(join(dir, 'src/b.js'), `import { a } from './a.js';\nexport const b = a + ${i};\n`);
    g('add', '.');
    g('commit', '-q', '-m', i % 2 ? `fix: a (${i})` : `feat: a (${i})`);
  }
  writeFileSync(join(dir, 'COMPLEX.md'), FM + '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/a.js\n');
  return dir;
}

const session = () => 'hooktest-' + randomBytes(6).toString('hex');
const parse = (r) => JSON.parse(r.stdout);

test('cursor-pre: deny carries permission, agent_message and user_message; later edits allow', () => {
  const dir = makeMappedRepo();
  const sid = session();
  const first = hook('cursor-pre', { conversation_id: sid, workspace_roots: [dir], tool_input: { file_path: join(dir, 'src/a.js') } }, dir);
  assert.equal(first.status, 0);
  const deny = parse(first);
  assert.deepEqual(Object.keys(deny).sort(), ['agent_message', 'permission', 'user_message']);
  assert.equal(deny.permission, 'deny');
  assert.match(deny.agent_message, /^COMPLEX\.md: src\/a\.js is a hotspot \(score 108, 6 of the last 6 commits touched it, 2 of them bug fixes, 1 files depend on it\)\./);
  assert.match(deny.agent_message, /Before editing this file, run test\/a\.test\.js\./);
  assert.equal(deny.user_message, 'COMPLEX.md held the first edit of a hotspot so the agent reads its paragraph.');
  const second = parse(hook('cursor-pre', { conversation_id: sid, workspace_roots: [dir], tool_input: { file_path: join(dir, 'src/a.js') } }, dir));
  assert.deepEqual(second, { permission: 'allow' });
});

test('cursor-pre: warn mode and a partner-only file allow with an agent_message', () => {
  const dir = makeMappedRepo();
  const warn = parse(hook('cursor-pre', { conversation_id: session(), workspace_roots: [dir], tool_input: { file_path: 'src/a.js' } }, dir, ['--mode', 'warn']));
  assert.deepEqual(Object.keys(warn).sort(), ['agent_message', 'permission']);
  assert.equal(warn.permission, 'allow');
  const partner = parse(hook('cursor-pre', { conversation_id: session(), workspace_roots: [dir], tool_input: { file_path: 'src/b.js' } }, dir));
  assert.equal(partner.permission, 'allow');
  assert.match(partner.agent_message, /^COMPLEX\.md: src\/b\.js moves with src\/a\.js \(6 commits\)\./);
  const off = parse(hook('cursor-pre', { conversation_id: session(), workspace_roots: [dir], tool_input: { file_path: 'src/a.js' } }, dir, ['--mode', 'off']));
  assert.deepEqual(off, { permission: 'allow' });
});

test('pre (Claude Code): hookSpecificOutput with permissionDecision deny, then additionalContext in warn mode', () => {
  const dir = makeMappedRepo();
  const deny = parse(hook('pre', { session_id: session(), cwd: dir, tool_input: { file_path: join(dir, 'src/a.js') } }, dir));
  assert.deepEqual(Object.keys(deny), ['hookSpecificOutput']);
  assert.equal(deny.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(deny.hookSpecificOutput.permissionDecisionReason, /Before editing this file, run test\/a\.test\.js\./);
  const ctx = parse(hook('pre', { session_id: session(), cwd: dir, tool_input: { file_path: 'src/a.js' } }, dir, ['--mode', 'warn']));
  assert.deepEqual(Object.keys(ctx.hookSpecificOutput).sort(), ['additionalContext', 'hookEventName']);
  assert.ok(!('permissionDecision' in ctx.hookSpecificOutput), 'context never touches the permission flow');
  const none = hook('pre', { session_id: session(), cwd: dir, tool_input: { file_path: 'README.md' } }, dir);
  assert.equal(none.status, 0);
  assert.equal(none.stdout, '', 'an unlisted file gets no output at all');
});

test('stop hooks: Claude emits decision block with reason, Cursor emits followup_message, each once per session', () => {
  const dir = makeMappedRepo();
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 100;\n');
  const sid = session();
  const claude = hook('stop', { session_id: sid, cwd: dir }, dir);
  assert.equal(claude.status, 0);
  const c = parse(claude);
  assert.deepEqual(Object.keys(c), ['decision', 'reason']);
  assert.equal(c.decision, 'block');
  assert.match(c.reason, /^COMPLEX\.md check before you finish:\nHotspots touched \(1\):\n- src\/a\.js/);
  assert.match(c.reason, /unchanged partners: src\/b\.js \(6 commits together\)/);
  assert.match(c.reason, /then finish\.$/);
  const again = hook('stop', { session_id: sid, cwd: dir }, dir);
  assert.equal(again.stdout, '', 'blocked once per session');
  const active = hook('stop', { session_id: session(), cwd: dir, stop_hook_active: true }, dir);
  assert.equal(active.stdout, '', 'stop_hook_active short-circuits');

  const cursor = parse(hook('cursor-stop', { conversation_id: session(), workspace_roots: [dir] }, dir));
  assert.deepEqual(Object.keys(cursor), ['followup_message']);
  assert.match(cursor.followup_message, /^COMPLEX\.md check before you finish:/);
  assert.equal(hook('cursor-stop', { conversation_id: session(), workspace_roots: [dir] }, dir, ['--mode', 'off']).stdout, '');
});

test('unknown hook kind exits 1 with a message on stderr', () => {
  const r = hook('bogus', {}, makeMappedRepo());
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown hook kind: bogus/);
});
