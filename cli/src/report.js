// `complex-md report`: render the repository's COMPLEX.md to a local HTML
// page. It reads the map and the origin remote only, never the history, so
// it runs in any checkout that has a map, with or without commits.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { git } from './git.js';
import { loadComplexMd } from './complexmd.js';
import { renderReport } from './render.js';

export const REPORT_PATH = join('.complex-md', 'report.html');

/** OWNER/REPO from the origin remote, or the folder name when there is none. */
export function repoName(root) {
  const url = git(['remote', 'get-url', 'origin'], { cwd: root, allowFail: true }).trim();
  let path = '';
  if (/^[a-z][\w+.-]*:\/\//i.test(url)) {
    try { path = new URL(url).pathname; } catch { path = ''; }
  } else if (/^[^/\\]+@[^:/\\]+:/.test(url)) {
    path = url.slice(url.indexOf(':') + 1);
  }
  path = path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  return path || basename(root);
}

/**
 * Write the report for the map at root. Returns the absolute path written,
 * or null when root has no COMPLEX.md.
 */
export function writeReport(root, { version } = {}) {
  const map = loadComplexMd(root);
  if (!map) return null;
  const html = renderReport(map, { repo: repoName(root), version });
  const out = join(root, REPORT_PATH);
  mkdirSync(join(root, '.complex-md'), { recursive: true });
  writeFileSync(out, html);
  return out;
}
