// Every public text says what the code does and what the finished runs show.
// A sentence that the code or a run contradicts goes on the list below with
// the reason, and this test keeps it from coming back. Runs only inside the
// repository checkout; the published package carries none of these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

test('every listed public text exists', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const missing = [...PUBLIC, ...WIRING].filter((f) => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], 'a public text moved; update the list in this test');
});
