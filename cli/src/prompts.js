import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pdir = join(here, '..', 'prompts');

export function generatePrompt() {
  return readFileSync(join(pdir, 'generate.md'), 'utf8');
}

export function integrationBlock() {
  return readFileSync(join(pdir, 'integration.md'), 'utf8').trim() + '\n';
}

export function promptVersion() {
  return /prompt_version:\s*([\d.]+)/.exec(generatePrompt())?.[1] ?? '0.0.0';
}

export const BLOCK_HEADING = '## COMPLEX.md: the structural risk map';
