// The wiring manifest, .complex-md/manifest.json. It lists every file wire
// wrote whole and every marked block it put into a file of the user's,
// each with the sha256 of what it wrote, line endings read as LF. unwire
// removes only what the manifest names and only while the hash still
// matches, so a file the user edited is left in place.
//
// The manifest holds no clock and no machine path, so a rewire that
// writes the same files writes the same manifest, and it is small enough
// to commit: a teammate's unwire then knows what the first wire wrote.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { WORK_DIR } from './gitignore.js';
import { SPEC_VERSION } from './signals.js';

export const MANIFEST_PATH = `${WORK_DIR}/manifest.json`;
const pkg = createRequire(import.meta.url)('../package.json');

/** The manifest of an earlier wire, or null. An unreadable one is null, with `invalid` set. */
export function readManifest(root) {
  const p = join(root, MANIFEST_PATH);
  if (!existsSync(p)) return null;
  try {
    const m = JSON.parse(readFileSync(p, 'utf8'));
    return { files: [], blocks: [], entries: [], dirs: [], ...m };
  } catch {
    return { invalid: true, files: [], blocks: [], entries: [], dirs: [] };
  }
}

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** The manifest text for a ledger: sorted, two space indent, LF. */
export function manifestText(ledger, extra = {}) {
  const m = {
    generator: { name: 'complex-md', version: pkg.version },
    spec: SPEC_VERSION,
    ...extra,
    files: [...ledger.files].sort(byPath),
    blocks: [...ledger.blocks].sort(byPath),
  };
  if (ledger.entries?.length) m.entries = [...ledger.entries].sort(byPath);
  if (ledger.dirs?.length) m.dirs = [...new Set(ledger.dirs)].sort();
  return JSON.stringify(m, null, 2) + '\n';
}

/** Write the manifest when its text changed; remove it when the ledger is empty. */
export function writeManifest(root, ledger, extra = {}) {
  const p = join(root, MANIFEST_PATH);
  const empty = !ledger.files.length && !ledger.blocks.length && !ledger.entries?.length;
  if (empty) {
    if (existsSync(p)) rmSync(p);
    return;
  }
  const text = manifestText(ledger, extra);
  if (existsSync(p) && readFileSync(p, 'utf8') === text) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}
