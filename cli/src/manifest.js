// The wiring manifest, .complex-md/manifest.json. It lists every file wire
// wrote whole and every marked block it put into a file of the user's,
// each with the sha256 of what it wrote, line endings read as LF. unwire
// removes only what the manifest names and only while the hash still
// matches, so a file the user edited is left in place.
//
// The manifest holds no clock and no machine path, so a rewire that
// writes the same files writes the same manifest, and it is small enough
// to commit: a teammate's unwire then knows what the first wire wrote.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { WORK_DIR } from './gitignore.js';
import { SPEC_VERSION } from './signals.js';

export const MANIFEST_PATH = `${WORK_DIR}/manifest.json`;
const pkg = createRequire(import.meta.url)('../package.json');

function resolvedPathOrParent(root, rel) {
  for (let path = join(root, rel); ; path = dirname(path)) {
    try {
      return realpathSync(path);
    } catch {
      try {
        lstatSync(path);
        return null;
      } catch {}
      const parent = dirname(path);
      if (parent === path) return null;
    }
  }
}

/** Refuse a manifest directory or file whose resolved path is unsafe. */
export function assertManifestPath(root) {
  let base;
  try {
    base = realpathSync(root);
  } catch {
    throw new Error(`${MANIFEST_PATH} cannot be resolved inside the repository; refusing to read, write or remove it.`);
  }
  let gitDir = null;
  try {
    gitDir = realpathSync(join(base, '.git'));
  } catch {}
  for (const rel of [WORK_DIR, MANIFEST_PATH]) {
    const resolved = resolvedPathOrParent(root, rel);
    if (!resolved || (resolved !== base && !resolved.startsWith(base + sep))) {
      throw new Error(`${MANIFEST_PATH} resolves outside the repository; refusing to read, write or remove it.`);
    }
    if (gitDir && (resolved === gitDir || resolved.startsWith(gitDir + sep))) {
      throw new Error(`${MANIFEST_PATH} resolves into .git; refusing to read, write or remove it.`);
    }
  }
}

/* The manifest is committed, so a cloned repository can carry one that
   someone else wrote. A listed path counts only when it is a plain
   relative path inside the repository: no absolute path, no `.` or `..`
   segment, no backslash, and nothing under .git. */
export function safeRelPath(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes('\\')) return false;
  if (rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return false;
  const parts = rel.split('/');
  if (parts.some((s) => s === '' || s === '.' || s === '..')) return false;
  return parts[0].toLowerCase() !== '.git';
}

/**
 * The manifest of an earlier wire, or null. An unreadable one is null, with
 * `invalid` set. Entries whose path fails safeRelPath are dropped and
 * listed in `rejected`.
 */
export function readManifest(root) {
  assertManifestPath(root);
  const p = join(root, MANIFEST_PATH);
  if (!existsSync(p)) return null;
  let m;
  try {
    m = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { invalid: true, files: [], blocks: [], entries: [], dirs: [], rejected: [] };
  }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { invalid: true, files: [], blocks: [], entries: [], dirs: [], rejected: [] };
  const rejected = [];
  const keep = (list, pathOf) =>
    (Array.isArray(list) ? list : []).filter((e) => {
      const ok = e && safeRelPath(pathOf(e));
      if (!ok) rejected.push(String(pathOf(e ?? {})));
      return ok;
    });
  return {
    ...m,
    files: keep(m.files, (e) => e.path),
    blocks: keep(m.blocks, (e) => e.path),
    entries: keep(m.entries, (e) => e.path),
    dirs: keep(m.dirs, (d) => d),
    rejected,
  };
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
  assertManifestPath(root);
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
