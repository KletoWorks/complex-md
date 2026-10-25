// A git repository with the brief fixture as its map, and a snapshot of
// every file and folder in it, for tests that compare bytes before a wire
// and after an unwire.
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

export const MAP = readFileSync(new URL('./brief-map.md', import.meta.url), 'utf8');

/** files: path to content; null makes a folder. */
export function repo(files = {}, { git = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cx-wire-'));
  execFileSync('git', ['init', '-q', ...git], { cwd: dir });
  writeFileSync(join(dir, 'COMPLEX.md'), MAP);
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    if (content === null) mkdirSync(join(dir, p), { recursive: true });
    else writeFileSync(join(dir, p), content);
  }
  return dir;
}

/** Every file and folder under dir except .git, as path to base64 bytes (folders end in / and map to null). */
export function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      if (d === dir && name === '.git') continue;
      const p = join(d, name);
      const rel = relative(dir, p).split('\\').join('/');
      if (statSync(p).isDirectory()) {
        out.set(`${rel}/`, null);
        walk(p);
      } else out.set(rel, readFileSync(p).toString('base64'));
    }
  };
  walk(dir);
  return out;
}
