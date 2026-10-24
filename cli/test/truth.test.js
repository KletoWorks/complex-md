// Every public text says what the code does and what the finished runs show.
// A sentence that the code or a run contradicts goes on the list below with
// the reason, and this test keeps it from coming back. Runs only inside the
// repository checkout; the published package carries none of these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readJson, BRIEF_SPECS } from '../src/targets.js';

const ROOT = join(import.meta.dirname, '..', '..');
const inCheckout = existsSync(join(ROOT, 'scripts/build.mjs'));

const dir = (d, ext) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith(ext)).map((f) => `${d}/${f}`) : []);

/** What a reader sees on GitHub, on npm, on complex.md and in `--help`. */
const PUBLIC = [
  'README.md',
  'cli/README.md',
  'cli/package.json',
  'cli/bin/complex-md.js',
  // The report page's headings, legend and notes are written here.
  'cli/src/render.js',
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
  'bench/skillopt/README.md',
  'bench/SELECTORS.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'SECURITY.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  ...dir('.github/ISSUE_TEMPLATE', '.yml'),
  ...dir('.github/unlisted', '.yml'),
  'docs/RESEARCH-signals-and-wiring.md',
  // The build writes llms.txt, the JSON-LD and the footer from this file.
  'scripts/build.mjs',
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
  { re: /27(\.4)? ?(percent|%) fewer|-27\.4%/i, why: 'a first edit only figure (n 24, p 0.14) that no run to completion repeats' },
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
  { re: /--no-hooks/, why: 'there is no such flag; the hooks are off unless --hooks asks for them' },
  { re: /get rules and hooks|Install the hooks \(next section\) where|complex-md wire`: it performs steps 1 to 5 idempotently and adds the hooks|rules per hot path, hooks\)|adds an? <code>@COMPLEX\.md<\/code> line to a <code>REVIEW\.md<\/code> that exists, and <code>complex-md hook<\/code>|brief, and the PreToolUse and Stop hooks/, why: 'hooks are opt in: a default wire writes none, and wire --hooks adds them' },
  { re: /without (any|a) key,? it writes `?\.complex-md\/prompt\.md`? for the agent/i, why: 'a run with no key writes COMPLEX.md with template prose and wires it; the bundle comes as well' },
  { re: /`\.complex-md\/` (goes|is added) in ?to `?\.gitignore/i, why: 'the entry is .complex-md/* with !.complex-md/bounds.json, so bounds.json stays committable' },
  { re: /--arms [\w,]*\bmcp\b/, why: 'the mcp arm is retired; run.mjs refuses it' },
  { re: /settings\.json` runs this checkout/, files: ['AGENTS.md'], why: 'the repository commits no hooks; the CLI writes them only with --hooks' },
  { re: /query it mid-task|agents query mid-task/i, why: 'the MCP server is opt in, not the headline' },
  { re: /\bRoo\b|cline,roo/, files: ['README.md', 'cli/README.md', 'cli/bin/complex-md.js', ...WIRING], why: 'Roo reads AGENTS.md; its block-only rule file adds nothing and is not offered' },
  { re: /\.roo\/rules|\.claude\/rules\/complex-md\.md/, files: ['README.md', 'cli/README.md', 'cli/bin/complex-md.js', 'content/index.html', ...WIRING], why: 'wire writes neither file now, and a rewire removes the copies earlier versions wrote' },
  { re: /\.mcp\.json|mcpServers|complex-md mcp|--mcp\b|MCP server/i, files: WIRING, why: 'the spec and the skill do not tell agents to wire the MCP server' },
  { re: /"mcp"/, files: ['cli/package.json'], why: 'the npm keywords do not lead with MCP' },
  { re: /names a directory is not counted/i, why: 'the scorer counts a test directory the map names, as in the fastify-damage edits to lib/reply.js' },
  { re: /about (a|one|two) seconds?|in a second\b|in seconds\b/i, why: 'no speed figure is measured across repositories; the pages do not pitch speed' },
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
   dead end. The bin parses --hooks, --local, --no-wire and --mcp; there is
   no --no-mcp or --no-hooks, because the MCP server and the hooks are off
   unless --mcp or --hooks asks for them. */
test('the invalid JSON message names only flags the CLI parses', () => {
  const d = mkdtempSync(join(tmpdir(), 'cx-json-'));
  const p = join(d, 'settings.json');
  writeFileSync(p, '{ not json');
  assert.throws(() => readJson(p, {}), (e) => {
    assert.doesNotMatch(e.message, /--no-mcp|--no-hooks/);
    assert.match(e.message, /--hooks/);
    return true;
  });
  const bin = readFileSync(join(import.meta.dirname, '..', 'bin', 'complex-md.js'), 'utf8');
  for (const f of ['--hooks', '--local', '--no-wire', '--mcp']) assert.ok(bin.includes(`flag('${f}')`), `the bin parses ${f}`);
});

/* The root README features `impact`; a reader who runs --help to find it
   must see it there too, with the flags the bin parses for it. */
test('--help and the CLI README name every command the bin runs', () => {
  const bin = readFileSync(join(import.meta.dirname, '..', 'bin', 'complex-md.js'), 'utf8');
  const help = /const HELP = `([\s\S]*?)`;/.exec(bin)[1];
  const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
  const commands = [...bin.matchAll(/cmd === '([a-z]+)'/g)].map((m) => m[1]).filter((c) => !['help', 'mcp'].includes(c));
  assert.ok(commands.includes('impact'));
  for (const c of commands) {
    assert.match(help, new RegExp(`npx complex-md ${c}\\b`), `--help names ${c}`);
    if (c !== 'hook') assert.match(readme, new RegExp(`complex-md ${c}\\b`), `the CLI README names ${c}`);
  }
  assert.match(help, /impact <path>[\s\S]*--strict/);
});

/* A flag a reader cannot find does not exist for them. Every flag the bin
   reads for generate and wire is named in --help and in the CLI README. */
test('--help and the CLI README name every flag the bin parses', () => {
  const bin = readFileSync(join(import.meta.dirname, '..', 'bin', 'complex-md.js'), 'utf8');
  const help = /const HELP = `([\s\S]*?)`;/.exec(bin)[1];
  const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
  const flags = [...new Set([...bin.matchAll(/(?:flag|opt)\('(--[a-z-]+)'\)/g)].map((m) => m[1]))].filter((f) => f !== '--root');
  for (const f of ['--via', '--via-timeout', '--template', '--yes']) assert.ok(flags.includes(f), `the bin parses ${f}`);
  for (const f of flags) {
    assert.ok(help.includes(f), `--help names ${f}`);
    assert.ok(readme.includes(f), `the CLI README names ${f}`);
  }
});

/* Every folder wire writes per file briefs to is named where a reader
   looks for what wire writes: the spec's Stage 3, the CLI README and the
   home page's list of files to delete. A new channel that is missing from
   one of them fails here. */
test('the spec, the CLI README and the home page name every brief folder', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const f of ['content/spec.md', 'cli/README.md', 'content/index.html']) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    for (const [name, spec] of Object.entries(BRIEF_SPECS)) {
      assert.ok(text.includes(spec.dir), `${f} names ${spec.dir} (${name})`);
    }
  }
});

/* The marquee shows every agent that can read the map, and most of them read
   it through AGENTS.md rather than a file of their own. The caption says
   which is which. MCP is a protocol, not an agent, and Aider reads neither
   AGENTS.md nor COMPLEX.md unless its own config names the file. */
test('the agent marquee is captioned and lists only agents that read the map', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const home = readFileSync(join(ROOT, 'content/index.html'), 'utf8').replace(/\s+/g, ' ');
  const section = /id="compatibility">([\s\S]*?)\{\{AGENT_MARQUEE\}\}/.exec(home)?.[1] || '';
  assert.match(section, /Claude Code and Cursor get rules, and hooks on request/);
  assert.match(section, /through AGENTS\.md/);
  const agents = JSON.parse(readFileSync(join(ROOT, 'site/logos/agents.json'), 'utf8'));
  const slugs = agents.map((a) => a.slug);
  for (const s of ['modelcontextprotocol', 'aider']) assert.ok(!slugs.includes(s), `${s} is not in the marquee`);
  for (const s of slugs) assert.ok(existsSync(join(ROOT, 'site/logos', `${s}.svg`)), `${s}.svg exists`);
});

/* "More examples" must lead to more than one example. */
test('a link to the examples folder leads to more than one example', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const home = readFileSync(join(ROOT, 'content/index.html'), 'utf8');
  const examples = readdirSync(join(ROOT, 'examples')).filter((f) => f.endsWith('.md'));
  if (/tree\/main\/examples/.test(home)) assert.ok(examples.length > 1, `examples/ holds ${examples.length} file`);
});

test('every listed public text exists', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const missing = [...PUBLIC, ...WIRING].filter((f) => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], 'a public text moved; update the list in this test');
});
