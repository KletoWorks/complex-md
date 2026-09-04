#!/usr/bin/env node
import { createRequire } from 'node:module';
import { repoRoot, hasCommits } from '../src/git.js';

const pkg = createRequire(import.meta.url)('../package.json');
const [, , cmd = 'generate', ...args] = process.argv;
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const log = (s) => process.stderr.write(s + '\n');

const HELP = `complex-md ${pkg.version}  https://complex.md

  npx complex-md                 generate COMPLEX.md, then wire it in (hooks, rules, MCP)
  npx complex-md generate        same; --agent writes the prompt bundle for your agent instead of calling a model
                                 --model <id>  --provider <name>  --no-wire  --no-hooks  --no-mcp
  npx complex-md wire            wire an existing COMPLEX.md into agent files (idempotent)
                                 --for claude,cursor,openhands,codex,windsurf,cline,roo,openclaw,hermes
                                 (default: detect repo-local targets; openclaw/hermes are global registries,
                                  opt-in only, wired through their own CLIs)
  npx complex-md check           report hotspots and untouched co-change partners in the current change
                                 --staged | --base <ref> | --json | --strict (exit 1 on findings)
  npx complex-md signals         print the signals table  (--json | --tsv)
  npx complex-md mcp             run the MCP server on stdio (lookup, where_to_look, impact, refs, check, refresh)
  npx complex-md hook <kind>     hook handler: pre | stop | cursor-pre | cursor-stop   [--mode gate|warn|off]

Model call: the first configured provider wins, or pick one with --provider / --model provider/id.
Keys: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, XAI_API_KEY,
DEEPSEEK_API_KEY, MISTRAL_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY; local Ollama via OLLAMA_HOST;
any OpenAI-compatible endpoint via COMPLEX_MD_BASE_URL (+ COMPLEX_MD_API_KEY).
Without any of them the prompt bundle goes to .complex-md/prompt.md for the agent you already run.
Nothing leaves the machine except the signals table and the top hotspot files, in that one call.`;

async function main() {
  if (cmd === '--version' || cmd === '-v') return console.log(pkg.version);
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP);

  if (cmd === 'hook') {
    const { runHook } = await import('../src/hook.js');
    return runHook(args[0], args.slice(1));
  }

  // Global MCP registries (openclaw, hermes) launch the server from an
  // arbitrary cwd; --root pins it to the repository it was wired for.
  if (cmd === 'mcp') {
    const { serveStdio } = await import('../src/mcp.js');
    return serveStdio(opt('--root') || process.cwd());
  }

  const root = repoRoot(process.cwd());
  if (!root) {
    log('complex-md: not inside a git repository. It reads git history; run it from inside a checked-out repository.');
    process.exit(2);
  }
  if (!hasCommits(root)) {
    log('complex-md: this repository has no commits yet; the map needs history. Make a first commit and run again.');
    process.exit(2);
  }

  if (cmd === 'signals') {
    const { computeSignals, toTsv } = await import('../src/signals.js');
    const s = computeSignals(root);
    if (flag('--json')) return console.log(JSON.stringify({ ...s, importers: undefined, table: undefined }, null, 2));
    console.log(toTsv(s));
    const p = s.profile;
    console.error(`\n${s.files_analyzed} rankable files, ${p.dependency_edges} dependency edges; ${s.commits_analyzed} of the last ${s.window_commits} commits (${p.window_from} to ${p.window_to}), ${s.fix_commits} fixes; hotspot cut ${p.hotspot_cut}; confidence: ${p.confidence}.`);
    if (s.load_bearing.length) { console.error('load-bearing (untouched in the window):'); for (const h of s.load_bearing) console.error(`  fan_in ${h.fan_in}  tests ${h.tests}  ${h.path}`); }
    if (s.co_change.length) { console.error('co-change:'); for (const c of s.co_change) console.error(`  ${c.count}  coupling ${c.coupling}%  ${c.files[0]}  +  ${c.files[1]}`); }
    if (s.seams.length) { console.error('seams (directories that move together):'); for (const c of s.seams) console.error(`  ${c.count}  coupling ${c.coupling}%  ${c.dirs[0]}  +  ${c.dirs[1]}`); }
    for (const b of s.blind_spots) console.error(`note: ${b}`);
    return;
  }

  if (cmd === 'check') {
    const { runCheck, formatCheck } = await import('../src/check.js');
    const f = runCheck(root, { base: opt('--base'), staged: flag('--staged') });
    if (flag('--json')) console.log(JSON.stringify(f, null, 2));
    else console.log(formatCheck(f));
    if (flag('--strict') && !f.clean) process.exit(1);
    return;
  }

  if (cmd === 'wire') {
    const { wire } = await import('../src/wire.js');
    wire(root, { hooks: !flag('--no-hooks'), mcp: !flag('--no-mcp'), agents: opt('--for')?.split(','), log });
    return;
  }

  if (cmd === 'generate') {
    const { generate } = await import('../src/generate.js');
    const r = await generate(root, { model: opt('--model'), provider: opt('--provider'), agent: flag('--agent'), log });
    if (r.written && !flag('--no-wire')) {
      const { wire } = await import('../src/wire.js');
      wire(root, { hooks: !flag('--no-hooks'), mcp: !flag('--no-mcp'), agents: opt('--for')?.split(','), log });
    }
    return;
  }

  log(`unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exit(2);
}

main().catch((e) => {
  log(`complex-md: ${e.message}`);
  process.exit(1);
});
