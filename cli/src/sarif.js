// SARIF 2.1.0 from an exposure report, for code scanning upload.
//
// 1 run, 1 rule entry per enabled rule, 1 result per finding in the
// tracked tree. A finding that only history holds is counted in the run's
// properties and not listed: its file is not at the analyzed commit, so a
// result could not point at a line there. An allowed finding stays in the
// file with a suppression, so every allow can be audited. No result holds
// a secret value or a line of the file.
import { createHash } from 'node:crypto';

const LEVEL = { critical: 'error', high: 'error', medium: 'warning', low: 'note' };
const SCORE = { critical: '9.5', high: '8.0', medium: '5.0', low: '2.0' };
const PRECISION = { exact: 'very-high', structural: 'high', history: 'high', heuristic: 'low' };

function sarifRule(r) {
  return {
    id: r.id,
    name: r.id,
    shortDescription: { text: r.title },
    fullDescription: { text: `${r.title}. How it is established: ${r.established}. Confidence: ${r.confidence}.` },
    help: { text: r.directive, markdown: r.directive },
    defaultConfiguration: { level: LEVEL[r.severity] },
    properties: {
      tags: ['security', `external/cwe/${r.cwe.toLowerCase()}`, `complex-md/${r.slice}`],
      precision: PRECISION[r.established],
      'security-severity': SCORE[r.severity],
    },
  };
}

/** The SARIF log for `report` (see runExposure in exposure.js). */
export function toSarif(report) {
  const index = new Map(report.rules.map((r, i) => [r.id, i]));
  const byId = new Map(report.rules.map((r) => [r.id, r]));
  const seen = new Map();
  const results = [];
  for (const f of report.findings) {
    if (f.where !== 'tree') continue;
    const r = byId.get(f.rule);
    // The nth time 1 secret appears in 1 file, so 2 copies stay 2 results.
    const k = `${f.fingerprint}\0${f.path}`;
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    const res = {
      ruleId: f.rule,
      ruleIndex: index.get(f.rule),
      level: LEVEL[f.severity],
      kind: f.established === 'heuristic' ? 'review' : 'fail',
      message: { text: `${r.title} (established: ${f.established}, confidence: ${f.confidence})${f.test_path ? ', in a test path' : ''}. ${r.directive}` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.path, uriBaseId: '%SRCROOT%' },
          region: { startLine: f.line, startColumn: f.column, endLine: f.line, endColumn: f.column + f.evidence.length },
        },
      }],
      partialFingerprints: {
        'complexMd/v1': `${f.fingerprint}:${n}`,
        primaryLocationLineHash: `${createHash('sha256').update(`${f.rule}\0${f.path}\0${f.fingerprint}`).digest('hex').slice(0, 16)}:${n}`,
      },
    };
    if (report.config.baseline) res.baselineState = f.status === 'baselined' ? 'unchanged' : 'new';
    if (f.status === 'allowed') res.suppressions = [{ kind: f.allow.kind === 'inline' ? 'inSource' : 'external', status: 'accepted', justification: f.allow.reason }];
    results.push(res);
  }
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'complex-md', semanticVersion: report.generator.replace(/^complex-md\//, ''), informationUri: 'https://complex.md', rules: report.rules.map(sarifRule) } },
      automationDetails: { id: `complex-md/exposure/${(report.commit || '').slice(0, 12)}` },
      columnKind: 'utf16CodeUnits',
      results,
      properties: { historyOnlyFindings: report.findings.filter((f) => f.where === 'history').length, blindSpots: report.blind_spots },
    }],
  };
}
