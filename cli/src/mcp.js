// MCP server: lets an agent query the map mid-task instead of reading it
// once at launch. The prose comes from COMPLEX.md; the lists (importers,
// covering tests, fresh numbers) are computed live from git on first use.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { repoRoot } from './git.js';
import { loadComplexMd } from './complexmd.js';
import { computeSignals, findImporters, findCoveringTests, detectTestCommand, kindOf, TABLE_HEAD, rowToArray } from './signals.js';
import { git } from './git.js';
import { runCheck, formatCheck } from './check.js';
import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../package.json');

export function buildServer(cwd) {
  const root = repoRoot(cwd) || cwd;
  let signals = null;
  const fresh = () => (signals ||= computeSignals(root));
  const map = () => loadComplexMd(root);
  const text = (s) => ({ content: [{ type: 'text', text: s }] });

  const server = new McpServer({ name: 'complex-md', version: pkg.version });

  server.registerTool(
    'complex_lookup',
    {
      title: 'Look up a file in COMPLEX.md',
      description:
        'Before editing a file: returns its hotspot row (kind, churn, fixes, authors, owner_share, fan_in, tests, score), its paragraph from COMPLEX.md with the "Before editing this file" directive, its co-change partners, and the tests that cover it. Returns a short note when the file is not a hotspot.',
      inputSchema: { path: z.string().describe('Repository-relative path') },
    },
    ({ path }) => {
      const m = map();
      const rel = path.replace(/^\.\//, '');
      if (!m) return text('No COMPLEX.md at the repository root. Run complex_refresh for live signals, or generate the map with `npx complex-md`.');
      const row = m.row(rel);
      const partners = m.partnersOf(rel);
      const out = [];
      if (row) {
        out.push(`${rel}: hotspot${row.kind ? ` (${row.kind})` : ''}. score ${row.score}, loc ${row.loc}, churn ${row.churn} (churn_w ${row.churn_w}), fixes ${row.fixes ?? 'n/a'}, authors ${row.authors}, owner_share ${row.owner_share}, fan_in ${row.fan_in}${typeof row.tests === 'number' ? `, covering tests ${row.tests}` : ''}.`);
        const para = m.paragraphFor(rel);
        if (para) out.push('', para);
      } else {
        out.push(`${rel}: not in the hotspot table (top ${m.hotspots.length} by score as of ${m.front.commit}).`);
      }
      if (partners.length) out.push('', `Co-change partners: ${partners.map((p) => `${p.partner} (${p.count} commits together)`).join(', ')}. Open them and state whether they need a change.`);
      const cover = findCoveringTests(root, rel);
      out.push('', cover.length ? `Covering tests: ${cover.join(', ')}` : 'Covering tests: none references this file (tests that import the package root are not attributed). State how you verified the change.');
      const tc = detectTestCommand(root);
      if (tc) out.push(`Test command: ${tc}`);
      return text(out.join('\n'));
    },
  );

  server.registerTool(
    'complex_where_to_look',
    {
      title: 'Where to look first for a bug',
      description:
        'When a bug report does not name a file: returns the hotspot files ranked by recent change activity (backtested as the best single predictor of where the next fix lands), optionally re-ranked by keywords from the report, plus the "Where the risk lives" summary. Check these before a repository-wide search.',
      inputSchema: { keywords: z.array(z.string()).optional().describe('Words from the bug report (symbols, features, paths)') },
    },
    ({ keywords = [] }) => {
      const m = map();
      const rows = m ? m.hotspots : fresh().hotspots;
      const kw = keywords.map((k) => k.toLowerCase()).filter(Boolean);
      const scored = rows.map((r) => {
        let hits = 0;
        const para = m?.paragraphFor(r.path) || '';
        for (const k of kw) if (r.path.toLowerCase().includes(k) || para.toLowerCase().includes(k)) hits++;
        return { r, hits };
      });
      // bench/backtest.mjs: recency-weighted churn times size matches or
      // beats the risk score and the fixes count at recalling the files the
      // next fix touches, on every repository tried. The score ranks blast
      // radius; this tool ranks likelihood.
      const act = (r) => (r.churn_w ?? r.churn ?? 0) * (r.loc || 1);
      scored.sort((a, b) => b.hits - a.hits || act(b.r) - act(a.r) || (b.r.fixes ?? 0) - (a.r.fixes ?? 0) || b.r.score - a.r.score);
      const out = [];
      if (m?.riskSummary) out.push(m.riskSummary, '');
      out.push('Check in this order:');
      scored.slice(0, 8).forEach(({ r, hits }, i) => {
        out.push(`${i + 1}. ${r.path}  fixes ${r.fixes ?? 'n/a'}, churn ${r.churn}, fan_in ${r.fan_in}${hits ? `, matches ${hits} keyword${hits > 1 ? 's' : ''}` : ''}`);
      });
      if (!m) out.push('', '(Live signals; no COMPLEX.md present, so no paragraphs. Generate one with `npx complex-md`.)');
      return text(out.join('\n'));
    },
  );

  server.registerTool(
    'complex_impact',
    {
      title: 'Blast radius of a file',
      description:
        'Before changing an interface or behavior: lists the files that import the given file, its co-change partners with counts, the tests that cover it, and the test command. Use it to decide what to open and what to run.',
      inputSchema: { path: z.string().describe('Repository-relative path'), limit: z.number().int().min(1).max(200).optional() },
    },
    ({ path, limit = 40 }) => {
      const rel = path.replace(/^\.\//, '');
      const importers = findImporters(root, rel);
      const cover = findCoveringTests(root, rel);
      const m = map();
      const partners = m ? m.partnersOf(rel) : fresh().co_change.filter((c) => c.files.includes(rel)).map((c) => ({ partner: c.files.find((f) => f !== rel), count: c.count }));
      const out = [`${rel}${kindOf(root, rel) ? ` (${kindOf(root, rel)})` : ''}: ${importers.length} dependent files (imports, script tags, path references; tests listed separately).`];
      if (importers.length) out.push(importers.slice(0, limit).map((f) => `- ${f}`).join('\n'));
      if (importers.length > limit) out.push(`... and ${importers.length - limit} more`);
      if (partners.length) out.push('', `Co-change partners: ${partners.map((p) => `${p.partner} (${p.count})`).join(', ')}`);
      out.push('', cover.length ? `Covering tests: ${cover.join(', ')}` : 'Covering tests: none found by name or reference.');
      const tc = detectTestCommand(root);
      if (tc) out.push(`Test command: ${tc}`);
      return text(out.join('\n'));
    },
  );

  server.registerTool(
    'complex_refs',
    {
      title: 'Where a symbol is defined and used',
      description:
        'Before renaming or changing the signature of a function, class, constant or export: returns the files that define the symbol and the files that reference it, with line numbers, ranked so hotspot files come first. Faster and more complete than grepping by hand, and it tells you which of the hits are risky.',
      inputSchema: { symbol: z.string().min(2).describe('Identifier to look up, exact and case-sensitive'), limit: z.number().int().min(1).max(200).optional() },
    },
    ({ symbol, limit = 60 }) => {
      const esc = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const out = git(['grep', '-n', '-w', '-E', esc, '--', '.', ':!*.lock', ':!*.min.js', ':!*.map', ':!node_modules', ':!vendor', ':!dist', ':!build'], { cwd: root, allowFail: true });
      const defRe = new RegExp(`(function\\s+${esc}\\b|class\\s+${esc}\\b|(const|let|var)\\s+${esc}\\b|def\\s+${esc}\\b|fn\\s+${esc}\\b|func\\s+${esc}\\b|type\\s+${esc}\\b|interface\\s+${esc}\\b|export\\s+(default\\s+)?(async\\s+)?(function|class|const|let|var)?\\s*${esc}\\b|${esc}\\s*[:=]\\s*(async\\s*)?\\(|${esc}\\s*\\([^)]*\\)\\s*\\{)`);
      const defs = [];
      const refs = [];
      const m = map();
      const hot = new Set((m?.hotspots || []).map((h) => h.path));
      for (const line of out.split('\n')) {
        const mm = /^([^:]+):(\d+):(.*)$/.exec(line);
        if (!mm) continue;
        const [, file, ln, src] = mm;
        const k = kindOf(root, file);
        if (k === 'docs' || k === 'asset' || k === 'generated' || k === 'vendored') continue;
        (defRe.test(src) ? defs : refs).push({ file, ln: Number(ln), src: src.trim().slice(0, 140), hot: hot.has(file), test: k === 'test' });
      }
      const rank = (a, b) => Number(b.hot) - Number(a.hot) || Number(a.test) - Number(b.test) || a.file.localeCompare(b.file) || a.ln - b.ln;
      defs.sort(rank);
      refs.sort(rank);
      const lines = [`${symbol}: ${defs.length} definition${defs.length === 1 ? '' : 's'}, ${refs.length} reference${refs.length === 1 ? '' : 's'} in ${new Set(refs.map((r) => r.file)).size} files.`];
      if (defs.length) { lines.push('', 'Defined in:'); for (const d of defs.slice(0, 10)) lines.push(`- ${d.file}:${d.ln}${d.hot ? '  [hotspot]' : ''}  ${d.src}`); }
      if (refs.length) {
        lines.push('', 'Referenced in:');
        for (const r of refs.slice(0, limit)) lines.push(`- ${r.file}:${r.ln}${r.hot ? '  [hotspot]' : r.test ? '  [test]' : ''}  ${r.src}`);
        if (refs.length > limit) lines.push(`... and ${refs.length - limit} more`);
      }
      const hotFiles = [...new Set([...defs, ...refs].filter((x) => x.hot).map((x) => x.file))];
      if (hotFiles.length) lines.push('', `Hotspots involved: ${hotFiles.join(', ')}. Run complex_lookup on each before editing.`);
      return text(lines.join('\n'));
    },
  );

  server.registerTool(
    'complex_check',
    {
      title: 'Check the current change against the map',
      description:
        'Before finishing: reports which hotspots the current working-tree change touches (with their directives), which co-change partners were left untouched, and which tests to run. Pass explicit files to check a planned change instead.',
      inputSchema: { files: z.array(z.string()).optional().describe('Files to check; defaults to uncommitted changes'), base: z.string().optional().describe('Git ref to diff against instead of the working tree') },
    },
    ({ files, base }) => {
      const f = runCheck(root, { files: files?.length ? files : null, base: base || null, signals: signals });
      return text(formatCheck(f));
    },
  );

  server.registerTool(
    'complex_refresh',
    {
      title: 'Recompute signals from git now',
      description:
        'Recomputes the spec 0.3 signals live (dependency graph from the working tree, history from the last commits; a second or two on a large repo) and returns the current hotspot table, co-change pairs and blind spots. Use when COMPLEX.md looks stale (compare its `commit` field to HEAD) or when no COMPLEX.md exists.',
      inputSchema: {},
    },
    () => {
      signals = null;
      const s = fresh();
      const lines = [`Live signals at ${s.commit}: ${s.files_analyzed} rankable files, ${s.profile.dependency_edges} dependency edges, ${s.commits_analyzed} of the last ${s.window_commits} commits analyzed (${s.fix_commits} labeled fixes), confidence ${s.profile.confidence}.`, '', TABLE_HEAD.join('\t')];
      for (const r of s.hotspots) lines.push(rowToArray(r).join('\t'));
      if (s.co_change.length) {
        lines.push('', 'co_change:');
        for (const c of s.co_change) lines.push(`- ${c.files[0]} + ${c.files[1]}  (${c.count} shared commits, coupling ${c.coupling}%)`);
      }
      if (s.blind_spots.length) lines.push('', 'blind spots:', ...s.blind_spots.map((b) => `- ${b}`));
      const m = map();
      if (m && m.front.commit && m.front.commit !== s.commit) lines.push('', `COMPLEX.md was generated at ${m.front.commit}; regenerate with \`npx complex-md\` to refresh the prose.`);
      return text(lines.join('\n'));
    },
  );

  return server;
}

export async function serveStdio(cwd) {
  const server = buildServer(cwd);
  await server.connect(new StdioServerTransport());
}
