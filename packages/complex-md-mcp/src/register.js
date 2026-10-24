// Register this server with the agents a repository uses. The per agent
// knowledge (which file, which format, which CLI for a global registry)
// stays in the core's target table; this module hands it an invocation of
// complex-md-mcp instead of the core.
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TARGETS } from 'complex-md/src/targets.js';

const pkg = createRequire(import.meta.url)('../package.json');

/** The agents that take an MCP server registration. */
export const MCP_TARGETS = Object.keys(TARGETS).filter((n) => TARGETS[n].mcp);

/**
 * How an agent starts the server. The checkout's own bin when the package
 * sits inside the repository being registered; otherwise npx with the
 * version pinned, so a later publish never runs unasked.
 */
export function invocation(root) {
  try {
    const bin = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md-mcp.js'));
    const rel = relative(realpathSync(root), bin);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
      const p = rel.split('\\').join('/');
      const abs = bin.split('\\').join('/');
      return { local: { shell: `node ${p}`, command: 'node', args: [p] }, global: { shell: `node ${abs}`, command: 'node', args: [abs] } };
    }
  } catch {}
  const spec = `complex-md-mcp@${pkg.version}`;
  const npx = { shell: `npx -y ${spec}`, command: 'npx', args: ['-y', spec] };
  return { local: npx, global: npx };
}

/* An entry written by complex-md 0.9 or earlier starts the server through
   the core (`complex-md mcp`). The core no longer carries it, so such an
   entry is replaced rather than kept. The pattern takes a pinned version
   (`complex-md@0.9.2 mcp`) and the checkout's bin, and never matches this
   package's own name. */
const LEGACY = /complex-md(@\S+)?(\.js)?\s+mcp(\s|$)/;
const isLegacy = (line) => LEGACY.test(line);

function dropLegacy(root, names, report) {
  const json = { claude: '.mcp.json', cursor: '.cursor/mcp.json' };
  for (const name of names) {
    if (json[name]) {
      const p = join(root, json[name]);
      if (!existsSync(p)) continue;
      let m;
      try { m = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
      const e = m?.mcpServers?.['complex-md'];
      if (e && isLegacy([e.command, ...(e.args || [])].join(' '))) {
        delete m.mcpServers['complex-md'];
        writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
        report.replaced.push(json[name]);
      }
    } else if (name === 'codex') {
      const p = join(root, '.codex/config.toml');
      if (!existsSync(p)) continue;
      const cur = readFileSync(p, 'utf8');
      const sec = /\n*\[mcp_servers\.complex-md\]\ncommand = (.*)\nargs = \[(.*)\]\n/.exec(cur);
      if (sec && isLegacy(`${JSON.parse(sec[1])} ${sec[2].replace(/"/g, '').replace(/,/g, ' ')}`)) {
        writeFileSync(p, cur.slice(0, sec.index) + (sec.index ? '\n' : '') + cur.slice(sec.index + sec[0].length));
        report.replaced.push('.codex/config.toml');
      }
    }
  }
}

/**
 * Register the server for `agents`, or for the repo-local agents whose
 * config directories exist. Idempotent: an entry already pointing at this
 * package is kept.
 */
export function register(root, { agents = null, log = () => {} } = {}) {
  for (const name of agents || []) {
    if (!MCP_TARGETS.includes(name)) throw new Error(`unknown MCP target "${name}"; one of: ${MCP_TARGETS.join(', ')}`);
  }
  const names = agents || MCP_TARGETS.filter((n) => !TARGETS[n].global && TARGETS[n].detect(root));
  const inv = invocation(root);
  const report = { mcp: [], replaced: [], names };
  dropLegacy(root, names, report);
  for (const name of names) {
    const t = TARGETS[name];
    t.mcp({ root, inv: t.global ? inv.global : inv.local, report, log });
  }
  return report;
}
