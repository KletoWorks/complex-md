#!/usr/bin/env node
import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../package.json');
let argv = process.argv.slice(2);
if (argv[0] === 'mcp') argv = argv.slice(1);
const cmd = !argv[0] || argv[0] === '--root' ? 'serve' : argv[0];
const args = cmd === 'serve' ? argv : argv.slice(1);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const log = (s) => process.stderr.write(s + '\n');

const HELP = `complex-md-mcp ${pkg.version}  https://complex.md

The optional MCP server for COMPLEX.md: six tools for an agent to inspect
the map, repository impact and covering tests.

  npx complex-md-mcp [--root <repo>]       serve on stdio
  npx complex-md-mcp register              register it with detected agents
                                           --for claude,cursor,codex,openclaw,hermes`;

async function main() {
  if (cmd === '--version' || cmd === '-v') return console.log(pkg.version);
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP);

  if (cmd === 'serve') {
    const { serveStdio } = await import('../src/server.js');
    return serveStdio(opt('--root') || process.cwd());
  }

  if (cmd === 'register') {
    const { repoRoot } = await import('complex-md/src/git.js');
    const root = repoRoot(process.cwd());
    if (!root) {
      log('complex-md-mcp: not inside a git repository; run register from the repository the server is for.');
      process.exitCode = 2;
      return;
    }
    const { register } = await import('../src/register.js');
    const r = register(root, { agents: opt('--for')?.split(','), log });
    if (!r.names.length) {
      log('complex-md-mcp: no agent config found (.claude, CLAUDE.md, .cursor or .codex). Name one: register --for claude');
      process.exitCode = 2;
      return;
    }
    if (r.replaced.length) log(`replaced the entry that started the server through complex-md: ${r.replaced.join(', ')}`);
    log(r.mcp.length ? `registered: ${r.mcp.join(', ')}` : 'already registered; nothing changed');
    return;
  }

  log(`unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exitCode = 2;
}

main().catch((e) => {
  log(`complex-md-mcp: ${e.message}`);
  process.exitCode = 1;
});
