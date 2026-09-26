import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
/* cli/prompts/ is a copy of the repository's prompts/, synced at prepack so
   the published package is self contained. Inside the repository the copy
   is rewritten by the site build, and the test suite runs files in parallel,
   so a test can read the copy in the moment between its removal and its
   rewrite. The source of truth one level up always exists in the repository
   and is byte identical (versions.test.js enforces that), so it is the
   fallback. In the published package only the copy exists, and it is never
   rewritten there. */
const pdir = join(here, '..', 'prompts');
const sourceDir = join(here, '..', '..', 'prompts');

function readPrompt(name) {
  try {
    return readFileSync(join(pdir, name), 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return readFileSync(join(sourceDir, name), 'utf8');
  }
}

export function generatePrompt() {
  return readPrompt('generate.md');
}

export function integrationBlock() {
  return readPrompt('integration.md').trim() + '\n';
}

export function promptVersion() {
  return /prompt_version:\s*([\d.]+)/.exec(generatePrompt())?.[1] ?? '0.0.0';
}

export const BLOCK_HEADING = '## COMPLEX.md: the structural risk map';
