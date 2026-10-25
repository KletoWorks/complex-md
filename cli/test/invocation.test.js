/* The command a wired hook runs on every edit.
 *
 * An unpinned `npx -y complex-md` costs a registry round trip per edit, runs
 * whatever version was published last, and waits for the hook timeout when
 * the registry is unreachable. These tests pin what wire writes and run the
 * written command in a shell against stand-in binaries, so the fallback
 * order is checked as behaviour, not as a string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { wire } from '../src/wire.js';
import { isOurs } from '../src/targets.js';

const here = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version;
const MAP = '---\ncomplex_md: "0.3"\nhotspots:\n  - path: src/a.js\n    score: 10\n---\n\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run the tests.\n';

function wiredRepo(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-inv-'));
  writeFileSync(join(dir, 'COMPLEX.md'), MAP);
  mkdirSync(join(dir, '.claude'));
  mkdirSync(join(dir, '.cursor'));
  wire(dir, { agents: ['claude', 'cursor'], hooks: true, ...opts });
  const claude = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  const cursor = JSON.parse(readFileSync(join(dir, '.cursor/hooks.json'), 'utf8'));
  return {
    dir,
    pre: claude.hooks.PreToolUse[0].hooks[0].command,
    stop: claude.hooks.Stop[0].hooks[0].command,
    cursorPre: cursor.hooks.preToolUse[0].command,
    cursorStop: cursor.hooks.stop[0].command,
  };
}

function stub(dir, name, label) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, `#!/bin/sh\necho "${label} $*"\n`);
  chmodSync(p, 0o755);
}

/* PATH holds the stand-ins and the system directories only, so a real
   complex-md or npx on this machine cannot answer for a stand-in. */
