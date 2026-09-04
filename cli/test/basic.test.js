import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parseComplexMd, parseFrontMatter } from '../src/complexmd.js';
import { normalizeOutput, frontMatter } from '../src/generate.js';
import { computeSignals } from '../src/signals.js';
import { runCheck } from '../src/check.js';
import { adviseEdit } from '../src/hook.js';

const FM = `complex_md: "0.3"
generated: 2026-09-03
commit: abc1234
tool: by-hand
window_commits: 6
files_analyzed: 3
profile:
  files_total: 4
  confidence: structure+history
  kinds: "source 2, test 1, docs 1"
hotspots:
  - path: src/a.js
    kind: source
    loc: 100
    churn: 5
    churn_w: 4.50
    fixes: 3
    authors: 2
    owner_share: 0.60
    fan_in: 1
    tests: 1
    score: 450
co_change:
  - files: [src/a.js, src/b.js]
    count: 5
    coupling: 62
blind_spots:
  - "one committer identity: authors and owner_share carry no information on this repository"`;

const MAP = `---\n${FM}\n---\n\n## Where the risk lives\n\nRisk is in src/a.js.\n\n## Why these files are hot\n\nsrc/a.js does things. Before editing this file, run npm test.\n\n## Change coupling\n\nsrc/a.js and src/b.js move together. Open both.\n\n## What to read first\n\n1. src/a.js\n`;

test('front matter parses scalars, hotspot maps and inline arrays', () => {
  const fm = parseFrontMatter(FM);
  assert.equal(fm.complex_md, '0.3');
  assert.equal(fm.files_analyzed, 3);
  assert.equal(fm.profile.files_total, 4);
  assert.equal(fm.profile.kinds, 'source 2, test 1, docs 1');
  assert.equal(fm.hotspots[0].path, 'src/a.js');
  assert.equal(fm.hotspots[0].kind, 'source');
  assert.equal(fm.hotspots[0].owner_share, 0.6);
  assert.deepEqual(fm.co_change[0].files, ['src/a.js', 'src/b.js']);
  assert.equal(fm.co_change[0].coupling, 62);
  assert.equal(fm.blind_spots.length, 1);
  assert.match(fm.blind_spots[0], /one committer/);
});

test('COMPLEX.md index finds paragraph, directive and partners by path', () => {
  const m = parseComplexMd(MAP);
  assert.equal(m.row('src/a.js').score, 450);
  assert.match(m.paragraphFor('src/a.js'), /does things/);
  assert.equal(m.directive('src/a.js'), 'Before editing this file, run npm test.');
  assert.deepEqual(m.partnersOf('src/b.js'), [{ partner: 'src/a.js', count: 5 }]);
  assert.equal(m.row('src/zzz.js'), null);
});

test('normalizeOutput strips fences and replaces model front matter with the computed one', () => {
  const fm = '---\ncomplex_md: "0.3"\n---\n';
  const prose = '## Where the risk lives\n\nx\n\n## Why these files are hot\n\ny\n\n## Change coupling\n\nz\n\n## What to read first\n\n1. a';
  const out = normalizeOutput('```markdown\n---\ncomplex_md: "9"\nbogus: 1\n---\n\n' + prose + '\n```', fm);
  assert.equal(out, fm + '\n' + prose + '\n');
});

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'test'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  writeFileSync(join(dir, 'test/a.test.js'), "import { a } from '../src/a.js';\n");
  writeFileSync(join(dir, 'README.md'), '# r\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(dir, 'src/a.js'), `export const a = ${i + 2};\n`);
    writeFileSync(join(dir, 'src/b.js'), `import { a } from './a.js';\nexport const b = a + ${i};\n`);
    g('add', '.');
    g('commit', '-q', '-m', i % 2 ? `fix: a off by one (${i})` : `feat: bump a (${i})`);
  }
  return dir;
}

test('signals on a synthetic repo: churn, fixes, pairs, fan-in, covering tests, scope, profile', () => {
  const dir = makeRepo();
  const s = computeSignals(dir);
  assert.equal(s.spec, '0.3');
  const a = s.table.find((r) => r.path === 'src/a.js');
  assert.ok(a, 'src/a.js ranked');
  assert.equal(a.kind, 'source');
  assert.equal(a.churn, 6);
  assert.equal(a.fixes, 2);
  assert.equal(a.authors, 1);
  assert.equal(a.owner_share, 1);
  assert.equal(a.fan_in, 1, 'src/b.js imports a; the test is a covering test, not fan-in; docs never count');
  assert.equal(a.tests, 1);
  assert.deepEqual(s.tests['src/a.js'], ['test/a.test.js']);
  assert.ok(!s.table.some((r) => r.path === 'README.md'), 'docs are out of scope');
  assert.ok(!s.table.some((r) => r.path === 'test/a.test.js'), 'tests are out of scope');
  assert.equal(s.co_change[0].count, 6);
  assert.deepEqual(s.co_change[0].files, ['src/a.js', 'src/b.js']);
  assert.equal(s.co_change[0].coupling, 100);
  assert.equal(s.profile.confidence, 'structure-only, single author', 'six commits is thin history');
  assert.equal(s.profile.authors_total, 1);
  assert.ok(s.blind_spots.some((b) => /one committer/.test(b)));
  assert.ok(s.blind_spots.some((b) => /commits of usable history/.test(b)));
  assert.equal(s.window_commits, 6);
});

