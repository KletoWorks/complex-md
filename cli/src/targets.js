// One entry per agent harness: how it is detected in a repository and how
// COMPLEX.md gets wired into it (path-scoped rules, hooks, MCP). Repo-local
// targets auto-detect from their config directories; global-config targets
// (openclaw, hermes) keep their MCP registry per machine, so they are
// opt-in only via --for and configured through their own CLI, never by
// editing another tool's global file behind the user's back.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export function write(p, content) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

export function readJson(p, fallback) {
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`${p} is not valid JSON; fix it or run with --no-hooks/--no-mcp. (${e.message})`);
  }
}

export function writeJson(p, obj) {
  write(p, JSON.stringify(obj, null, 2) + '\n');
}

// Ours whether installed as `npx -y complex-md hook pre` or as
// `node path/to/complex-md.js hook pre`; the subcommand is the identity.
export function isOurs(command, sub) {
  return new RegExp(`complex-md(\\.js)?\\s+${sub}(\\s|$)`).test(String(command || ''));
}

function hasHook(list, sub) {
  return (list || []).some((g) => (g.hooks || []).some((h) => isOurs(h.command, sub)));
}

function addMcpJson(p, entry, report, label) {
  const m = readJson(p, {});
  m.mcpServers ||= {};
  if (!m.mcpServers['complex-md']) {
    m.mcpServers['complex-md'] = entry;
    writeJson(p, m);
    report.mcp.push(label);
  }
}

function cliAvailable(bin) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * The target table. Each target may implement:
 *   detect(root)      repo markers that opt it in when --for is not given
 *   rules(ctx)        path-scoped rule file
 *   hooks(ctx)        deterministic edit gates
 *   mcp(ctx)          MCP server registration
 * ctx = { root, inv, block, paths, report, log }. All writers are
 * idempotent: existing entries are recognized, never duplicated.
 */