function runIn(cwd, command, bin) {
  return spawnSync('/bin/sh', ['-c', command], { cwd, encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin` } });
}

test('wired hook commands pin the exact version and never run an unpinned npx', () => {
  const w = wiredRepo();
  for (const c of [w.pre, w.stop, w.cursorPre, w.cursorStop]) {
    assert.ok(c.includes(`complex-md@${VERSION} `), `pinned to ${VERSION}: ${c}`);
    assert.match(c, /npx -y --prefer-offline complex-md@/, 'the npx fallback reads the cache before the registry');
    assert.ok(!/npx -y complex-md\s/.test(c), `no unpinned npx: ${c}`);
  }
});

test('the hook command prefers node_modules/.bin, then a complex-md on PATH, then the pinned npx', () => {
  const w = wiredRepo();
  const bin = join(w.dir, 'stub-bin');
  stub(bin, 'npx', 'npx');
  assert.equal(runIn(w.dir, w.pre, bin).stdout.trim(), `npx -y --prefer-offline complex-md@${VERSION} hook pre`);
  stub(bin, 'complex-md', 'global');
  assert.equal(runIn(w.dir, w.pre, bin).stdout.trim(), 'global hook pre');
  stub(join(w.dir, 'node_modules/.bin'), 'complex-md', 'local');
  assert.equal(runIn(w.dir, w.pre, bin).stdout.trim(), 'local hook pre');
  assert.equal(runIn(w.dir, w.cursorStop, bin).stdout.trim(), 'local hook cursor-stop');
});

test('the hook command passes the exit code of the binary it runs', () => {
  const w = wiredRepo();
  const bin = join(w.dir, 'stub-bin');
  mkdirSync(join(w.dir, 'node_modules/.bin'), { recursive: true });
  writeFileSync(join(w.dir, 'node_modules/.bin/complex-md'), '#!/bin/sh\nexit 2\n');
  chmodSync(join(w.dir, 'node_modules/.bin/complex-md'), 0o755);
  stub(bin, 'npx', 'npx');
  const r = runIn(w.dir, w.pre, bin);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '', 'a failing local binary does not fall through to npx');
});

test('the pinned forms are recognised as ours, so a second wire adds nothing', () => {
  const w = wiredRepo();
  assert.ok(isOurs(w.pre, 'hook pre'));
  assert.ok(isOurs(w.cursorPre, 'hook cursor-pre'));
  assert.ok(!isOurs(w.cursorPre, 'hook pre'));
  assert.ok(isOurs(`npx -y complex-md@${VERSION} hook stop`, 'hook stop'));
  wire(w.dir, { agents: ['claude', 'cursor'], hooks: true });
  const claude = JSON.parse(readFileSync(join(w.dir, '.claude/settings.json'), 'utf8'));
  assert.equal(claude.hooks.PreToolUse.length, 1);
  assert.equal(claude.hooks.Stop.length, 1);
});

test('a second wire rewrites the unpinned commands an earlier version wrote, and keeps their flags', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-inv-legacy-'));
  writeFileSync(join(dir, 'COMPLEX.md'), MAP);
  mkdirSync(join(dir, '.claude'));
  mkdirSync(join(dir, '.cursor'));
  const custom = 'node tools/complex-md.js hook stop';
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: {
    PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'npx -y complex-md hook pre --mode warn', timeout: 30 }] }],
    Stop: [{ hooks: [{ type: 'command', command: custom, timeout: 60 }] }],
  } }));
  writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { preToolUse: [{ command: 'npx -y complex-md hook cursor-pre', matcher: 'Write' }] } }));
  const report = wire(dir, { agents: ['claude', 'cursor'], hooks: true });
  const claude = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  const cursor = JSON.parse(readFileSync(join(dir, '.cursor/hooks.json'), 'utf8'));
  const pre = claude.hooks.PreToolUse[0].hooks[0].command;
  assert.equal(claude.hooks.PreToolUse.length, 1);
  assert.ok(pre.includes(`complex-md@${VERSION} hook pre --mode warn`), pre);
  assert.ok(pre.includes('node_modules/.bin/complex-md hook pre --mode warn'), pre);
  assert.equal(claude.hooks.Stop.length, 1);
  assert.equal(claude.hooks.Stop[0].hooks[0].command, custom, 'a command the user wrote is left alone');
  assert.equal(cursor.hooks.preToolUse.length, 1);
  assert.ok(cursor.hooks.preToolUse[0].command.includes(`complex-md@${VERSION} hook cursor-pre`));
  assert.ok(report.hooks.includes('.claude/settings.json PreToolUse (pinned)'), report.hooks.join(', '));
  assert.ok(report.hooks.includes('.cursor/hooks.json preToolUse (pinned)'), report.hooks.join(', '));
  const again = wire(dir, { agents: ['claude', 'cursor'], hooks: true });
  assert.deepEqual(again.hooks, [], 'a third run changes nothing');
});

test('the MCP entry runs the version-pinned server package through npx', () => {
  const w = wiredRepo({ mcp: true });
  const entry = JSON.parse(readFileSync(join(w.dir, '.mcp.json'), 'utf8')).mcpServers['complex-md'];
  assert.equal(entry.command, 'npx');
  assert.deepEqual(entry.args, ['-y', `complex-md-mcp@${VERSION}`, 'mcp']);
});

/* Hooks are opt in. A default wire writes no hook into any file, so a
   repository that commits its agent settings carries none. */
function bareRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-inv-opt-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), MAP);
  mkdirSync(join(dir, '.claude'));
  mkdirSync(join(dir, '.cursor'));
  return dir;
}

test('a default wire writes no hooks', () => {
  const dir = bareRepo();
  const report = wire(dir, { agents: ['claude', 'cursor'] });
  assert.deepEqual(report.hooks, []);
  assert.ok(!existsSync(join(dir, '.claude/settings.json')), 'no .claude/settings.json');
  assert.ok(!existsSync(join(dir, '.claude/settings.local.json')), 'no .claude/settings.local.json');
  assert.ok(!existsSync(join(dir, '.cursor/hooks.json')), 'no .cursor/hooks.json');
  assert.ok(report.rules.length > 0, 'the briefs are still written');
});

test('a default wire leaves hooks an earlier version wrote untouched, and says how to update them', () => {
  const dir = bareRepo();
  const before = JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'npx -y complex-md hook pre', timeout: 30 }] }] } });
  writeFileSync(join(dir, '.claude/settings.json'), before);
  const lines = [];
  const report = wire(dir, { agents: ['claude', 'cursor'], log: (s) => lines.push(s) });
  assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), before);
  assert.deepEqual(report.hooks, []);
  assert.ok(lines.some((l) => /\.claude\/settings\.json/.test(l) && /--hooks/.test(l)), lines.join('\n'));
});

test('--hooks --local writes the Claude Code hooks to settings.local.json, keeps it out of git, and skips Cursor', () => {
  const dir = bareRepo();
  const report = wire(dir, { agents: ['claude', 'cursor'], hooks: 'local' });
  assert.ok(!existsSync(join(dir, '.claude/settings.json')), 'nothing in the committed settings');
  assert.ok(!existsSync(join(dir, '.cursor/hooks.json')), 'Cursor has no per user project file');
  const local = JSON.parse(readFileSync(join(dir, '.claude/settings.local.json'), 'utf8'));
  assert.ok(local.hooks.PreToolUse[0].hooks[0].command.includes(`complex-md@${VERSION} hook pre`));
  assert.ok(local.hooks.Stop[0].hooks[0].command.includes(`complex-md@${VERSION} hook stop`));
  assert.ok(report.hooks.includes('.claude/settings.local.json PreToolUse'), report.hooks.join(', '));
  assert.ok(report.skipped.some((s) => s.startsWith('.cursor/hooks.json')), report.skipped.join(', '));
  const ignored = spawnSync('git', ['check-ignore', '-q', '.claude/settings.local.json'], { cwd: dir });
  assert.equal(ignored.status, 0, 'git ignores the per user settings file');
  assert.ok(!/settings\.local/.test(existsSync(join(dir, '.gitignore')) ? readFileSync(join(dir, '.gitignore'), 'utf8') : ''), 'the committed .gitignore is not edited');
  const again = wire(dir, { agents: ['claude', 'cursor'], hooks: 'local' });
  assert.deepEqual(again.hooks, [], 'a second run adds nothing');
  const exclude = readFileSync(join(dir, '.git/info/exclude'), 'utf8');
  assert.equal(exclude.split('\n').filter((l) => l === '/.claude/settings.local.json').length, 1);
});
