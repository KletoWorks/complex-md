// --via <cli>: write the map's prose with an agent CLI the user already has.
//
// The prompt bundle goes to that CLI in its headless print mode, on stdin or
// as a file in .complex-md/, and the map comes back on stdout. The CLI runs
// on the user's machine, under the user's own login or key, exactly as the
// user installed it. complex-md never reads, stores or forwards that login.
//
// Each entry below follows the CLI's own documentation for scripted use
// (the `docs` URL). Every argv is an array handed to spawn with no shell,
// so nothing in the bundle or a model name is ever parsed by a shell. Where
// the CLI has a read-only or plan mode, the entry asks for it: the reply is
// text on stdout, and the agent has no reason to touch a file.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, delimiter, extname } from 'node:path';
import { normalizeOutput } from './generate.js';
import { inventedPaths } from './paths.js';
import { trackedFiles } from './git.js';

export const PROMPT_REL = '.complex-md/prompt.md';
const OUTPUT_RULE =
  'Print the complete COMPLEX.md to standard output: the computed front matter, then the four prose sections. ' +
  'Print nothing before or after it. Do not create, edit or delete any file.';
const STDIN_RULE = `${OUTPUT_RULE} Run no command: every input you need is in this message.`;
const ARG_INSTRUCTION = `Follow the instructions in the text you received on standard input. ${STDIN_RULE}`;
const fileInstruction = (rel) => `Read the file ${rel} in the current directory and follow it exactly. ${OUTPUT_RULE} Run no command other than reading that file.`;
const m = (flag, model) => (model ? [flag, model] : []);

/* name: the --via value. bins: executables to look for, in order.
   input: "stdin" sends the bundle on stdin; "file" writes it to
   .complex-md/prompt.md and names that file in the prompt argument, for a
   CLI whose docs give no stdin input. */
export const VIA_CLIS = [
  { name: 'claude', bins: ['claude'], input: 'stdin', docs: 'https://code.claude.com/docs/en/headless',
    // --tools "" removes every built-in tool; mcp__* removes MCP tools.
    args: ({ model }) => ['-p', '--tools', '', '--disallowedTools', 'mcp__*', '--no-session-persistence', '--output-format', 'text', ...m('--model', model)] },
  { name: 'codex', bins: ['codex'], input: 'stdin', docs: 'https://learn.chatgpt.com/docs/non-interactive-mode',
    args: ({ model }) => ['exec', '--sandbox', 'read-only', '--ephemeral', ...m('--model', model), '-'] },
  { name: 'gemini', bins: ['gemini'], input: 'stdin', docs: 'https://geminicli.com/docs/cli/cli-reference/',
    // --prompt text is appended to the stdin input.
    args: ({ model }) => ['--approval-mode', 'plan', '--output-format', 'text', ...m('--model', model), '--prompt', ARG_INSTRUCTION] },
  { name: 'opencode', bins: ['opencode'], input: 'file', docs: 'https://opencode.ai/docs/cli/',
    args: ({ model, promptRel }) => ['run', ...m('--model', model), fileInstruction(promptRel), '--file', promptRel] },
  { name: 'qwen', bins: ['qwen'], input: 'stdin', docs: 'https://qwenlm.github.io/qwen-code-docs/en/users/features/headless/',
    args: ({ model }) => ['--approval-mode', 'plan', '--output-format', 'text', ...m('--model', model), '--prompt', ARG_INSTRUCTION] },
  { name: 'kimi', bins: ['kimi'], input: 'file', docs: 'https://moonshotai.github.io/kimi-code/en/reference/kimi-command.html',
    args: ({ model, promptRel }) => [...m('--model', model), '--prompt', fileInstruction(promptRel)] },
  { name: 'crush', bins: ['crush'], input: 'stdin', docs: 'https://github.com/charmbracelet/crush/blob/main/internal/cmd/run.go',
    args: ({ model }) => ['run', '--quiet', ...m('--model', model), ARG_INSTRUCTION] },
  { name: 'goose', bins: ['goose'], input: 'stdin', docs: 'https://block.github.io/goose/docs/guides/goose-cli-commands',
    args: ({ model }) => ['run', '--instructions', '-', '--no-session', '--quiet', ...m('--model', model)] },
  { name: 'cursor-agent', bins: ['cursor-agent', 'agent'], input: 'file', docs: 'https://cursor.com/docs/cli/headless',
    // Without --force, print mode proposes changes and applies none.
    // --trust trusts the workspace only; print mode stops without it.
    args: ({ model, promptRel }) => ['--print', '--trust', '--output-format', 'text', ...m('--model', model), fileInstruction(promptRel)] },
  { name: 'copilot', bins: ['copilot'], input: 'stdin', docs: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically',
    args: ({ model }) => ['--silent', '--no-ask-user', '--deny-tool=shell,write', ...(model ? [`--model=${model}`] : [])] },
  { name: 'hermes', bins: ['hermes'], input: 'stdin', docs: 'https://hermes-agent.nousresearch.com/docs/reference/cli-commands',
    args: ({ model }) => ['-z', ARG_INSTRUCTION, ...m('--model', model)] },
  { name: 'openclaw', bins: ['openclaw'], input: 'stdin', docs: 'https://docs.openclaw.ai/cli/agent',
    args: ({ model }) => ['agent', 'exec', '--message-file', '-', ...m('--model', model)] },
];

