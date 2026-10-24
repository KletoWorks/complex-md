// The skill has one source: skill/SKILL.tmpl.md plus the two prompts in
// prompts/. renderSkill() fills the template. The site build writes the
// result to dist/complex-md.skill.md and to every SKILL_COPIES path, and a
// test checks that each committed copy still matches.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
