// Hook handlers. Deterministic enforcement of the two rules in-context
// instructions follow least reliably: read the hotspot paragraph before the
// first edit, and account for co-change partners before the turn ends.
//
//   complex-md hook pre          Claude Code PreToolUse (Edit|Write|MultiEdit|NotebookEdit)
//   complex-md hook stop         Claude Code Stop
//   complex-md hook cursor-pre   Cursor preToolUse
//   complex-md hook cursor-stop  Cursor stop
//
// Modes (--mode or COMPLEX_MD_GATE): gate (default) denies the first edit of a
// hotspot per session and hands back the paragraph; warn lets the edit through
// with the paragraph attached; off does nothing.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, isAbsolute, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { repoRoot, changedFiles, git } from './git.js';
import { loadComplexMd } from './complexmd.js';
import { runCheck, formatCheck } from './check.js';

const FILE_KEYS = ['file_path', 'path', 'target_file', 'filePath', 'notebook_path', 'target_notebook'];

function readStdin() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function stateFile(key) {
  const dir = join(tmpdir(), 'complex-md');
  mkdirSync(dir, { recursive: true });
  return join(dir, `session-${String(key || 'default').replace(/[^\w.-]/g, '_')}.json`);
}

function loadState(key) {
  const p = stateFile(key);
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {}
  }
  return { started: Math.floor(Date.now() / 1000), acknowledged: [], stopBlocked: false };
}

function saveState(key, st) {
  writeFileSync(stateFile(key), JSON.stringify(st));
}

function filePathFrom(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  for (const k of FILE_KEYS) if (typeof toolInput[k] === 'string' && toolInput[k]) return toolInput[k];
  return null;
}

function relPath(root, p) {
  const abs = isAbsolute(p) ? p : resolve(root, p);
  const rel = relative(root, abs);
  return rel.startsWith('..') ? null : rel.split('\\').join('/');
}

function fmtRow(r, front = {}) {
  if (r.load_bearing) {
    const bits = [`untouched in the last ${front.window_commits || 'analyzed'} commits`, `${r.fan_in} files depend on it`];
    if (r.tests === 0) bits.push('no test references it');
    return bits.join(', ');
  }
  const window = front.window_commits ? `${r.churn} of the last ${front.window_commits} commits touched it` : `${r.churn} commits in ${front.window_months ? `${front.window_months} months` : 'the window'}`;
  const bits = [`score ${r.score}`, window];
  if (typeof r.fixes === 'number') bits.push(`${r.fixes} of them bug fixes`);
  if (typeof r.fan_in === 'number') bits.push(`${r.fan_in} files depend on it`);
  if (r.tests === 0) bits.push('no test references it');
  return bits.join(', ');
}

/** Decide what to say about an edit to `rel`. Returns { kind: 'deny'|'context'|'none', text }. */
export function adviseEdit(root, rel, state, mode) {
  const map = loadComplexMd(root);
  if (!map || mode === 'off') return { kind: 'none' };
  const row = map.row(rel);
  const all = map.partnersOf(rel).sort((a, b) => b.count - a.count);
  const partners = all.slice(0, 3);
  const more = all.length - partners.length;
  if (!row && all.length === 0) return { kind: 'none' };

  if (row) {
    const first = !state.acknowledged.includes(rel);
    const para = map.paragraphFor(rel);
    const lines = [`COMPLEX.md: ${rel} is ${row.load_bearing ? 'load-bearing' : 'a hotspot'} (${fmtRow(row, map.front)}).`];
    if (para) lines.push('', para);
    else if (map.riskSummary) lines.push('', map.riskSummary.split(/\n\s*\n/)[0]);
    if (partners.length) lines.push('', `Co-change partners: ${partners.map((p) => `${p.partner} (${p.count} commits)`).join(', ')}${more ? `, and ${more} more in COMPLEX.md` : ''}. Open them and state whether they need a change.`);
    if (first) {
      state.acknowledged.push(rel);
      if (mode === 'gate') {
        lines.push('', 'This first edit was held so you read the paragraph. Do what its last sentence says, then re-issue the edit; further edits to this file in this session go through.');
        return { kind: 'deny', text: lines.join('\n') };
      }
      return { kind: 'context', text: lines.join('\n') };
    }
    return { kind: 'none' };
  }
  // Co-change partner only: never held, reminded once.
  if (!state.acknowledged.includes(rel)) {
    state.acknowledged.push(rel);
    return {
      kind: 'context',
      text: `COMPLEX.md: ${rel} moves with ${partners.map((p) => `${p.partner} (${p.count} commits)`).join(', ')}. Open the partner and state in your change description whether it also needs a change.`,
    };
  }
  return { kind: 'none' };
}

