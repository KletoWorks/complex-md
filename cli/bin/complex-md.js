#!/usr/bin/env node
import { createRequire } from 'node:module';
import { repoRoot, hasCommits, resolvesCommit } from '../src/git.js';

const pkg = createRequire(import.meta.url)('../package.json');
const [, , cmd = 'generate', ...args] = process.argv;
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const log = (s) => process.stderr.write(s + '\n');

const HELP = `complex-md ${pkg.version}  https://complex.md

  npx complex-md                 generate COMPLEX.md, then wire it in (rules per hot path, hooks)
  npx complex-md generate        same; --agent writes the prompt bundle for your agent instead of calling a model
                                 --model <id>  --provider <name>  --no-wire  --no-hooks
  npx complex-md wire            wire an existing COMPLEX.md into agent files (idempotent)
                                 --no-hooks  --for {targets}
                                 (default: detect repo-local targets; openclaw/hermes are opt-in only and get
                                  .agents/skills/complex-md/SKILL.md)
                                 --mcp also registers the MCP server; openclaw/hermes are global
                                 registries, wired with --mcp --for openclaw,hermes through their own CLIs
  npx complex-md impact <path>   what changing a file reaches, against .complex-md/bounds.json
                                 --json | --strict (exit 1 when a declared bound is exceeded)
  npx complex-md check           report hotspots, untouched co-change partners and hand edited briefs in the change
                                 --staged | --base <ref> | --json | --strict (exit 1 on findings)
  npx complex-md signals         print the signals table  (--json | --tsv)
  npx complex-md report          render COMPLEX.md as a page: .complex-md/report.html (treemap, directives,
                                 co-change, blind spots); one self contained file, no network
  npx complex-md hook <kind>     hook handler: pre | stop | cursor-pre | cursor-stop   [--mode gate|warn|off]

Model call: the first configured provider wins, or pick one with --provider / --model provider/id.
Keys: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, XAI_API_KEY,
DEEPSEEK_API_KEY, MISTRAL_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY; local Ollama via OLLAMA_HOST;
any OpenAI-compatible endpoint via COMPLEX_MD_BASE_URL (+ COMPLEX_MD_API_KEY).
Without any of them the prompt bundle goes to .complex-md/prompt.md for the agent you already run.
Without a key nothing is sent. With one, that call sends the signals and excerpts of up to ten
hotspot files, about 60,000 characters of code at most, to the provider you chose.`;

/* The --for names come from the target table, so the list in --help
   cannot drift from what wire accepts. targets.js loads only when help
   prints, so a hook run does not pay for it. */
async function help() {
  const { OFFERED_TARGETS } = await import('../src/targets.js');
  return HELP.replace(/^(.*)\{targets\}$/m, (_, lead) => {
    const indent = ' '.repeat(lead.length - lead.trimStart().length);
    const lines = [lead];
    OFFERED_TARGETS.forEach((name, i) => {
      const piece = name + (i < OFFERED_TARGETS.length - 1 ? ',' : '');
      if (lines.at(-1).length + piece.length > 115) lines.push(indent);
      lines[lines.length - 1] += piece;
    });
    return lines.join('\n');
  });
}

async function main() {
  if (cmd === '--version' || cmd === '-v') return console.log(pkg.version);
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(await help());

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

  // The report reads the map, not the history: it needs no commits, and
  // outside a repository it reads COMPLEX.md in the current directory.
  if (cmd === 'report') {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { writeReport } = await import('../src/report.js');
    const dir = repoRoot(process.cwd()) || process.cwd();
    const out = writeReport(dir, { version: pkg.version });
    if (!out) {
      log(existsSync(join(dir, 'COMPLEX.md'))
        ? `complex-md: ${join(dir, 'COMPLEX.md')} has no front matter block to read. Regenerate it with npx complex-md, then run npx complex-md report again.`
        : `complex-md: no COMPLEX.md in ${dir}. Make one with npx complex-md (or npx complex-md generate --agent to have your coding agent write it), then run npx complex-md report again.`);
      process.exit(2);
    }
    console.log(out);
    return;
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
    const base = opt('--base');
    if (flag('--base') && (!base || base.startsWith('-'))) {
      log('complex-md: --base needs a ref, for example --base origin/main.');
      process.exit(2);
    }
    /* A diff against a ref that does not exist is empty, and an empty diff
       reads as a clean change. A shallow CI checkout has no other branch, so
       the gate passed on every pull request without running. */
    if (base && !resolvesCommit(root, base)) {
      log(`complex-md: the base ref ${base} does not exist in this checkout, so there is no change to check. A shallow CI checkout fetches one commit and no other branch: fetch the history first (actions/checkout with fetch-depth: 0, or git fetch origin).`);
      process.exit(2);
    }
    const { runCheck, formatCheck } = await import('../src/check.js');
    const f = runCheck(root, { base, staged: flag('--staged') });
    if (flag('--json')) console.log(JSON.stringify(f, null, 2));
    else console.log(formatCheck(f));
    if (flag('--strict') && !f.clean) process.exit(1);
    return;
  }

  if (cmd === 'impact') {
    const target = args.find((a) => !a.startsWith('-') && a !== 'impact');
    if (!target) { console.error('usage: complex-md impact <path>'); process.exit(2); }
    const { graphFor } = await import('../src/signals.js');
    const { loadComplexMd } = await import('../src/complexmd.js');
    const { analyse, loadBounds, formatImpact, boundariesFor, BOUNDS_PATH } = await import('../src/impact.js');
    const bounds = loadBounds(root);
    if (bounds?.__invalid) {
      console.error(`${BOUNDS_PATH} is not readable JSON; refusing to report as if no bounds were declared.`);
      process.exit(2);
    }
    const a = analyse(target, {
      graph: graphFor(root),
      map: loadComplexMd(root),
      bounds,
      /* Submodule and workspace boundaries, when the repository has any.
         Reaching twelve files in one package and twelve across four is a
         different consequence and was previously the same number. */
      boundaryOf: boundariesFor(root),
    });
    if (flag('--json')) console.log(JSON.stringify(a, null, 2));
    else console.log(formatImpact(a));
    if (flag('--strict') && a.status === 'over') process.exit(1);
    return;
  }

  if (cmd === 'wire') {
    const { wire } = await import('../src/wire.js');
    wire(root, { hooks: !flag('--no-hooks'), mcp: flag('--mcp'), agents: opt('--for')?.split(','), log });
    return;
  }

  if (cmd === 'generate') {
    const { generate } = await import('../src/generate.js');
    const r = await generate(root, { model: opt('--model'), provider: opt('--provider'), agent: flag('--agent'), log });
    if (r.written && !flag('--no-wire')) {
      const { wire } = await import('../src/wire.js');
      wire(root, { hooks: !flag('--no-hooks'), mcp: flag('--mcp'), agents: opt('--for')?.split(','), log });
    }
    return;
  }

  log(`unknown command: ${cmd}\n`);
  console.log(await help());
  process.exit(2);
}

main().catch((e) => {
  log(`complex-md: ${e.message}`);
  process.exit(1);
});
