// The site build fills every template placeholder. Runs only inside the
// repository checkout; the published CLI package has no scripts/build.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
