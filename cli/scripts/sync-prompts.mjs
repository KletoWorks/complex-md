// Copy the versioned prompts from the site repo into the package so the
// published CLI carries the exact prompt the skill and the spec publish.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'prompts');
const dst = join(here, '..', 'prompts');
if (!existsSync(src)) {
  console.log('sync-prompts: no ../prompts (installed package); keeping bundled prompts');
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
for (const f of ['generate.md', 'integration.md']) copyFileSync(join(src, f), join(dst, f));
console.log('sync-prompts: copied generate.md, integration.md');
