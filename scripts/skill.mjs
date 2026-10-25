// The skill has one source: skill/SKILL.tmpl.md plus the two prompts in
// prompts/. renderSkill() fills the template. The site build writes the
// whole skill to dist/complex-md.skill.md, and the split skill plus
// references/generate.md to every SKILL_COPIES folder. A test checks that
// each committed copy still matches.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryInvocation, hookCommand } from '../cli/src/invoke.js';
import { readText } from './text.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// skills/ at the repository root is the Agent Skills folder that the Gemini
// CLI extension loads. plugins/complex-md/ is the package for Claude Code
// and for clients that read the Agent Plugins format.
export const SKILL_COPIES = ['skills/complex-md/SKILL.md', 'plugins/complex-md/skills/complex-md/SKILL.md'];

// Each package manifest carries the CLI version, so a user's installed
// package moves only on a release. The build stamps it from cli/package.json.
export const PACKAGE_MANIFESTS = ['plugins/complex-md/.claude-plugin/plugin.json', 'plugins/complex-md/plugin.json', 'gemini-extension.json'];

export function stampVersions(root = ROOT) {
  const version = JSON.parse(readFileSync(join(root, 'cli/package.json'), 'utf8')).version;
  for (const p of PACKAGE_MANIFESTS) {
    const m = JSON.parse(readFileSync(join(root, p), 'utf8'));
    if (m.version === version) continue;
    m.version = version;
    writeFileSync(join(root, p), JSON.stringify(m, null, 2) + '\n');
  }
  return version;
}

// The generation prompt without its own front matter.
export function renderReference(root = ROOT) {
  return readText(join(root, 'prompts/generate.md')).replace(/^---[\s\S]*?---\n\n/, '');
}

/* With `split`, the generation prompt stays out of the body and the skill
   points at references/generate.md, which the build writes beside each
   package copy. That keeps the body under the 5,000 tokens the Agent Skills
   specification recommends. Without it, the result is the one file that
   the site offers as a download. */
export function renderSkill(root = ROOT, { split = false } = {}) {
  const genPrompt = readText(join(root, 'prompts/generate.md'));
  const promptVersion = /prompt_version:\s*([\d.]+)/.exec(genPrompt)?.[1] ?? '0.0.0';
  const specVersion = /spec_version:\s*"([\d.]+)"/.exec(genPrompt)?.[1] ?? '0.1';
  const integrationBlock = readText(join(root, 'prompts/integration.md')).trim();
  return readText(join(root, 'skill/SKILL.tmpl.md'))
    .replaceAll('{{PROMPT_VERSION}}', promptVersion)
    .replaceAll('{{SPEC_VERSION}}', specVersion)
    .replace('{{INTEGRATION_BLOCK}}', integrationBlock)
    // Hook entries an agent writes by hand: the exact command wire writes,
    // pinned to this CLI version, so the two never drift apart.
    .replace(/\{\{HOOK:([a-z -]+)\}\}/g, (_, sub) => hookCommand(registryInvocation(), sub))
    .replaceAll('{{PROMPT_REF}}', split ? 'the generation prompt in `references/generate.md`' : 'the generation prompt at the end of this document')
    .replace(/\n---\n\n\{\{GENERATE_PROMPT\}\}\n?$/, split ? '\n' : (m) => m)
    .replace('{{GENERATE_PROMPT}}', renderReference(root));
}
