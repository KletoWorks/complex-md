// Stage 3: wire COMPLEX.md into the repository's agent files so it gets
// read: the block, and a path scoped brief per listed file. The hooks and
// the MCP server are written only when asked for. Per-harness knowledge
// lives in targets.js; this file decides which targets are active and what
// invocation they get.
import { readFileSync, writeFileSync, existsSync, realpathSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrationBlock, BLOCK_HEADING, INTEGRATION_LINE } from './prompts.js';
import { SPEC_VERSION } from './signals.js';
import { readManifest, writeManifest, MANIFEST_PATH } from './manifest.js';
import { createOwner, ensureDir } from './own.js';
import { git } from './git.js';
import { findRegion, outsideRegion, upsertRegion, renderRegion, eolOf, normalizedHash } from './markers.js';
import { loadComplexMd } from './complexmd.js';
import { wiredBriefs } from './brief.js';
import { TARGETS, TARGET_NAMES, holdsOurHooks, cleanTarget } from './targets.js';
import { registryInvocation } from './invoke.js';

/* minimal: one line near the top of AGENTS.md, and no brief. full: the
   integration block in each agent file, and at most ten briefs per agent. */
export const PROFILES = ['minimal', 'full'];

/* AGENTS.override.md first: Codex reads it in place of AGENTS.md in the
   same folder (developers.openai.com/codex/guides/agents-md), while every
   other agent reads only AGENTS.md, so both get our text. */
