// Every public text says what the code does and what the finished runs show.
// A sentence that the code or a run contradicts goes on the list below with
// the reason, and this test keeps it from coming back. Runs only inside the
// repository checkout; the published package carries none of these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readJson } from '../src/targets.js';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));

const dir = (d, ext) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith(ext)).map((f) => `${d}/${f}`) : []);

/** What a reader sees on GitHub, on npm, on complex.md and in `--help`. */
const PUBLIC = [
  'README.md',
  'cli/README.md',
  'cli/package.json',
  'cli/bin/complex-md.js',
  'content/index.html',
  'content/spec.md',
  'content/skill.md',
  ...dir('content/articles', '.md'),
  'skill/SKILL.tmpl.md',
  'prompts/generate.md',
  'prompts/integration.md',
  'site/404.html',
  'site/site.js',
  'site/logos/agents.json',
  'bench/README.md',
  'bench/RESULTS.md',
];

/** The texts an agent follows to wire a repository. */
const WIRING = ['content/spec.md', 'content/skill.md', 'skill/SKILL.tmpl.md'];

/**
 * Banned sentences. Each entry: the pattern, the files it applies to
 * (PUBLIC unless given), and why the sentence is false. Add a row when a
 * public sentence turns out to contradict the code or a run.
 */
const BANNED = [
  { re: /never leaves? (your|the) machine/i, why: 'with a key, one model call sends the signals and hotspot excerpts' },
  { re: /leaves? (it|the machine|your machine)\b/i, why: 'state what the model call sends, not what stays' },
  { re: /nothing is uploaded/i, why: 'with a key, one model call sends the signals and hotspot excerpts; the skill runs inside an agent that calls its model' },
  { re: /by git and grep/i, why: 'the CLI computes the signals with git and Node.js; it runs no grep' },
  { re: /capped (around|near) 15k/i, why: 'the cap is on the excerpts (about 60,000 characters); the whole request is larger' },
  { re: /safe to remove/i, why: 'there is no unwire command; name the files wire writes instead' },
  { re: /(?<![a-z])grep (skips?|classif(y|ies)|treats?)/i, why: 'GNU grep prints "binary file matches"; ripgrep is the one that stays silent (bench/repro/nul-byte.sh)' },
  { re: /unreadable by grep/i, why: 'name ripgrep, the tool that skips the file in silence' },
  { re: /no warning, exit 0/i, why: 'the exit code differs by ripgrep build; the repro shows no match and no warning' },
  { re: /27(\.4)? ?(percent|%)/i, why: 'a first edit only figure (n 24, p 0.14) that no run to completion repeats' },
  { re: /fewer output tokens/i, why: 'no run to completion shows a token saving' },
  { re: /in progress/i, why: 'the runs finished; report them' },
  { re: /costs nothing per edit/i, why: 'an agent with the map spends more per run (bench/RESULTS.md)' },
  { re: /never leaks into its own/i, why: 'a month\'s map can include a later run task\'s fix' },
  { re: /fewer regressions|breaks? less|reduces? (collateral )?damage/i, why: 'no run shows fewer regressions yet' },
  { re: /gets safer/i, why: 'no run shows fewer regressions yet; state what agents do with the map' },
  { re: /over the last twelve months|halves every year/i, why: 'history is indexed by commit: the last 2,000 commits, half-life a quarter of the window' },
  { re: /score is recency-weighted churn multiplied by lines of code/i, why: 'the 0.3 score also multiplies in fan-in (spec, Hotspot score)' },
  { re: /list form does not load/i, why: 'Claude Code reads paths as a YAML list or a comma separated string' },
  { re: /--no-mcp/, why: 'there is no such flag; the MCP server is off unless --mcp asks for it' },
  { re: /query it mid-task|agents query mid-task/i, why: 'the MCP server is opt in, not the headline' },
  { re: /\bRoo\b|cline,roo/, files: ['README.md', 'cli/README.md', 'cli/bin/complex-md.js', ...WIRING], why: 'Roo reads AGENTS.md; its block-only rule file adds nothing and is not offered' },
  { re: /\.mcp\.json|mcpServers|complex-md mcp|--mcp\b|MCP server/i, files: WIRING, why: 'the spec and the skill do not tell agents to wire the MCP server' },
  { re: /"mcp"/, files: ['cli/package.json'], why: 'the npm keywords do not lead with MCP' },
];

for (const rule of BANNED) {
  test(`no public text says ${rule.re}`, (t) => {
    if (!inCheckout) return t.skip('not a repository checkout');
    const hits = [];
    // Sentences wrap across lines, so match on the text with its
    // whitespace collapsed and report the file and the words around the hit.
    const re = new RegExp(rule.re.source, rule.re.flags.replace('g', '') + 'g');
    for (const f of rule.files || PUBLIC) {
      const p = join(ROOT, f);
      if (!existsSync(p)) continue;
      const flat = readFileSync(p, 'utf8').replace(/\s+/g, ' ');
      for (const m of flat.matchAll(re)) hits.push(`${f}: ...${flat.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50)}...`);
    }
    assert.deepEqual(hits, [], `${rule.why}\n${hits.join('\n')}`);
  });
}

/* A message that names a flag the CLI does not parse sends the reader to a
   dead end. The bin parses --no-hooks, --no-wire and --mcp; there is no
   --no-mcp, because the MCP server is off unless --mcp asks for it. */
test('the invalid JSON message names only flags the CLI parses', () => {
  const d = mkdtempSync(join(tmpdir(), 'cx-json-'));
  const p = join(d, 'settings.json');
  writeFileSync(p, '{ not json');
  assert.throws(() => readJson(p, {}), (e) => {
    assert.doesNotMatch(e.message, /--no-mcp/);
    assert.match(e.message, /--no-hooks/);
    return true;
  });
  const bin = readFileSync(join(import.meta.dirname, '..', 'bin', 'complex-md.js'), 'utf8');
  for (const f of ['--no-hooks', '--mcp']) assert.ok(bin.includes(`flag('${f}')`), `the bin parses ${f}`);
});

test('every listed public text exists', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const missing = [...PUBLIC, ...WIRING].filter((f) => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], 'a public text moved; update the list in this test');
});
