// The skill has one source: skill/SKILL.tmpl.md plus the two prompts in
// prompts/. renderSkill() fills the template. The site build writes the
// result to dist/complex-md.skill.md and to every SKILL_COPIES path, and a
// test checks that each committed copy still matches.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// skills/ at the repository root is the Agent Skills folder that the Gemini
// CLI extension loads. plugins/complex-md/ is the package for Claude Code
// and for clients that read the Agent Plugins format.
export const SKILL_COPIES = ['skills/complex-md/SKILL.md', 'plugins/complex-md/skills/complex-md/SKILL.md'];

export function renderSkill(root = ROOT) {
  const genPrompt = readFileSync(join(root, 'prompts/generate.md'), 'utf8');
  const promptVersion = /prompt_version:\s*([\d.]+)/.exec(genPrompt)?.[1] ?? '0.0.0';
  const specVersion = /spec_version:\s*"([\d.]+)"/.exec(genPrompt)?.[1] ?? '0.1';
  const integrationBlock = readFileSync(join(root, 'prompts/integration.md'), 'utf8').trim();
  return readFileSync(join(root, 'skill/SKILL.tmpl.md'), 'utf8')
    .replaceAll('{{PROMPT_VERSION}}', promptVersion)
    .replaceAll('{{SPEC_VERSION}}', specVersion)
    .replace('{{INTEGRATION_BLOCK}}', integrationBlock)
    .replace('{{GENERATE_PROMPT}}', genPrompt.replace(/^---[\s\S]*?---\n\n/, ''));
}
