// One entry per agent harness: how it is detected in a repository and how
// COMPLEX.md gets wired into it (path-scoped rules, hooks, MCP). Repo-local
// targets auto-detect from their config directories; global-config targets
// (openclaw, hermes) keep their MCP registry per machine, so they are
// opt-in only via --for. In the repository they get the portable skill;
// their MCP registry is configured through their own CLI, never by
// editing another tool's global file behind the user's back.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BLOCK_HEADING } from './prompts.js';

/* One rule file per briefed path, in a directory of their own.
 *
 * The alternative, a single rule listing every hot path, is what this
 * replaces: it delivered a pointer rather than an answer, and putting the
 * briefs themselves in one file would push every paragraph into context the
 * moment any one path is touched. Scoped files cost nothing to the paths that
 * are not being edited.
 *
 * The directory is cleared first. Hot paths move between runs, and a brief
 * left behind for a file that is no longer listed is worse than no brief: it
 * is advice that nothing recomputes.
 */
export function writeBriefs(dir, briefs, header, report, label) {
  /* `label.prefix` scopes the clear to this tool's own files. A directory
     that is ours alone (.claude/rules/complex-md/) is cleared wholesale; a
     directory shared with the user's own rules (.agents/skills/) is cleared
     only of files carrying the prefix, so nothing of theirs is ever removed. */
  const prefix = label.prefix || '';
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if ((f.endsWith('.md') || f.endsWith('.mdc')) && f.startsWith(prefix)) rmSync(join(dir, f));
    }
  }
  if (!briefs.length) return;
  mkdirSync(dir, { recursive: true });
  for (const b of briefs) {
    write(join(dir, `${prefix}${b.slug}${label.ext}`), header(b) + b.text);
  }
  report.rules.push(`${label.name} (${briefs.length} paths)`);
}

/* A rule file that holds only the integration block. Every agent that gets
 * one also reads AGENTS.md, so while AGENTS.md carries the block the copy
 * loads it a second time for no gain: the per path briefs carry the value.
 * The copy is then not written, and one an earlier version wrote is removed.
 * Without the block in AGENTS.md the copy is the agent's only source of it.
 */
function blockRule(root, rel, content, carried, report) {
  if (carried) return dropBlockCopy(root, rel, report);
  write(join(root, rel), content);
  report.rules.push(rel);
}

/* Removes a file at a path complex-md once wrote, but only when it still
   holds our heading; a file of the user's at the same path stays. */