const OVERRIDE = 'AGENTS.override.md';
const PRIMARY = [OVERRIDE, 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'];
/* Files whose agents expand an `@AGENTS.md` line into the text of AGENTS.md. */
const IMPORTERS = ['CLAUDE.md', 'GEMINI.md'];

/**
 * How hooks and the MCP entry invoke the CLI. The pinned registry form
 * (invoke.js) when the tool came from the registry; the checkout's own bin when it is being run
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
  return registryInvocation();
}

/* The first text of an AGENTS.md that wire CREATES, inside the marked
   section, never of one that exists already. complex-md owns the map and
   its section; it does not own this repository's conventions and should
   not look as though it does. */
const CREATED_PREAMBLE = `# AGENTS.md

This file was created by complex-md and holds one marked section: how to
read COMPLEX.md, the structural risk map, before editing a file the map
calls hot. It is not a full agent contract. Put this repository's own rules
for agents outside the markers; complex-md changes only the text between
them.
`;

/* The preamble earlier versions wrote, without markers. A created file that
   still holds exactly it and the block is recognised as ours. */
const LEGACY_PREAMBLE = `# AGENTS.md

This file was created by complex-md and carries one section: how to read
COMPLEX.md, the structural risk map, before editing a file the map calls hot.
It is not a full agent contract. Anything else this repository expects of an
agent, and any contract it inherits from a parent repository, belongs above
the section below; complex-md appends to this file rather than rewriting it.

`;

const IMPORTS_AGENTS = /^@(\.\/)?AGENTS\.md\s*$/m;
const IMPORTS_MAP = /^@COMPLEX\.md\s*$/m;

/**
 * Write `content` as the marked region of `rel`, creating the file when
 * `create` is set. `legacy` lists unmarked texts an earlier version wrote;
 * one found verbatim is replaced by the region in place. Returns
 * 'written', 'unchanged', 'absent' or 'broken'.
 */
export function markBlock(root, rel, content, { place = 'end', style = 'html', legacy = [], create = false, created = false, ledger, log = () => {} } = {}) {
  const p = join(root, rel);
  const exists = existsSync(p);
  if (!exists && !create) return 'absent';
  const cur = exists ? readFileSync(p, 'utf8') : '';
  const prev = ledger?.previous?.blocks?.find((b) => b.path === rel);
  const eol = cur.includes('\n') ? eolOf(cur) : '\n';
  let next = null;
  let sep = { before: prev?.before ?? '', after: prev?.after ?? '' };
  if (!findRegion(cur)) {
    for (const old of legacy) {
      const variant = old.replace(/\r?\n/g, eol);
      const i = cur.lastIndexOf(variant);
      if (i < 0) continue;
      const head = cur.slice(0, i);
      next = head + renderRegion(content, { style, spec: SPEC_VERSION, eol }) + cur.slice(i + variant.length);
      sep = { before: head.endsWith(eol + eol) ? eol : '', after: '' };
      break;
    }
  }
  if (next === null) {
    const r = upsertRegion(cur, content, { place, style, spec: SPEC_VERSION });
    if (r.broken) {
      log(`${rel} has a complex-md begin marker without an end marker; left as it is. Fix or delete the marker, then run wire again.`);
      return 'broken';
    }
    next = r.text;
    if (!r.replaced) sep = { before: r.before, after: r.after };
  }
  if (ledger) ledger.blocks.push({ path: rel, sha256: normalizedHash(findRegion(next).text), ...sep, ...(created || prev?.created ? { created: true } : {}), ...(ledger.target ? { target: ledger.target } : {}) });
  if (next === cur) return 'unchanged';
  if (!exists) ensureDir(root, dirname(rel), ledger);
  writeFileSync(p, next);
  return 'written';
}

/* Every generated path gets eol=lf and linguist-generated in a marked
   block of .gitattributes. LF on every checkout keeps a Windows clone with
   core.autocrlf from rewriting them, and GitHub folds them in a diff. The
   leading slash anchors each path at the repository root. */
function markGenerated(root, ledger, mark) {
  const paths = [...new Set(['COMPLEX.md', MANIFEST_PATH, ...ledger.files.map((f) => f.path)])].sort();
  const lines = paths.map((p) => `/${p} eol=lf linguist-generated`);
  mark('.gitattributes', `# Files complex-md generates. Edit COMPLEX.md, not them.\n${lines.join('\n')}\n`, { style: 'hash', create: true, created: !existsSync(join(root, '.gitattributes')) });
}

/* The manifest tells a teammate's unwire what this wire wrote, so it
   belongs in the commit. A .gitignore that hides it gets one line of
   advice; wire does not edit .gitignore. */
function manifestCommittable(root, log) {
  if (!existsSync(join(root, MANIFEST_PATH))) return;
  if (!git(['check-ignore', MANIFEST_PATH], { cwd: root, allowFail: true }).trim()) return;
  log(`${MANIFEST_PATH} is ignored by git. To commit it, ignore .complex-md/* rather than .complex-md/, and add the line !${MANIFEST_PATH} to .gitignore.`);
}

/** `agents`: explicit target names (see targets.js); null detects repo-local targets from existing config. */
/* mcp defaults to FALSE. On the 2026-09-26 benchmark (bench/RESULTS.md) the
   MCP arm was the one clear result and it was negative: 27 server calls over
   24 runs, a third more output tokens (Wilcoxon p 0.036), more steps to the
   right file (sign test p 0.049), and 2.2 times the cost. On a task set where
   the baseline needs two tool calls, a tool that offers more calls is overhead
   by construction and the agent takes the offer. The server stays available
   for anyone who measures it earning its calls on their own repository; it is
   no longer installed on the strength of an assumption. */
/* hooks defaults to FALSE as well. On the fastify benchmark runs the hooks
   arm cost about 50% more per run at the median and took 62% to 100% more
   wall clock (p < 0.01), and passed no more of the real fixes' tests than
   the briefs alone (bench/RESULTS.md). A default wire therefore writes no
   hook into any file. `hooks: true` writes the committed settings, as
   before; `hooks: 'local'` writes Claude Code's per user settings file. */
/* `block` replaces the integration text for this call only: the benchmark
   uses it to try candidate wordings against the same map. The heading is
   kept so a second wire() still recognises the block as present. */
/* `profile`: 'minimal' or 'full'. Naming targets with `agents` asks for
   their files, so it implies 'full' unless a profile is given. */
export function wire(root, { profile = null, hooks = false, mcp = false, rules = true, agents = null, block: blockText = null, log = () => {} } = {}) {
  profile ??= agents ? 'full' : 'minimal';
  if (!PROFILES.includes(profile)) throw new Error(`unknown profile "${profile}"; one of: ${PROFILES.join(', ')}`);
  const full = profile === 'full';
  const map = loadComplexMd(root);
  if (!map) throw new Error('No COMPLEX.md at the repository root; generate it first.');
  for (const name of agents || []) if (!TARGETS[name]) throw new Error(`unknown wiring target "${name}"; one of: ${TARGET_NAMES.join(', ')}`);
  const inv = invocation(root);
  const block = blockText ? (blockText.includes(BLOCK_HEADING) ? blockText.trim() + '\n' : `${BLOCK_HEADING}\n\n${blockText.trim()}\n`) : integrationBlock();
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
  const briefs = wiredBriefs(map);
  const report = { primary: [], created: [], rules: [], removed: [], hooks: [], mcp: [], skipped: [] };

  const active = TARGET_NAMES.filter((name) => (agents ? agents.includes(name) : !TARGETS[name].global && TARGETS[name].detect(root)));

  // 1. Primary files. AGENTS.md comes first in PRIMARY, so once it exists
  // it carries our text by the time the others are read. A CLAUDE.md or
  // GEMINI.md that imports it loads that text through the import; a second
  // copy would load it twice. Each file gets one marked region; text
  // outside it is never changed. The minimal profile writes one line near
  // the top; the full profile writes the block at the end.
  const ledger = { blocks: [], files: [], entries: [], dirs: [], previous: readManifest(root) };
  if (ledger.previous?.invalid) {
    log(`${MANIFEST_PATH} is not readable JSON; wire writes a new one and removes no file it cannot prove it wrote.`);
    ledger.previous = null;
  }
  const own = createOwner({ root, ledger, report, log });
  const mark = (rel, content, opts = {}) => markBlock(root, rel, content, { ledger, log, ...opts });
  const text = full ? block : `${INTEGRATION_LINE}\n`;
  const place = full ? 'end' : 'top';
  let any = false;
  const agentsCarries = existsSync(join(root, 'AGENTS.md'));
  for (const f of PRIMARY) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    if (f !== OVERRIDE) any = true;
    /* Copilot reads AGENTS.md as well; the minimal line goes into its own
       file only when there is no AGENTS.md to carry it. */
    if (!full && f === '.github/copilot-instructions.md' && agentsCarries) continue;
    const cur = readFileSync(p, 'utf8');
    const outside = outsideRegion(cur);
    const hasRegion = !!findRegion(cur);
    const legacy = f === 'CLAUDE.md' ? [`${block}\n@COMPLEX.md\n`, block] : [block];
    const importsAgents = IMPORTERS.includes(f) && agentsCarries && IMPORTS_AGENTS.test(outside);
    /* Our own created AGENTS.md, from this version (only the region) or
       an earlier one (the old preamble and the block). */
    const ours = f === 'AGENTS.md' && ((hasRegion && !outside.trim()) || cur.replace(/\r\n/g, '\n') === LEGACY_PREAMBLE + block);
    if (!hasRegion && outside.includes(BLOCK_HEADING) && !ours && !legacy.some((t) => cur.replace(/\r\n/g, '\n').includes(t))) {
      log(`${f} holds a complex-md section from an earlier version, without markers; left as it is. Delete that section and run wire again to get the marked one.`);
      report.skipped.push(f);
      continue;
    }
    const parts = [];
    if (!importsAgents) parts.push(ours ? CREATED_PREAMBLE + '\n' + text : text);
    if (full && f === 'CLAUDE.md' && !IMPORTS_MAP.test(outside)) parts.push('@COMPLEX.md\n');
    if (!parts.length) {
      report.skipped.push(f);
      continue;
    }
    const content = parts.join('\n');
    const r = ours && !hasRegion
      ? mark(f, content, { legacy: [LEGACY_PREAMBLE + block], created: true })
      : mark(f, content, { legacy, place });
    if (r === 'written') {
      if (!importsAgents) report.primary.push(f);
      if (f === 'CLAUDE.md' && content.includes('@COMPLEX.md')) report.primary.push('CLAUDE.md (@COMPLEX.md import)');
    }
    if (r === 'unchanged' || importsAgents) report.skipped.push(f);
  }
  /* Claude Code reads AGENTS.md when the repository has no CLAUDE.md, and a
     new root CLAUDE.md would stop it loading nested AGENTS.md files. So
     wire never creates CLAUDE.md: when Claude Code has neither file to
     read, it gets an AGENTS.md. */
  const claudeReadsNothing = active.includes('claude') && !existsSync(join(root, 'AGENTS.md')) && !existsSync(join(root, 'CLAUDE.md'));
  if (!any || claudeReadsNothing) {
    /* No primary file existed, so this one is ours to create. It is named
       AGENTS.md, which reads as the whole contract for the repository, and it
       holds one section. Say which, so a reader who arrives at it does not
       take the absence of house rules for their absence in the project, and
       so the next person knows where to put them. Wiring a repository that
       already has a contract adds a marked section to it instead. */
    mark('AGENTS.md', CREATED_PREAMBLE + '\n' + text, { create: true, created: true });
    report.created.push('AGENTS.md');
  }

  // 3-7. Per-target rules, hooks, MCP. `carried` says AGENTS.md now holds
  // the block, so an agent that reads AGENTS.md needs no copy of its own.
  const carried = existsSync(join(root, 'AGENTS.md')) && readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(BLOCK_HEADING);
  for (const name of active) {
    const t = TARGETS[name];
    const tinv = t.global ? { shell: inv.absShell, command: inv.absCommand, args: inv.absArgs } : inv;
    const ctx = { root, inv: tinv, block, paths, briefs, report, log, carried, ledger, mark, own };
    ledger.target = name;
    /* The minimal profile writes no brief; it clears the ones an earlier
       wire wrote, which finish() and cleanTarget() find. */
    if (rules && full && t.rules) t.rules(ctx);
    else if (rules) cleanTarget(ctx, name);
    if (hooks && t.hooks) t.hooks({ ...ctx, local: hooks === 'local' });
    else if (!hooks && t.hookFile && holdsOurHooks(root, t.hookFile)) {
      log(`${t.hookFile} holds complex-md hooks from an earlier wire, left as they are: run wire --hooks to update them, or delete those entries.`);
    }
    if (mcp && t.mcp) t.mcp(ctx);
  }

  ledger.target = null;
  own.finishFiles(new Set(active));
  markGenerated(root, ledger, mark);
  own.finishBlocks(new Set(active));
  writeManifest(root, ledger, { profile });
  manifestCommittable(root, log);

  for (const [k, v] of Object.entries(report)) if (v.length) log(`${k}: ${v.join(', ')}`);
  return report;
}
