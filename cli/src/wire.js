// Stage 3: wire COMPLEX.md into the repository's agent files so it gets
// read, and install the enforcement the research says in-context rules
// cannot provide on their own: path-scoped rules, hooks, and the MCP
// server. Per-harness knowledge lives in targets.js; this file decides
// which targets are active and what invocation they get.
import { readFileSync, writeFileSync, existsSync, appendFileSync, realpathSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrationBlock, BLOCK_HEADING } from './prompts.js';
import { loadComplexMd } from './complexmd.js';
import { pathBriefs } from './brief.js';
import { TARGETS, TARGET_NAMES } from './targets.js';

const PRIMARY = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'];

/**
 * How hooks and the MCP entry invoke the CLI. `npx -y complex-md` when the
 * tool came from the registry; the checkout's own bin when it is being run
 * from inside the repository it is wiring (dogfooding, or a vendored copy),
 * since npx would fetch a different version or nothing at all. Global
 * registries (openclaw, hermes) launch from an arbitrary cwd, so they get
 * the absolute form.
 */
function invocation(root) {
  try {
    const bin = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'complex-md.js'));
    const rel = relative(realpathSync(root), bin);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
      const p = rel.split('\\').join('/');
      const abs = bin.split('\\').join('/');
      return { shell: `node ${p}`, command: 'node', args: [p], absShell: `node ${abs}`, absCommand: 'node', absArgs: [abs] };
    }
  } catch {}
  return { shell: 'npx -y complex-md', command: 'npx', args: ['-y', 'complex-md'], absShell: 'npx -y complex-md', absCommand: 'npx', absArgs: ['-y', 'complex-md'] };
}

/* Prepended only when wire CREATES AGENTS.md, never when it appends to one
   that already exists. complex-md owns the map and its integration block; it
   does not own this repository's conventions and should not look as though it
   does. */
const CREATED_PREAMBLE = `# AGENTS.md

This file was created by complex-md and carries one section: how to read
COMPLEX.md, the structural risk map, before editing a file the map calls hot.
It is not a full agent contract. Anything else this repository expects of an
agent, and any contract it inherits from a parent repository, belongs above
the section below; complex-md appends to this file rather than rewriting it.

`;

/** `agents`: explicit target names (see targets.js); null detects repo-local targets from existing config. */
export function wire(root, { hooks = true, mcp = true, rules = true, agents = null, log = () => {} } = {}) {
  const map = loadComplexMd(root);
  if (!map) throw new Error('No COMPLEX.md at the repository root; generate it first.');
  for (const name of agents || []) if (!TARGETS[name]) throw new Error(`unknown wiring target "${name}"; one of: ${TARGET_NAMES.join(', ')}`);
  const inv = invocation(root);
  const block = integrationBlock();
  /* Coerced rather than trusted. A hand written map can put anything in these
     keys, and wiring crashing on a malformed map helps nobody: the worst
     acceptable outcome is fewer paths, never a stack trace. */
  const list = (v) => (Array.isArray(v) ? v : []);
  const paths = [...new Set([
    ...list(map.hotspots).map((h) => h?.path),
    ...list(map.load_bearing).map((h) => h?.path),
    ...list(map.co_change).flatMap((c) => list(c?.files)),
  ].filter((p) => typeof p === 'string' && p))];
  /* One brief per path, carrying that file's own numbers, paragraph, partners
     and directive, so a scoped rule delivers the answer rather than a pointer
     to the document holding it. */
  const briefs = pathBriefs(map);
  const report = { primary: [], created: [], rules: [], hooks: [], mcp: [], skipped: [] };

  // 1. Primary files. A CLAUDE.md that imports AGENTS.md already carries
  // the block through that import (the shape this function creates), so
  // it is wired, not a candidate for a second copy.
  let any = false;
  const agentsWired = existsSync(join(root, 'AGENTS.md')) && readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(BLOCK_HEADING);
  for (const f of PRIMARY) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    any = true;
    const cur = readFileSync(p, 'utf8');
    if (cur.includes(BLOCK_HEADING) || (f === 'CLAUDE.md' && agentsWired && /^@AGENTS\.md\s*$/m.test(cur))) {
      report.skipped.push(f);
    } else {
      appendFileSync(p, (cur.endsWith('\n') ? '' : '\n') + '\n' + block);
      report.primary.push(f);
    }
    // 2. Claude Code import.
    if (f === 'CLAUDE.md' && !/^@COMPLEX\.md\s*$/m.test(readFileSync(p, 'utf8'))) {
      appendFileSync(p, '\n@COMPLEX.md\n');
      report.primary.push('CLAUDE.md (@COMPLEX.md import)');
    }
  }
  if (!any) {
    /* No primary file existed, so this one is ours to create. It is named
       AGENTS.md, which reads as the whole contract for the repository, and it
       holds one section. Say which, so a reader who arrives at it does not
       take the absence of house rules for their absence in the project, and
       so the next person knows where to put them. Wiring a repository that
       already has a contract appends to it instead and this never runs. */
    writeFileSync(join(root, 'AGENTS.md'), CREATED_PREAMBLE + block);
    report.created.push('AGENTS.md');
  }

  const active = TARGET_NAMES.filter((name) => (agents ? agents.includes(name) : !TARGETS[name].global && TARGETS[name].detect(root)));

  // Claude Code reads CLAUDE.md, not AGENTS.md. Without one, the only wiring
  // it would see is the path-scoped rule, which fires after the file is found.
  if (active.includes('claude') && !existsSync(join(root, 'CLAUDE.md'))) {
    const imports = (existsSync(join(root, 'AGENTS.md')) ? '@AGENTS.md\n' : block + '\n') + '@COMPLEX.md\n';
    writeFileSync(join(root, 'CLAUDE.md'), imports);
    report.created.push('CLAUDE.md');
  }

  // 3-7. Per-target rules, hooks, MCP.
  for (const name of active) {
    const t = TARGETS[name];
    const tinv = t.global ? { shell: inv.absShell, command: inv.absCommand, args: inv.absArgs } : inv;
    const ctx = { root, inv: tinv, block, paths, briefs, report, log };
    if (rules && t.rules) t.rules(ctx);
    if (hooks && t.hooks) t.hooks(ctx);
    if (mcp && t.mcp) t.mcp(ctx);
  }

  for (const [k, v] of Object.entries(report)) if (v.length) log(`${k}: ${v.join(', ')}`);
  return report;
}