/** Files touched this session: working tree changes plus commits since the session started. */
function sessionFiles(root, state) {
  const set = new Set(changedFiles(root));
  if (state.started) {
    const out = git(['log', `--since=${state.started}`, '--name-only', '--pretty=format:'], { cwd: root, allowFail: true });
    out.split('\n').filter(Boolean).forEach((f) => set.add(f));
  }
  return [...set];
}

export function stopAdvice(root, state) {
  const files = sessionFiles(root, state);
  if (files.length === 0) return null;
  const f = runCheck(root, { files });
  if (!f.map_present || f.clean) return null;
  const body = formatCheck(f, { heading: false });
  return `COMPLEX.md check before you finish:\n${body}\nAddress these (run the tests, and say in your summary whether each untouched partner needed a change), then finish.`;
}

export function runHook(kind, args = []) {
  const modeArg = args.indexOf('--mode');
  const mode = modeArg >= 0 ? args[modeArg + 1] : process.env.COMPLEX_MD_GATE || 'gate';
  const input = readStdin();
  const cwd = input.cwd || input.workspace_roots?.[0] || process.cwd();
  const repo = repoRoot(cwd);
  // Outside a repository there is no map and no diff: let the tool proceed
  // without a word (an allow for the edit hooks, silence for the stop hooks).
  if (!repo) {
    if (kind === 'pre' || kind === 'cursor-pre') return finish(kind, { kind: 'none' });
    return process.exit(0);
  }
  const root = repo;
  const sessionKey = input.session_id || input.conversation_id || 'default';
  const state = loadState(sessionKey);

  if (kind === 'pre' || kind === 'cursor-pre') {
    const p = filePathFrom(input.tool_input);
    const rel = p ? relPath(root, p) : null;
    if (!rel) return finish(kind, { kind: 'none' });
    const advice = adviseEdit(root, rel, state, mode);
    saveState(sessionKey, state);
    return finish(kind, advice);
  }

  if (kind === 'stop' || kind === 'cursor-stop') {
    if (mode === 'off' || input.stop_hook_active || state.stopBlocked) return process.exit(0);
    const text = stopAdvice(root, state);
    if (!text) return process.exit(0);
    state.stopBlocked = true;
    saveState(sessionKey, state);
    if (kind === 'stop') process.stdout.write(JSON.stringify({ decision: 'block', reason: text }) + '\n');
    else process.stdout.write(JSON.stringify({ followup_message: text }) + '\n');
    return process.exit(0);
  }

  process.stderr.write(`unknown hook kind: ${kind}\n`);
  process.exit(1);
}

function finish(kind, advice) {
  if (kind === 'pre') {
    if (advice.kind === 'deny') {
      out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: advice.text } });
    } else if (advice.kind === 'context') {
      // No permissionDecision: the user's normal permission flow is untouched.
      out({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: advice.text } });
    }
  } else if (kind === 'cursor-pre') {
    if (advice.kind === 'deny') out({ permission: 'deny', agent_message: advice.text, user_message: 'COMPLEX.md held the first edit of a hotspot so the agent reads its paragraph.' });
    else if (advice.kind === 'context') out({ permission: 'allow', agent_message: advice.text });
    else out({ permission: 'allow' });
  }
  process.exit(0);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