test('file kinds: tests, docs, manifests, generated, vendored, config, style, markup, data, source', async () => {
  const { classify } = await import('../src/graph.js');
  assert.equal(classify('src/app.test.js'), 'test');
  assert.equal(classify('platform-api/test.mjs'), 'test');
  assert.equal(classify('specs/onboarding.md'), 'docs', 'a markdown file in specs/ is documentation, not a spec test');
  assert.equal(classify('spec/user_spec.rb'), 'test');
  assert.equal(classify('package.json'), 'manifest');
  assert.equal(classify('package-lock.json'), 'generated');
  assert.equal(classify('vendor/lib.js'), 'vendored');
  assert.equal(classify('assets/app.min.js'), 'vendored');
  assert.equal(classify('infra/compose.yml'), 'config');
  assert.equal(classify('.github/workflows/ci.yml'), 'ci');
  assert.equal(classify('infra/sites.d/x.caddy'), 'config');
  assert.equal(classify('db/seed/040_x.sql'), 'config');
  assert.equal(classify('site.css'), 'style');
  assert.equal(classify('index.html'), 'markup');
  assert.equal(classify('data/catalog.json'), 'data');
  assert.equal(classify('src/x.ts', '// @generated by protoc'), 'generated');
  assert.equal(classify('src/x.ts'), 'source');
  assert.equal(classify('logo.png'), 'asset');
});

test('dependency graph: ESM, HTML script tags, CSS imports, path literals, root-relative URLs', async () => {
  const { buildGraph } = await import('../src/graph.js');
  const dir = mkdtempSync(join(tmpdir(), 'cx-g-'));
  mkdirSync(join(dir, 'site'));
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'site/index.html'), '<link rel="stylesheet" href="/app.css"><script src="app.js"></script>');
  writeFileSync(join(dir, 'site/app.js'), "import { x } from './lib/x.js';\n");
  mkdirSync(join(dir, 'site/lib'));
  writeFileSync(join(dir, 'site/lib/x.js'), 'export const x = 1;\n');
  writeFileSync(join(dir, 'site/app.css'), '@import "./base.css";\n');
  writeFileSync(join(dir, 'site/base.css'), 'body{}\n');
  writeFileSync(join(dir, 'scripts/run.sh'), '#!/bin/sh\nnode site/app.js\n');
  writeFileSync(join(dir, 'README.md'), 'see site/app.js\n');
  const files = ['site/index.html', 'site/app.js', 'site/lib/x.js', 'site/app.css', 'site/base.css', 'scripts/run.sh', 'README.md'];
  const g = buildGraph(dir, files);
  assert.deepEqual([...g.fanIn.get('site/app.js')].sort(), ['scripts/run.sh', 'site/index.html'], 'script tag and shell path literal count; README does not');
  assert.deepEqual([...g.fanIn.get('site/app.css')], ['site/index.html'], 'root-relative href resolves against the nearest web root');
  assert.deepEqual([...g.fanIn.get('site/lib/x.js')], ['site/app.js']);
  assert.deepEqual([...g.fanIn.get('site/base.css')], ['site/app.css']);
});