export function dropBlockCopy(root, rel, report) {
  const p = join(root, rel);
  if (existsSync(p) && readFileSync(p, 'utf8').includes(BLOCK_HEADING)) {
    rmSync(p);
    report.removed.push(rel);
  }
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

const globRule = (b) => `---\ntrigger: glob\nglobs: ${b.path}\n---\n`;

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

/* The portable skill, in the Agent Skills layout: a folder whose name is the
   skill's `name`, holding SKILL.md. OpenClaw and Hermes Agent both load
   project skills from .agents/skills/<name>/SKILL.md, and only the
   description sits in context until the skill is used. */
export const SKILL_PATH = '.agents/skills/complex-md/SKILL.md';

export function portableSkill(block) {
  return `---
name: complex-md
description: Read COMPLEX.md, this repository's computed map of where edits are risky, before you edit a file it lists, and check a change against it before you finish. Use before an edit to a hotspot, load bearing or co-change file, and before you end a task that changed files.
---

# complex-md

${block.trim()}

## Commands

- \`npx -y complex-md check\` lists the hotspots this change touched, the
  co-change partners it left unchanged and the tests that cover them.
- \`npx -y complex-md wire\` rewrites the per file briefs from the current map.
- \`npx -y complex-md\` regenerates COMPLEX.md, then wires it in again.
`;
}

function writeSkill({ root, block, report }) {
  write(join(root, SKILL_PATH), portableSkill(block));
  if (!report.rules.includes(SKILL_PATH)) report.rules.push(SKILL_PATH);
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
 * ctx = { root, inv, block, paths, briefs, report, log, carried }. All writers are
 * idempotent: existing entries are recognized, never duplicated.
 */
export const TARGETS = {
  claude: {
    detect: (root) => existsSync(join(root, '.claude')) || existsSync(join(root, 'CLAUDE.md')),
    rules({ root, briefs, report }) {
      // CLAUDE.md always carries the block once wire has run: appended,
      // imported from AGENTS.md, or written when CLAUDE.md is created.
      dropBlockCopy(root, '.claude/rules/complex-md.md', report);
      writeBriefs(
        join(root, '.claude/rules/complex-md'),
        briefs,
        (b) => `---\nalwaysApply: false\npaths: ${b.path}\n---\n`,
        report,
        { name: '.claude/rules/complex-md/', ext: '.md' },
      );
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
    rules({ root, block, paths, briefs, report, carried }) {
      blockRule(root, '.cursor/rules/complex-md.mdc', `---\ndescription: COMPLEX.md structural risk map\nglobs: ${paths.join(', ')}\nalwaysApply: false\n---\n${block}`, carried, report);
      writeBriefs(
        join(root, '.cursor/rules/complex-md'),
        briefs,
        (b) => `---\ndescription: COMPLEX.md brief for ${b.path}\nglobs: ${b.path}\nalwaysApply: false\n---\n`,
        report,
        { name: '.cursor/rules/complex-md/', ext: '.mdc' },
      );
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

  /* OpenHands path triggered rules (docs.openhands.dev, Agent Skills spec;
     OpenHands is MIT). A rule at .agents/skills/<name>.md with a `paths:`
     list is injected when the agent reads, edits or creates a matching file,
     once per conversation, and is not advertised to the model. That is the
     per path brief, arrived at independently, so each brief becomes one rule.
     The files are prefixed complex-md- because .agents/skills/ is the user's
     directory too and only ours may be cleared. */
  openhands: {
    detect: (root) => existsSync(join(root, '.openhands')) || existsSync(join(root, '.agents')),
    rules({ root, block, paths, briefs, report, carried }) {
      blockRule(root, '.agents/skills/complex-md.md', `---\nname: complex-md\npaths:\n${paths.map((p) => `  - "${p}"`).join('\n')}\n---\n${block}`, carried, report);
      writeBriefs(
        join(root, '.agents/skills'),
        briefs,
        (b) => `---\nname: complex-md-${b.slug}\ndescription: COMPLEX.md brief for ${b.path}\npaths:\n  - "${b.path}"\n---\n`,
        report,
        { name: '.agents/skills/complex-md-*', ext: '.md', prefix: 'complex-md-' },
      );
    },
  },

  /* Antigravity workspace rules (antigravity.google/docs/rules). Every .md
     file directly in .agents/rules/ needs front matter with a `trigger`; a
     `glob` trigger loads the rule when the agent reads or edits a file that
     `globs` matches. Files in subfolders are ignored, so the briefs sit flat
     with the complex-md- prefix, and only prefixed files are cleared.
     Detected from .agents/rules/ itself: .agents/ alone is shared by
     several agents. */
  antigravity: {
    detect: (root) => existsSync(join(root, '.agents/rules')),
    rules({ root, briefs, report }) {
      writeBriefs(
        join(root, '.agents/rules'),
        briefs,
        (b) => `---\ntrigger: glob\ndescription: COMPLEX.md brief for ${b.path}\nglobs: ${JSON.stringify(b.path)}\n---\n`,
        report,
        { name: '.agents/rules/complex-md-*', ext: '.md', prefix: 'complex-md-' },
      );
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

  /* GitHub Copilot path instructions (docs.github.com, "Adding repository
     custom instructions"). A file under .github/instructions/ named
     *.instructions.md, with an `applyTo` glob in its front matter, is read
     by Copilot code review and the Copilot cloud agent for the files that
     glob matches. Code review reads it from the pull request's head
     branch, so each brief reaches the review of every change to its file
     with nothing installed by the reviewer. Subfolders are allowed, so the
     briefs get a folder that is ours alone. Detected from Copilot's own
     files, never from .github/, which nearly every repository has. */
  copilot: {
    detect: (root) => existsSync(join(root, '.github/copilot-instructions.md')) || existsSync(join(root, '.github/instructions')),
    rules({ root, briefs, report }) {
      writeBriefs(
        join(root, '.github/instructions/complex-md'),
        briefs,
        (b) => `---\napplyTo: ${JSON.stringify(b.path)}\n---\n`,
        report,
        { name: '.github/instructions/complex-md/', ext: '.instructions.md' },
      );
    },
  },

  /* Claude Code Review reads REVIEW.md at the repository root and puts a
     root file in place of a line that holds only `@` and its name
     (code.claude.com, "Customize Code Review"). REVIEW.md belongs to the
     team, so wire adds that one line to a file that exists and never
     creates one. A line inside an open code fence or HTML comment would
     stay plain text, so an ending like that gets nothing. */
  review: {
    detect: (root) => existsSync(join(root, 'REVIEW.md')),
    rules({ root, report }) {
      const p = join(root, 'REVIEW.md');
      if (!existsSync(p)) return void report.skipped.push('REVIEW.md (absent, not created)');
      const cur = readFileSync(p, 'utf8');
      if (/^@COMPLEX\.md\s*$/m.test(cur)) return void report.skipped.push('REVIEW.md');
      const fences = (cur.match(/^\s*(```|~~~)/gm) || []).length;
      if (fences % 2 || cur.lastIndexOf('<!--') > cur.lastIndexOf('-->')) {
        return void report.skipped.push('REVIEW.md (ends inside a code fence or comment)');
      }
      appendFileSync(p, (cur.endsWith('\n') ? '' : '\n') + '\n@COMPLEX.md\n');
      report.primary.push('REVIEW.md (@COMPLEX.md include)');
    },
  },

  /* Devin Desktop, formerly Windsurf (docs.devin.ai, Cascade memories and
     rules). Workspace rules live in .devin/rules/*.md, with
     .windsurf/rules/*.md as the fallback, at most 12,000 characters each.
     A `glob` trigger applies a rule when the agent reads or edits a file
     that `globs` matches. Each target writes its own folder flat, with the
     complex-md- prefix, and clears only prefixed files. */
  devin: {
    detect: (root) => existsSync(join(root, '.devin')),
    rules({ root, briefs, report }) {
      writeBriefs(join(root, '.devin/rules'), briefs, globRule, report, { name: '.devin/rules/complex-md-*', ext: '.md', prefix: 'complex-md-' });
    },
  },

  /* Kiro steering (kiro.dev/docs/steering). A file in .kiro/steering/ with
     `inclusion: fileMatch` loads when a file that `fileMatchPattern`
     matches is in the conversation. The folder holds the user's own
     steering too, so the briefs carry the complex-md- prefix and only
     prefixed files are cleared. */
  kiro: {
    detect: (root) => existsSync(join(root, '.kiro')),
    rules({ root, briefs, report }) {
      writeBriefs(
        join(root, '.kiro/steering'),
        briefs,
        (b) => `---\ninclusion: fileMatch\nfileMatchPattern: ${JSON.stringify(b.path)}\n---\n`,
        report,
        { name: '.kiro/steering/complex-md-*', ext: '.md', prefix: 'complex-md-' },
      );
    },
  },

  windsurf: {
    detect: (root) => existsSync(join(root, '.windsurf')),
    rules({ root, block, paths, briefs, report, carried }) {
      blockRule(root, '.windsurf/rules/complex-md.md', `---\ntrigger: glob\nglobs: ${paths.join(', ')}\n---\n${block}`, carried, report);
      writeBriefs(join(root, '.windsurf/rules'), briefs, globRule, report, { name: '.windsurf/rules/complex-md-*', ext: '.md', prefix: 'complex-md-' });
    },
  },

  /* Cline conditional rules (docs.cline.bot, Cline rules). A file in
     .clinerules/ whose front matter carries a `paths:` list of globs
     applies when the agent works on a matching file. The folder is the
     user's too, so the briefs carry the complex-md- prefix. An older Cline
     layout is a single .clinerules FILE; that is not a folder to write
     into, so it is neither detected nor touched. */
  cline: {
    detect: (root) => isDir(join(root, '.clinerules')),
    rules({ root, block, briefs, report, carried }) {
      if (existsSync(join(root, '.clinerules')) && !isDir(join(root, '.clinerules'))) {
        return void report.skipped.push('.clinerules (a file, not a folder)');
      }
      blockRule(root, '.clinerules/complex-md.md', block, carried, report);
      writeBriefs(
        join(root, '.clinerules'),
        briefs,
        (b) => `---\npaths:\n  - ${JSON.stringify(b.path)}\n---\n`,
        report,
        { name: '.clinerules/complex-md-*', ext: '.md', prefix: 'complex-md-' },
      );
    },
  },

  /* Roo Code reads AGENTS.md and offers no path scoped rule, so a file here
     could only repeat the block. The target stays so `--for roo` keeps
     working and a rewire removes the copy earlier versions wrote. */
  roo: {
    detect: (root) => existsSync(join(root, '.roo')),
    rules({ root, report }) {
      dropBlockCopy(root, '.roo/rules/complex-md.md', report);
    },
  },

  // Global-config targets. Their MCP registry lives per machine, so the
  // registration carries the repo root explicitly (`mcp --root <path>`);
  // the server does not depend on the launch cwd.
  openclaw: {
    global: true,
    rules: writeSkill,
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
    rules(ctx) {
      writeSkill(ctx);
      ctx.log('hermes loads project skills once the repository is trusted: run `hermes skills trust` in it.');
    },
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