export const TARGETS = {
  claude: {
    detect: (root) => existsSync(join(root, '.claude')) || existsSync(join(root, 'CLAUDE.md')),
    rules({ root, block, paths, report }) {
      write(join(root, '.claude/rules/complex-md.md'), `---\nalwaysApply: false\npaths: ${paths.join(', ')}\n---\n${block}`);
      report.rules.push('.claude/rules/complex-md.md');
    },
    hooks({ root, inv, report }) {
      const p = join(root, '.claude/settings.json');
      const s = readJson(p, {});
      s.hooks ||= {};
      if (!hasHook(s.hooks.PreToolUse, 'hook pre')) {
        (s.hooks.PreToolUse ||= []).push({ matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: `${inv.shell} hook pre`, timeout: 30 }] });
        report.hooks.push('.claude/settings.json PreToolUse');
      }
      if (!hasHook(s.hooks.Stop, 'hook stop')) {
        (s.hooks.Stop ||= []).push({ hooks: [{ type: 'command', command: `${inv.shell} hook stop`, timeout: 60 }] });
        report.hooks.push('.claude/settings.json Stop');
      }
      writeJson(p, s);
    },
    mcp({ root, inv, report }) {
      addMcpJson(join(root, '.mcp.json'), { command: inv.command, args: [...inv.args, 'mcp'] }, report, '.mcp.json');
    },
  },

  cursor: {
    detect: (root) => existsSync(join(root, '.cursor')),
    rules({ root, block, paths, report }) {
      write(join(root, '.cursor/rules/complex-md.mdc'), `---\ndescription: COMPLEX.md structural risk map\nglobs: ${paths.join(', ')}\nalwaysApply: false\n---\n${block}`);
      report.rules.push('.cursor/rules/complex-md.mdc');
    },
    hooks({ root, inv, report }) {
      const p = join(root, '.cursor/hooks.json');
      const h = readJson(p, { version: 1, hooks: {} });
      h.version ||= 1;
      h.hooks ||= {};
      if (!(h.hooks.preToolUse || []).some((x) => isOurs(x.command, 'hook cursor-pre'))) {
        (h.hooks.preToolUse ||= []).push({ command: `${inv.shell} hook cursor-pre`, matcher: 'Write|StrReplace|Edit|MultiEdit|SearchReplace|Delete', timeout: 30 });
        report.hooks.push('.cursor/hooks.json preToolUse');
      }
      if (!(h.hooks.stop || []).some((x) => isOurs(x.command, 'hook cursor-stop'))) {
        (h.hooks.stop ||= []).push({ command: `${inv.shell} hook cursor-stop`, timeout: 60, loop_limit: 1 });
        report.hooks.push('.cursor/hooks.json stop');
      }
      writeJson(p, h);
    },
    mcp({ root, inv, report }) {
      addMcpJson(join(root, '.cursor/mcp.json'), { command: inv.command, args: [...inv.args, 'mcp'] }, report, '.cursor/mcp.json');
    },
  },

  openhands: {
    detect: (root) => existsSync(join(root, '.openhands')) || existsSync(join(root, '.agents')),
    rules({ root, block, paths, report }) {
      write(join(root, '.agents/skills/complex-md.md'), `---\nname: complex-md\npaths:\n${paths.map((p) => `  - "${p}"`).join('\n')}\n---\n${block}`);
      report.rules.push('.agents/skills/complex-md.md');
    },
  },

  codex: {
    detect: (root) => existsSync(join(root, '.codex')),
    mcp({ root, inv, report }) {
      const p = join(root, '.codex/config.toml');
      const cur = existsSync(p) ? readFileSync(p, 'utf8') : '';
      if (!/\[mcp_servers\.complex-md\]/.test(cur)) {
        const args = [...inv.args, 'mcp'];
        appendFileSync(p, (cur && !cur.endsWith('\n') ? '\n' : '') + `\n[mcp_servers.complex-md]\ncommand = ${JSON.stringify(inv.command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(', ')}]\n`);
        report.mcp.push('.codex/config.toml');
      }
    },
  },

  windsurf: {
    detect: (root) => existsSync(join(root, '.windsurf')),
    rules({ root, block, paths, report }) {
      write(join(root, '.windsurf/rules/complex-md.md'), `---\ntrigger: glob\nglobs: ${paths.join(', ')}\n---\n${block}`);
      report.rules.push('.windsurf/rules/complex-md.md');
    },
  },

  cline: {
    detect: (root) => existsSync(join(root, '.clinerules')),
    rules({ root, block, report }) {
      // Cline rules are plain markdown, no path scoping; the block itself
      // tells the agent which files it applies to.
      write(join(root, '.clinerules/complex-md.md'), block);
      report.rules.push('.clinerules/complex-md.md');
    },
  },

  roo: {
    detect: (root) => existsSync(join(root, '.roo')),
    rules({ root, block, report }) {
      write(join(root, '.roo/rules/complex-md.md'), block);
      report.rules.push('.roo/rules/complex-md.md');
    },
  },

  // Global-config targets. Their MCP registry lives per machine, so the
  // registration carries the repo root explicitly (`mcp --root <path>`);
  // the server does not depend on the launch cwd.
  openclaw: {
    global: true,
    mcp({ root, inv, report, log }) {
      const args = ['mcp', 'add', 'complex-md', '--command', inv.command, ...[...inv.args, 'mcp', '--root', root].flatMap((a) => ['--arg', a])];
      if (cliAvailable('openclaw')) {
        try {
          execFileSync('openclaw', args, { stdio: 'pipe' });
          report.mcp.push('openclaw (global registry)');
          return;
        } catch (e) {
          log(`openclaw mcp add failed (${String(e.message).split('\n')[0]}); register manually:`);
        }
      } else {
        log('openclaw CLI not found; register manually:');
      }
      log(`  openclaw ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    },
  },

  hermes: {
    global: true,
    mcp({ root, inv, report, log }) {
      const command = `${inv.shell} mcp --root ${root}`;
      if (cliAvailable('hermes')) {
        try {
          execFileSync('hermes', ['mcp', 'add', 'complex-md', '--command', command], { stdio: 'pipe' });
          report.mcp.push('hermes (global registry)');
          return;
        } catch (e) {
          log(`hermes mcp add failed (${String(e.message).split('\n')[0]}); register manually:`);
        }
      } else {
        log('hermes CLI not found; register manually:');
      }
      log(`  hermes mcp add complex-md --command "${command}"`);
    },
  },
};

export const TARGET_NAMES = Object.keys(TARGETS);
