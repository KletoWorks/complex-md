// The file plan: what a run will create, change or remove, shown before the
// first write. The wiring part is not predicted by a second copy of the
// wiring rules. It comes from a dry run of wire() itself, in a scratch
// directory that mirrors every place wire reads or writes: the files at the
// repository root and the dot directories, where agent configuration lives.
// No list of target paths is kept here, so a new target needs no change.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { wire } from './wire.js';
import { TARGETS } from './targets.js';

/* Never mirrored: git itself, dependencies, nested worktrees, the CLI's own
   working directory, the map (the plan supplies it), and dot directories
   that hold caches or environments, never agent configuration. A file over
   1 MB is no agent configuration either. The deepest path wire writes is
   three folders down (.github/instructions/complex-md/), so the mirror stops
   there, which also bounds a symbolic link loop. */
const SKIP = new Set([
  '.git', 'node_modules', 'worktrees', '.complex-md', 'COMPLEX.md',
  '.venv', '.tox', '.nox', '.cache', '.yarn', '.pnpm-store', '.next', '.nuxt', '.svelte-kit', '.turbo',
  '.gradle', '.terraform', '.mypy_cache', '.pytest_cache', '.ruff_cache', '.hg', '.svn', '.direnv',
]);
const MAX_BYTES = 1 << 20;
const MAX_DEPTH = 3;

function mirror(src, dest, depth = 0) {
  for (const name of readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const from = join(src, name);
    let st;
    try {
      st = statSync(from);
    } catch {
      continue;
    }
    if (st.isFile() && st.size <= MAX_BYTES) {
      mkdirSync(dest, { recursive: true });
      copyFileSync(from, join(dest, name));
    } else if (st.isDirectory() && depth < MAX_DEPTH && (depth > 0 || name.startsWith('.'))) {
      mkdirSync(join(dest, name), { recursive: true });
      mirror(from, join(dest, name), depth + 1);
    }
  }
}

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
export function planWire(root, mapText, { hooks = false, mcp = false, agents = null } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'complex-md-plan-'));
  try {
    mirror(root, scratch);
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

/**
 * The plan as text: one line per file, then the files a keyed run writes
 * once the model call returns (the wiring), then the files written only
 * when the call fails.
 */
export function formatPlan(files, fallback = [], after = []) {
  if (!files.length && !fallback.length && !after.length) return 'File plan: no file changes.';
  const out = ['File plan:', ...files.map(line)];
  if (after.length) out.push('After the model call:', ...after.map(line));
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
