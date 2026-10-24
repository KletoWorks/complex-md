/* A small package, built byte for byte the same each time, for the first
 * run end to end. Pinned dates and identities make the commit SHAs stable.
 *
 *   src/index.js      the package root (package.json main)
 *   src/price.js      reached from the root through src/cart.js; fixed twice
 *   src/cart.js       reached from the root; moves with src/price.js
 *   tools/report.js   not reached from the root; covered by test/report.test.js
 */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EPOCH = Date.UTC(2026, 1, 1, 12, 0, 0);
const DAY = 86400000;
const IDENTS = [
  { GIT_AUTHOR_NAME: 'One', GIT_AUTHOR_EMAIL: 'one@fixture.test', GIT_COMMITTER_NAME: 'One', GIT_COMMITTER_EMAIL: 'one@fixture.test' },
  { GIT_AUTHOR_NAME: 'Two', GIT_AUTHOR_EMAIL: 'two@fixture.test', GIT_COMMITTER_NAME: 'Two', GIT_COMMITTER_EMAIL: 'two@fixture.test' },
];

export function buildFirstRunRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-first-run-'));
  let day = 0;
  const git = (args, who = 0) => {
    const when = new Date(EPOCH + day * DAY).toISOString();
    execFileSync('git', args, { cwd: dir, stdio: 'pipe', env: { ...process.env, ...IDENTS[who], GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  };
  const put = (path, body) => {
    const at = path.lastIndexOf('/');
    if (at > 0) mkdirSync(join(dir, path.slice(0, at)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const commit = (message, who = 0) => {
    day += 1;
    git(['add', '-A'], who);
    git(['commit', '-q', '-m', message], who);
  };

  git(['init', '-q', '-b', 'main']);
  put('package.json', JSON.stringify({ name: 'shop', version: '1.0.0', main: 'src/index.js', type: 'module', scripts: { test: 'node --test' } }, null, 2) + '\n');
  put('src/index.js', "export { total } from './cart.js';\n");
  put('src/cart.js', "import { price } from './price.js';\nexport const total = (items) => items.reduce((a, i) => a + price(i), 0);\n");
  put('src/price.js', 'export const price = (item) => item.cents;\n');
  put('tools/report.js', "export const report = (rows) => rows.join('\\n');\n");
  put('test/cart.test.js', "import { total } from '../src/cart.js';\ntotal([]);\n");
  put('test/report.test.js', "import { report } from '../tools/report.js';\nreport([]);\n");
  put('README.md', '# shop\n');
  commit('feat: first cut');

  for (let i = 0; i < 3; i += 1) {
    put('src/price.js', `export const price = (item) => Math.round(item.cents * ${1 + i / 10});\n`);
    put('src/cart.js', `import { price } from './price.js';\nexport const total = (items) => items.reduce((a, i) => a + price(i), ${i});\n`);
    commit(i === 1 ? 'fix: rounding of a price' : `feat: price rule ${i}`, i % 2);
  }
  put('src/price.js', 'export const price = (item) => Math.round(item.cents);\n');
  commit('fix: price of a free item');
  for (let i = 0; i < 2; i += 1) {
    put('tools/report.js', `export const report = (rows) => rows.join('\\n') + '${i}';\n`);
    commit(i ? 'fix: report trailer' : 'feat: report trailer', 1);
  }
  return dir;
}
