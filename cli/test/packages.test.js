// The skill ships to several agent tools from one template. These tests check
// each package against the format its tool documents, offline. They run only
// inside the repository checkout; the published CLI package has none of these
// files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inCheckout = existsSync(join(ROOT, 'skill/SKILL.tmpl.md'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Minimal YAML front matter reader: flat `key: value` lines, which is all the
// skill uses. Quotes around a value are removed.
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

// Agent Skills specification (agentskills.io/specification): name is 1 to 64
// lowercase letters, digits and single hyphens and matches its directory;
// description is 1 to 1024 characters.
const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const SKILL_COPIES = ['skills/complex-md/SKILL.md', 'plugins/complex-md/skills/complex-md/SKILL.md'];

test('every shipped SKILL.md is the rendered template, byte for byte', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { renderSkill } = await import(join(ROOT, 'scripts/skill.mjs'));
  const rendered = renderSkill();
  assert.ok(!rendered.includes('{{'), 'the rendered skill still has a placeholder');
  for (const p of SKILL_COPIES) {
    assert.ok(existsSync(join(ROOT, p)), `${p} is missing; run npm run build`);
    assert.equal(read(p), rendered, `${p} is out of step with skill/SKILL.tmpl.md; run npm run build`);
  }
});

test('every shipped SKILL.md meets the Agent Skills specification', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const p of SKILL_COPIES) {
    const fm = frontMatter(read(p));
    assert.ok(fm, `${p} has no front matter`);
    assert.match(fm.name, SKILL_NAME, `${p} name`);
    assert.equal(fm.name, p.split('/').at(-2), `${p} name must match its directory`);
    assert.ok(fm.description.length >= 1 && fm.description.length <= 1024, `${p} description is ${fm.description.length} characters`);
  }
});