export const VIA_NAMES = VIA_CLIS.map((c) => c.name);
const byName = new Map(VIA_CLIS.map((c) => [c.name, c]));

function entry(name) {
  const c = byName.get(name);
  if (!c) throw new Error(`unknown --via "${name}"; one of: ${VIA_NAMES.join(', ')}`);
  return c;
}

/** The provider-shaped selection generate() logs and dispatches on. */
export function viaSelection(name, model = null) {
  entry(name);
  return { via: name, name: `via:${name}`, model: model || 'default' };
}

/** The argv for one CLI, and how the bundle reaches it. */
export function viaInvocation(name, { model = null, promptRel = PROMPT_REL } = {}) {
  const c = entry(name);
  return { cli: c, args: c.args({ model, promptRel }), input: c.input };
}

/** The first of `bins` found on PATH (with PATHEXT on Windows), or null. */
export function findExecutable(bins, { env = process.env, platform = process.platform } = {}) {
  const dirs = String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : delimiter).filter(Boolean);
  const exts = platform === 'win32' ? String(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  for (const bin of bins) {
    for (const dir of dirs) {
      for (const ext of exts) {
        for (const cand of ext ? [join(dir, bin + ext.toLowerCase()), join(dir, bin + ext)] : [join(dir, bin)]) {
          try {
            if (statSync(cand).isFile()) return cand;
          } catch {}
        }
      }
    }
  }
  return null;
}

/**
 * The map inside a CLI's stdout: terminal colors removed, then the body of
 * a markdown fence that wraps the map, or everything from the front matter
 * on, or from the first section when the reply has no front matter. Text
 * the CLI prints before the map is dropped.
 */
export function extractMap(stdout) {
  const t = String(stdout || '').replace(/\r\n/g, '\n').replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
  // A fence around the whole map: its body up to the last closing fence.
  const open = /^```(?:markdown|md)?\n(?=---\ncomplex_md:|## Where the risk lives$)/m.exec(t);
  if (open) {
    const body = t.slice(open.index + open[0].length);
    const close = body.lastIndexOf('\n```');
    return close >= 0 ? body.slice(0, close + 1) : body;
  }
  const fm = /^---\ncomplex_md:/m.exec(t);
  if (fm) return t.slice(fm.index);
  const sec = /^## Where the risk lives$/m.exec(t);
  return sec ? t.slice(sec.index) : t;
}

/**
 * The map to write: the computed front matter, the reply's prose, and no
 * path the repository lacks. Throws, like normalizeOutput, rather than
 * return a map that would mislead.
 */
export function checkMap(reply, fm, files) {
  const kept = String(reply).includes(fm.trim());
  const text = normalizeOutput(reply, fm);
  if (!text.startsWith(fm)) throw new Error('the computed front matter did not survive; COMPLEX.md not written');
  const bad = inventedPaths(text.slice(fm.length), files);
  if (bad.length) {
    const shown = bad.slice(0, 5).join(', ') + (bad.length > 5 ? `, and ${bad.length - 5} more` : '');
    throw new Error(`the reply names ${bad.length} path${bad.length === 1 ? '' : 's'} the repository does not have: ${shown}; COMPLEX.md not written`);
  }
  return { text, frontMatterKept: kept };
}

const MAX_STDOUT = 8 * 1024 * 1024;
export const VIA_TIMEOUT_MS = 600000;

