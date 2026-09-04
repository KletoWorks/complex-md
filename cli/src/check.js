// Diff-time check: which hotspots did this change touch, which co-change
// partners were left alone, which tests cover the touched files. The same
// report drives `complex-md check`, the Stop hooks, pre-commit and CI.
import { changedFiles } from './git.js';
import { loadComplexMd } from './complexmd.js';
import { detectTestCommand, findCoveringTests } from './signals.js';

export function runCheck(cwd, { files = null, base = null, staged = false, signals = null } = {}) {
  const map = loadComplexMd(cwd);
  const changed = files || changedFiles(cwd, { base, staged });
  const changedSet = new Set(changed);
  const findings = { hotspots: [], partners: [], tests: [], changed, map_present: !!map, test_command: detectTestCommand(cwd) };
  if (!map) return findings;
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
  findings.clean = findings.hotspots.length === 0 && findings.partners.length === 0;
  return findings;
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
  if (f.tests.length) out.push(`Run: ${f.tests.join(' ')}${f.test_command ? `  (or ${f.test_command})` : ''}`);
  else if (f.test_command && f.hotspots.length) out.push(`Run: ${f.test_command}`);
  return out.join('\n');
}
