// The file plan: what a run will create, change or remove, shown before the
// first write. The wiring part is not predicted by a second copy of the
// wiring rules. It comes from a dry run of wire() itself, in a scratch
// directory that holds a copy of every file wire reads, so the plan and the
// real run cannot disagree.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { wire } from './wire.js';
import { TARGETS } from './targets.js';

/* Files wire reads before it writes them: the primary agent files and the
   per target rule, hook and MCP files. */
const WIRE_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.mcp.json',
  '.claude/settings.json', '.claude/rules/complex-md.md',
  '.cursor/hooks.json', '.cursor/mcp.json', '.cursor/rules/complex-md.mdc',
  '.codex/config.toml', '.windsurf/rules/complex-md.md', '.clinerules/complex-md.md',
  '.roo/rules/complex-md.md', '.agents/skills/complex-md.md',
];
/* Brief directories wire clears before it writes, with the name prefix it
   owns in each. */
const BRIEF_DIRS = [['.claude/rules/complex-md', ''], ['.cursor/rules/complex-md', ''], ['.agents/skills', 'complex-md-']];
/* Directories whose presence selects a target. Only their presence is
   copied, never their content. */
const MARKERS = ['.claude', '.cursor', '.openhands', '.agents', '.codex', '.windsurf', '.clinerules', '.roo'];

function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(relative(dir, p).split('\\').join('/'), readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

/**
 * The files wire(root, opts) would create, change or remove, with the map
 * `mapText` as COMPLEX.md. Global registry targets are listed as
 * registrations and never run.
 */
export function planWire(root, mapText, { hooks = true, mcp = false, agents = null } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'complex-md-plan-'));
  try {
    for (const m of MARKERS) if (existsSync(join(root, m))) mkdirSync(join(scratch, m), { recursive: true });
    const copy = (rel) => {
      mkdirSync(dirname(join(scratch, rel)), { recursive: true });
      copyFileSync(join(root, rel), join(scratch, rel));
    };
    for (const f of WIRE_FILES) if (existsSync(join(root, f)) && statSync(join(root, f)).isFile()) copy(f);
    for (const [d, prefix] of BRIEF_DIRS) {
      if (!existsSync(join(root, d))) continue;
      for (const f of readdirSync(join(root, d))) if ((f.endsWith('.md') || f.endsWith('.mdc')) && f.startsWith(prefix) && statSync(join(root, d, f)).isFile()) copy(`${d}/${f}`);
    }
    writeFileSync(join(scratch, 'COMPLEX.md'), mapText);
    const before = snapshot(scratch);
    const local = agents ? agents.filter((a) => !TARGETS[a]?.global) : null;
    const plan = [];
    try {
      wire(scratch, { hooks, mcp, agents: local });
    } catch (e) {
      return [{ path: 'wiring', action: 'error', note: String(e.message || e).replace(scratch, '.') }];
    }
    const after = snapshot(scratch);
    for (const [p, c] of after) {
      if (!before.has(p)) plan.push({ path: p, action: 'create' });
      else if (!before.get(p).equals(c)) plan.push({ path: p, action: 'change' });
    }
    for (const p of before.keys()) if (!after.has(p)) plan.push({ path: p, action: 'remove' });
    plan.sort((a, b) => a.path.localeCompare(b.path));
    for (const a of agents || []) if (TARGETS[a]?.global && mcp) plan.push({ path: `${a} MCP registry`, action: 'register' });
    return plan;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const line = (e) => `  ${e.action.padEnd(6)}  ${e.path}${e.note ? `: ${e.note}` : ''}`;

/** The plan as text: one line per file, then the files written only when a model call fails. */
export function formatPlan(files, fallback = []) {
  if (!files.length && !fallback.length) return 'File plan: no file changes.';
  const out = ['File plan:', ...files.map(line)];
  if (fallback.length) out.push('Only if the model call fails:', ...fallback.map(line));
  return out.join('\n');
}

/**
 * Ask before writing, in a terminal only. With `yes`, or when stdin is not
 * a terminal (CI, a pipe, an agent's shell), it returns true at once and
 * never waits for input. Enter or y means yes; n, end of input or Ctrl+C
 * means no.
 */
export async function confirmPlan({ yes = false, isTTY = Boolean(process.stdin.isTTY && process.stderr.isTTY), input = process.stdin, output = process.stderr } = {}) {
  if (yes || !isTTY) return true;
  const rl = createInterface({ input, output });
  try {
    const answer = await new Promise((resolve) => {
      rl.question('Write these files? [Y/n] ', resolve);
      rl.once('SIGINT', () => rl.close());
      rl.once('close', () => resolve(null));
    });
    return answer !== null && !/^\s*n/i.test(answer);
  } finally {
    rl.close();
  }
}