function porcelain(root) {
  try {
    return new Set(execFileSync('git', ['status', '--porcelain', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean));
  } catch {
    return new Set();
  }
}

function run(file, args, { cwd, env, input, timeoutMs, label }) {
  return new Promise((resolve, reject) => {
    const posix = process.platform !== 'win32';
    let child;
    try {
      // detached puts the CLI in its own process group, so a timeout stops
      // the tools it started as well.
      child = spawn(file, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: posix, windowsHide: true });
    } catch (e) {
      return reject(new Error(`${label} could not start: ${e.message}`));
    }
    let out = '';
    let err = '';
    let done = false;
    const stop = (sig) => {
      try {
        if (posix) process.kill(-child.pid, sig);
        else child.kill(sig);
      } catch {}
    };
    // The CLI's own process group does not get the terminal's Ctrl-C. Pass
    // the signal on, so the agent stops with complex-md and spends no more.
    const signals = posix ? ['SIGINT', 'SIGTERM', 'SIGHUP'] : [];
    const onSignal = (sig) => {
      stop(sig);
      finish(() => {
        const e = new Error(`${label} stopped: complex-md received ${sig}`);
        e.signal = sig;
        reject(e);
      });
    };
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const s of signals) process.off(s, onSignal);
      fn();
    };
    const timer = setTimeout(() => {
      stop('SIGTERM');
      setTimeout(() => stop('SIGKILL'), 3000).unref();
      finish(() => reject(new Error(`${label} did not finish within ${timeoutMs / 1000} s; pass --via-timeout <seconds> for a longer run`)));
    }, timeoutMs);
    for (const s of signals) process.on(s, onSignal);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      out += d;
      if (out.length > MAX_STDOUT) {
        stop('SIGTERM');
        finish(() => reject(new Error(`${label} printed more than ${MAX_STDOUT / 1024 / 1024} MB; that is not a map`)));
      }
    });
    child.stderr.on('data', (d) => (err = (err + d).slice(-4000)));
    child.on('error', (e) => finish(() => reject(new Error(`${label} could not start: ${e.message}`))));
    child.on('close', (code, signal) => {
      finish(() => {
        if (code === 0) return resolve(out);
        const last = err.trim().split('\n').filter(Boolean).pop() || out.trim().split('\n').filter(Boolean).pop() || 'no output';
        reject(new Error(`${label} exited with ${signal ? `signal ${signal}` : `code ${code}`}: ${last}`));
      });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

/**
 * Run one agent CLI on the bundle and return the checked map as
 * { text, usage }. The CLI's own changes to COMPLEX.md are undone: the
 * caller writes the checked map, or keeps the old one when this throws.
 */
export async function runVia(name, { root, bundle, fm, model = null, timeoutMs = VIA_TIMEOUT_MS, env = process.env, platform = process.platform, log = () => {} }) {
  const { cli, args, input } = viaInvocation(name, { model });
  const file = findExecutable(cli.bins, { env, platform });
  if (!file) throw new Error(`--via ${name}: no ${cli.bins.join(' or ')} executable on PATH. Install it and log in, or pick another --via: ${VIA_NAMES.join(', ')}`);
  if (platform === 'win32' && /^\.(cmd|bat)$/i.test(extname(file))) {
    throw new Error(`--via ${name}: ${file} is a batch shim, and Node.js cannot start a .cmd or .bat file without a shell. complex-md starts agent CLIs without one. Use a native ${cli.bins[0]}.exe, or run complex-md from WSL.`);
  }
  if (input === 'file') {
    mkdirSync(join(root, '.complex-md'), { recursive: true });
    writeFileSync(join(root, PROMPT_REL), bundle);
  }
  const mapPath = join(root, 'COMPLEX.md');
  const before = existsSync(mapPath) ? readFileSync(mapPath) : null;
  const status = porcelain(root);
  log(`via: ${name} (${file}), ${input === 'stdin' ? 'bundle on stdin' : `bundle in ${PROMPT_REL}`}`);
  let stdout;
  let stoppedBy = null;
  try {
    stdout = await run(file, args, { cwd: root, env, input: input === 'stdin' ? `${bundle}\n\n---\n\n${STDIN_RULE}\n` : '', timeoutMs, label: name });
  } catch (e) {
    stoppedBy = e.signal || null;
    throw e;
  } finally {
    const now = existsSync(mapPath) ? readFileSync(mapPath) : null;
    if (before === null ? now !== null : now === null || !before.equals(now)) {
      if (before === null) rmSync(mapPath, { force: true });
      else writeFileSync(mapPath, before);
      log(`note: ${name} wrote COMPLEX.md itself; complex-md put the previous file back and checks the reply instead.`);
    }
    const changed = [...porcelain(root)].filter((l) => !status.has(l) && !/ \.complex-md\//.test(l) && !/ COMPLEX\.md$/.test(l));
    if (changed.length) log(`note: ${name} changed ${changed.length} other path${changed.length === 1 ? '' : 's'} during the run (${changed.slice(0, 5).map((l) => l.slice(3)).join(', ')}); complex-md left them as they are. Review them with git status.`);
    // Interrupted: COMPLEX.md is restored, so exit by the same signal, with
    // no fallback bundle and no wire step after it.
    if (stoppedBy) process.kill(process.pid, stoppedBy);
  }
  const r = checkMap(extractMap(stdout), fm, trackedFiles(root));
  if (!r.frontMatterKept) log(`note: ${name} changed the front matter; complex-md writes the computed one.`);
  return { text: r.text, usage: {} };
}
