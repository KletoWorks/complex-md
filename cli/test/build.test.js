// The site build fills every template placeholder. Runs only inside the
// repository checkout; the published CLI package has no scripts/build.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { registryInvocation, hookCommand } from '../src/invoke.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('npm run build leaves no {{ placeholder in the skill, the spec or the integration block', (t) => {
  if (!existsSync(join(ROOT, 'scripts/build.mjs'))) return t.skip('not a repository checkout');
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { stdio: 'pipe' });
  for (const f of ['complex-md.skill.md', 'spec.md', 'spec/index.html', 'integration.md']) {
    const text = readFileSync(join(ROOT, 'dist', f), 'utf8');
    assert.ok(!text.includes('{{'), `${f} still has a placeholder`);
  }
  const skill = readFileSync(join(ROOT, 'dist/complex-md.skill.md'), 'utf8');
  assert.match(skill, /^# complex-md skill \(spec \d+\.\d+, prompt \d+\.\d+\.\d+\)$/m);
  assert.match(skill, /## COMPLEX\.md: the structural risk map/);
  assert.match(skill, /`load_bearing`/, 'the injected block is the 0.3 one');
});

/* The footer and the JSON-LD name the CLI version. A version typed into a
   template goes stale at the next release; read from cli/package.json at
   build time, it cannot. */
test('the built pages carry the CLI version from cli/package.json', (t) => {
  if (!existsSync(join(ROOT, 'scripts/build.mjs'))) return t.skip('not a repository checkout');
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { stdio: 'pipe' });
  const { version } = JSON.parse(readFileSync(join(ROOT, 'cli/package.json'), 'utf8'));
  for (const f of ['index.html', 'spec/index.html', 'skill/index.html']) {
    const html = readFileSync(join(ROOT, 'dist', f), 'utf8');
    assert.ok(html.includes(`cli ${version}</small>`), `${f} footer names cli ${version}`);
  }
  const home = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  assert.ok(home.includes(`"softwareVersion":"${version}"`), 'the JSON-LD names the same version');
});

/* The skill shows hook entries for an agent to write by hand. They must be
   the commands wire writes: pinned to this CLI version and local install
   first. An unpinned npx ran whatever was published last and, with the
   registry unreachable, waited out the hook timeout. */
test('the skill\'s hand written hooks are the commands wire writes', (t) => {
  if (!existsSync(join(ROOT, 'scripts/build.mjs'))) return t.skip('not a repository checkout');
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { stdio: 'pipe' });
  const skill = readFileSync(join(ROOT, 'dist/complex-md.skill.md'), 'utf8');
  const inv = registryInvocation();
  for (const sub of ['hook pre', 'hook stop', 'hook cursor-pre', 'hook cursor-stop']) {
    assert.ok(skill.includes(JSON.stringify(hookCommand(inv, sub))), `the skill writes the pinned ${sub} command`);
  }
  assert.doesNotMatch(skill, /"npx -y complex-md hook/, 'no unpinned hook command is left');
});

/* node --test runs the test files at once, and 9 of them run this build.
   Each build also writes copies inside the repository: the 2 skill copies,
   their references/generate.md and the 2 prompts in cli/prompts/. When 2
   builds replaced the same copy at once, 1 failed with EEXIST, or with an
   empty error on Node 22. A build must leave a current copy alone. */
test('a build leaves the current copies in the repository untouched', (t) => {
  if (!existsSync(join(ROOT, 'scripts/build.mjs'))) return t.skip('not a repository checkout');
  const copies = [
    'skills/complex-md/SKILL.md', 'skills/complex-md/references/generate.md',
    'plugins/complex-md/skills/complex-md/SKILL.md', 'plugins/complex-md/skills/complex-md/references/generate.md',
    'cli/prompts/generate.md', 'cli/prompts/integration.md',
  ];
  const build = () => execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--out', mkdtempSync(join(tmpdir(), 'cx-build-'))], { stdio: 'pipe' });
  build();
  const before = copies.map((p) => statSync(join(ROOT, p), { bigint: true }));
  build();
  copies.forEach((p, i) => {
    const after = statSync(join(ROOT, p), { bigint: true });
    assert.equal(after.ino, before[i].ino, `${p} was replaced`);
    assert.equal(after.mtimeNs, before[i].mtimeNs, `${p} was rewritten`);
  });
});
