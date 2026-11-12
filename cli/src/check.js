// Diff-time check: which hotspots did this change touch, which co-change
// partners were left alone, which tests cover the touched files. The same
// report drives `complex-md check`, the Stop hooks, pre-commit and CI.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { changedFiles } from './git.js';
import { loadComplexMd } from './complexmd.js';
import { detectTestCommand, findCoveringTests } from './signals.js';
import { wiredBriefs } from './brief.js';
import { integrationBlock } from './prompts.js';
import { BRIEF_SPECS, briefFiles, specOwns, SKILL_PATH, portableSkill } from './targets.js';
import { readManifest } from './manifest.js';

/* map: a parsed map to check against, or null for none. Left out, the
   working tree's COMPLEX.md is read. */
export function runCheck(cwd, { files = null, base = null, staged = false, signals = null, map: given } = {}) {
  const map = given !== undefined ? given : loadComplexMd(cwd);
  const changed = files || changedFiles(cwd, { base, staged });
  const changedSet = new Set(changed);
  const findings = { hotspots: [], partners: [], tests: [], generated: [], changed, map_present: !!map, test_command: detectTestCommand(cwd) };
  if (!map) return findings;
  findings.generated = generatedDrift(cwd, map, changed);
  const coveringTests = (f) => signals?.tests?.[f] ?? findCoveringTests(cwd, f);

  for (const f of changed) {
    const row = map.row(f);
    if (row) {
      findings.hotspots.push({ path: f, row, directive: map.directive(f), tests: coveringTests(f) });
    }
    for (const { partner, count } of map.partnersOf(f)) {
      if (!changedSet.has(partner)) {
        findings.partners.push({ changed: f, partner, count, coupling: map.couplingFor(f)[0] || null });
      }
    }
  }
  findings.partners.sort((a, b) => b.count - a.count);
  const seenTests = new Set();
  for (const h of findings.hotspots) for (const t of h.tests) if (!seenTests.has(t)) { seenTests.add(t); findings.tests.push(t); }
  findings.clean = findings.hotspots.length === 0 && findings.partners.length === 0 && findings.generated.length === 0;
  return findings;
}

/* Generated files in this change that differ from what `wire` writes for
   the map as it stands. Copilot code review reads its instructions from
   the pull request's head branch, so a pull request that edits a brief
   changes what the bot is told about the files it changes. A file counts
   as generated when it sits where a target writes its briefs, with that
   target's prefix and extension, or is the portable skill. Line endings
   are ignored, so a checkout that converts them is not an edit. */
export function generatedDrift(cwd, map, changed) {
  const out = [];
  let expectedBriefs = null;
  for (const rel of changed) {
    let expected;
    if (rel === SKILL_PATH) {
      expected = portableSkill(integrationBlock());
    } else {
      const spec = Object.values(BRIEF_SPECS).find((s) => specOwns(s, rel));
      if (!spec) continue;
      if (!expectedBriefs) {
        const manifest = readManifest(cwd);
        if (manifest?.profile === 'minimal') expectedBriefs = new Map();
        else {
          const targets = manifest?.profile === 'full'
            ? new Set(manifest.files.map((file) => file.target).filter(Boolean))
            : null;
          expectedBriefs = new Map();
          const briefs = wiredBriefs(map);
          for (const [name, target] of Object.entries(BRIEF_SPECS)) {
            if (targets && !targets.has(name)) continue;
            for (const [path, content] of briefFiles(target, briefs)) expectedBriefs.set(path, content);
          }
        }
      }
      expected = expectedBriefs.get(rel);
    }
    const p = join(cwd, rel);
    const actual = existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
    if (actual === null) {
      if (expected !== undefined) out.push({ path: rel, reason: 'deleted' });
    } else if (expected === undefined) {
      out.push({ path: rel, reason: 'not written by wire' });
    } else if (actual !== expected) {
      out.push({ path: rel, reason: 'edited' });
    }
  }
  return out;
}

// Over-flagging is how bug prediction lost developers at Google; show the
// strongest partners per changed file and point at the map for the rest.
export const PARTNERS_SHOWN = 3;

export function formatCheck(f, { heading = true } = {}) {
  const out = [];
  if (!f.map_present) return 'No COMPLEX.md at the repository root. Generate one: npx complex-md';
  if (f.clean) return heading ? 'COMPLEX.md check: no hotspot or co-change partner in this change.' : '';
  if (heading) out.push('COMPLEX.md check');
  if (f.hotspots.length) {
    out.push(`Hotspots touched (${f.hotspots.length}):`);
    for (const h of f.hotspots) {
      const r = h.row;
      out.push(`- ${h.path}  (score ${r.score}, churn ${r.churn}, fixes ${r.fixes ?? '?'}, fan_in ${r.fan_in})`);
      if (h.directive) out.push(`  ${h.directive}`);
      if (h.tests.length) out.push(`  covering tests: ${h.tests.join(', ')}`);
      else out.push('  no test references this file: say how you verified this change.');
    }
  }
  if (f.partners.length) {
    out.push(`Co-change partners not touched (${f.partners.length}):`);
    const byFile = new Map();
    for (const p of f.partners) (byFile.get(p.changed) || byFile.set(p.changed, []).get(p.changed)).push(p);
    for (const [changed, list] of byFile) {
      const shown = list.slice(0, PARTNERS_SHOWN);
      out.push(`- ${changed} changed; unchanged partners: ${shown.map((p) => `${p.partner} (${p.count} commits together)`).join(', ')}${list.length > shown.length ? `, and ${list.length - shown.length} more in COMPLEX.md` : ''}. State whether each needs a change.`);
    }
  }
  if (f.generated?.length) {
    out.push(`Generated files that differ from what wire writes (${f.generated.length}):`);
    for (const g of f.generated) out.push(`- ${g.path} (${g.reason})`);
    out.push('  Review bots read these files from the pull request. Revert the change, or edit COMPLEX.md and run: npx complex-md wire');
  }
  if (f.tests.length) out.push(`Run: ${f.tests.join(' ')}${f.test_command ? `  (or ${f.test_command})` : ''}`);
  else if (f.test_command && f.hotspots.length) out.push(`Run: ${f.test_command}`);
  return out.join('\n');
}