test('wire is idempotent for hooks and MCP under both invocations', async () => {
  const { wire } = await import('../src/wire.js');
  const { readFileSync } = await import('node:fs');
  const dir = makeRepo();
  const s = computeSignals(dir);
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(s, 'test') + '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/a.js\n');
  mkdirSync(join(dir, '.cursor'));
  mkdirSync(join(dir, '.claude'));
  // A pre-existing entry in the registry form must be recognized as ours.
  writeFileSync(join(dir, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { preToolUse: [{ command: 'npx -y complex-md hook cursor-pre', matcher: 'Write' }] } }));
  wire(dir, { agents: ['claude', 'cursor'] });
  wire(dir, { agents: ['claude', 'cursor'] });
  const cursor = JSON.parse(readFileSync(join(dir, '.cursor/hooks.json'), 'utf8'));
  const claude = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  assert.equal(cursor.hooks.preToolUse.filter((h) => /hook cursor-pre/.test(h.command)).length, 1);
  assert.equal(cursor.hooks.stop.filter((h) => /hook cursor-stop/.test(h.command)).length, 1);
  assert.equal(claude.hooks.PreToolUse.length, 1);
  assert.equal(claude.hooks.Stop.length, 1);
  assert.equal((readFileSync(join(dir, 'AGENTS.md'), 'utf8').match(/## COMPLEX\.md: the structural risk map/g) || []).length, 1);
});

test('wire creates CLAUDE.md as imports of AGENTS.md and the map, and a second run leaves both alone', async () => {
  const { wire } = await import('../src/wire.js');
  const { readFileSync } = await import('node:fs');
  const dir = makeRepo();
  const s = computeSignals(dir);
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(s, 'test') + '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/a.js\n');
  const first = wire(dir, { agents: ['claude'] });
  assert.deepEqual(first.created, ['AGENTS.md', 'CLAUDE.md']);
  assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n@COMPLEX.md\n');
  const second = wire(dir, { agents: ['claude'] });
  assert.deepEqual(second.primary, [], 'nothing appended on the second run');
  assert.deepEqual(second.skipped.sort(), ['AGENTS.md', 'CLAUDE.md']);
  assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n@COMPLEX.md\n', 'CLAUDE.md is unchanged');
  assert.equal((readFileSync(join(dir, 'AGENTS.md'), 'utf8').match(/## COMPLEX\.md: the structural risk map/g) || []).length, 1);
});

test('windsurf, cline and roo rule targets; unknown target errors; globals never auto-detect', async () => {
  const { wire } = await import('../src/wire.js');
  const { readFileSync, existsSync } = await import('node:fs');
  const dir = makeRepo();
  const s = computeSignals(dir);
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(s, 'test') + '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/a.js\n');
  mkdirSync(join(dir, '.windsurf'));
  mkdirSync(join(dir, '.clinerules'));
  mkdirSync(join(dir, '.roo'));
  const report = wire(dir, {});
  assert.ok(report.rules.includes('.windsurf/rules/complex-md.md'));
  assert.ok(report.rules.includes('.clinerules/complex-md.md'));
  assert.ok(report.rules.includes('.roo/rules/complex-md.md'));
  assert.match(readFileSync(join(dir, '.windsurf/rules/complex-md.md'), 'utf8'), /trigger: glob/);
  assert.ok(!existsSync(join(dir, '.cursor')), 'undetected targets stay untouched');
  assert.ok(!report.mcp.some((m) => /openclaw|hermes/.test(m)), 'global registries are opt-in only');
  assert.throws(() => wire(dir, { agents: ['zed'] }), /unknown wiring target/);
});

test('codex MCP entry uses the computed invocation, not a hardcoded npx', async () => {
  // Copy the CLI into the repo being wired so invocation() picks the local
  // bin; the Codex TOML must carry that same invocation, like the JSON entries.
  const { cpSync, readFileSync } = await import('node:fs');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const { dirname } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'cx-codex-'));
  const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const d of ['src', 'bin', 'prompts']) cpSync(join(cliRoot, d), join(dir, 'cli', d), { recursive: true });
  writeFileSync(join(dir, 'cli/package.json'), readFileSync(join(cliRoot, 'package.json')));
  writeFileSync(join(dir, 'COMPLEX.md'), `---\ncomplex_md: "0.3"\nhotspots:\n  - path: src/a.js\n    kind: source\n    loc: 1\n    churn: 1\n    churn_w: 1.00\n    fixes: 0\n    authors: 1\n    owner_share: 1.00\n    fan_in: 0\n    tests: 0\n    score: 10\nco_change:\nblind_spots:\n---\n\n## Where the risk lives\n\nx\n`);
  mkdirSync(join(dir, '.codex'));
  const { wire } = await import(pathToFileURL(join(dir, 'cli/src/wire.js')));
  wire(dir, { agents: ['claude', 'codex'] });
  const toml = readFileSync(join(dir, '.codex/config.toml'), 'utf8');
  const mcp = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8')).mcpServers['complex-md'];
  assert.equal(mcp.command, 'node', 'local checkout wires its own bin');
  assert.match(toml, /command = "node"/, 'TOML carries the computed command');
  assert.ok(toml.includes(`args = [${mcp.args.map((a) => JSON.stringify(a)).join(', ')}]`), 'TOML args match the JSON entry');
});

test('check and hook advice on the synthetic repo', () => {
  const dir = makeRepo();
  const s = computeSignals(dir);
  writeFileSync(join(dir, 'COMPLEX.md'), frontMatter(s, 'test') + '\n## Where the risk lives\n\nx\n\n## Why these files are hot\n\nsrc/a.js is hot. Before editing this file, run test/a.test.js.\n\n## Change coupling\n\nx\n\n## What to read first\n\n1. src/a.js\n');
  const f = runCheck(dir, { files: ['src/a.js'] });
  assert.equal(f.hotspots.length, 1);
  assert.equal(f.hotspots[0].directive, 'Before editing this file, run test/a.test.js.');
  assert.deepEqual(f.hotspots[0].tests, ['test/a.test.js']);
  assert.equal(f.partners.length, 1);
  assert.equal(f.partners[0].partner, 'src/b.js');

  const state = { acknowledged: [] };
  const first = adviseEdit(dir, 'src/a.js', state, 'gate');
  assert.equal(first.kind, 'deny');
  assert.match(first.text, /Before editing this file, run test\/a\.test\.js/);
  const second = adviseEdit(dir, 'src/a.js', state, 'gate');
  assert.equal(second.kind, 'none');
  const warn = adviseEdit(dir, 'src/b.js', { acknowledged: [] }, 'warn');
  assert.equal(warn.kind, 'context');
  assert.equal(adviseEdit(dir, 'src/a.js', { acknowledged: [] }, 'off').kind, 'none');
});
