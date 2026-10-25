// Ownership: which files and blocks in a repository complex-md wrote. wire
// and unwire both decide from here, so a file is never removed or
// overwritten on one rule and kept on another.
//
// A file is complex-md's when the manifest of an earlier wire lists it, or,
// for a repository wired before the manifest existed, when it carries the
// generated notice, the integration block's heading or the shape of an
// earlier brief. A file the manifest lists whose text no longer matches
// the recorded hash was edited by someone: it is reported and left.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { BLOCK_HEADING } from './prompts.js';
import { GENERATED_NOTICE, ENTRY_KINDS, jsonText, getPath } from './targets.js';
import { findRegion, removeRegion, outsideRegion, normalizedHash } from './markers.js';

/* The opening of a brief written before briefs carried the notice:
   front matter, the path as a heading, then one of three lead lines. */
const LEGACY_BRIEF = /^---\r?\n[\s\S]*?\r?\n---\r?\n# [^\r\n]+\r?\n\r?\n(?:Listed in COMPLEX\.md|Load bearing in COMPLEX\.md|Not ranked in COMPLEX\.md)/;

export function looksGenerated(text) {
  return text.includes(GENERATED_NOTICE) || text.includes(BLOCK_HEADING) || LEGACY_BRIEF.test(text);
}

const read = (p) => readFileSync(p, 'utf8');

/** Create the folder for a file, recording each folder that did not exist. */
export function ensureDir(root, relDir, ledger) {
  const missing = [];
  let d = relDir;
  while (d && d !== '.' && !existsSync(join(root, d))) {
    missing.push(d);
    d = dirname(d);
  }
  if (!missing.length) return;
  mkdirSync(join(root, relDir), { recursive: true });
  if (ledger) ledger.dirs.push(...missing);
}

/**
 * Remove a file the manifest lists, when its hash still matches.
 * Returns 'removed', 'edited' (left in place) or 'missing'.
 */
export function removeListedFile(root, entry) {
  const p = join(root, entry.path);
  if (!existsSync(p)) return 'missing';
  if (normalizedHash(read(p)) !== entry.sha256) return 'edited';
  rmSync(p);
  return 'removed';
}

/**
 * Remove a marked block the manifest lists, when its hash still matches,
 * with the separators that were added around it. A file wire created that
 * holds nothing else afterwards is removed too. Returns 'removed',
 * 'deleted' (the whole file), 'edited', or 'missing'.
 */
export function removeListedBlock(root, entry) {
  const p = join(root, entry.path);
  if (!existsSync(p)) return 'missing';
  const cur = read(p);
  const region = findRegion(cur);
  if (!region || region.broken) return 'missing';
  if (normalizedHash(region.text) !== entry.sha256) return 'edited';
  if (entry.created && !outsideRegion(cur).trim()) {
    rmSync(p);
    return 'deleted';
  }
  writeFileSync(p, removeRegion(cur, entry).text);
  return 'removed';
}

/**
 * Take the entries wire added out of a JSON file the manifest lists, then
 * the keys wire created for them once they are empty. A file wire created
 * that holds nothing else is removed. Returns 'removed', 'deleted',
 * 'edited' (not valid JSON any more; left in place) or 'missing'.
 */
export function removeListedEntry(root, entry) {
  const p = join(root, entry.path);
  const kind = ENTRY_KINDS[entry.kind];
  if (!kind || !existsSync(p)) return 'missing';
  const text = read(p);
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return 'edited';
  }
  if (!obj || typeof obj !== 'object') return 'edited';
  const before = JSON.stringify(obj);
  kind.strip(obj);
  const added = entry.added || [];
  for (const k of [...added].sort((a, b) => b.split('.').length - a.split('.').length)) {
    const v = getPath(obj, k);
    const empty = Array.isArray(v) ? !v.length : v && typeof v === 'object' ? !Object.keys(v).length : false;
    if (!empty) continue;
    const parts = k.split('.');
    const parent = parts.length > 1 ? getPath(obj, parts.slice(0, -1).join('.')) : obj;
    delete parent[parts.at(-1)];
  }
  /* A file wire created goes when only keys wire added, with no content
     of their own, are left in it: an empty object, or Cursor's version. */
  const isContainer = (v) => v !== null && typeof v === 'object';
  if (entry.created && Object.keys(obj).every((k) => added.includes(k) && !isContainer(obj[k]))) {
    rmSync(p);
    return 'deleted';
  }
  if (JSON.stringify(obj) === before) return 'missing';
  writeFileSync(p, jsonText(obj, text));
  return 'removed';
}

/** Remove the listed folders that are empty, deepest first. Returns the ones that remain. */
export function pruneDirs(root, dirs) {
  const kept = [];
  for (const d of [...new Set(dirs)].sort((a, b) => b.length - a.length)) {
    const p = join(root, d);
    if (!existsSync(p)) continue;
    if (statSync(p).isDirectory() && readdirSync(p).length === 0) rmdirSync(p);
    else kept.push(d);
  }
  return kept.sort();
}

/**
 * The owner for one wire run. `ledger` collects what this run wrote;
 * `ledger.previous` is the manifest of the run before, or null.
 */
export function createOwner({ root, ledger, report, log = () => {} }) {
  const prev = ledger.previous || { files: [], blocks: [], dirs: [] };
  const listed = (rel) => prev.files.find((f) => f.path === rel);
  const isOurs = (rel, text) => !!listed(rel) || looksGenerated(text);

  return {
    isOurs,

    /** Create the folder for a file, recording the folders wire created. */
    ensureDir(relDir) {
      ensureDir(root, relDir, ledger);
    },

    /** Write a generated file. Returns false, and writes nothing, when a file of the user's is at that path. */
    write(rel, content) {
      const p = join(root, rel);
      if (existsSync(p)) {
        const cur = read(p);
        if (!isOurs(rel, cur)) {
          report.skipped.push(`${rel} (not written by complex-md; left as it is)`);
          return false;
        }
        if (cur !== content) writeFileSync(p, content);
      } else {
        ensureDir(root, dirname(rel), ledger);
        writeFileSync(p, content);
      }
      ledger.files.push({ path: rel, sha256: normalizedHash(content), ...(ledger.target ? { target: ledger.target } : {}) });
      return true;
    },

    /** Remove a generated file this run does not write. Returns true when it was removed. */
    drop(rel) {
      const p = join(root, rel);
      if (!existsSync(p)) return false;
      const entry = listed(rel);
      if (entry) {
        const r = removeListedFile(root, entry);
        if (r === 'edited') log(`${rel} was edited after wire wrote it; left in place. Delete it by hand if it is no longer wanted.`);
        return r === 'removed';
      }
      if (!looksGenerated(read(p))) return false;
      rmSync(p);
      return true;
    },

    /** Remove unlisted generated files in a folder that `match` selects; listed ones are left to finish(). */
    clear(relDir, match) {
      const dir = join(root, relDir);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
      for (const name of readdirSync(dir)) {
        const rel = `${relDir}/${name}`;
        if (!match(name) || listed(rel) || !statSync(join(dir, name)).isFile()) continue;
        if (looksGenerated(read(join(dir, name)))) rmSync(join(dir, name));
      }
    },

    /* Everything the previous run wrote that this run did not: removed when
       unchanged, reported when edited. An entry of a target this run did
       not wire (OpenClaw's skill, after a wire without --for openclaw) is
       kept, and stays in the manifest. Then the folders wire created that
       are now empty. */
    finish(active = new Set()) {
      const keep = (e) => e.target && !active.has(e.target);
      const files = new Set(ledger.files.map((f) => f.path));
      for (const entry of prev.files) {
        if (files.has(entry.path)) continue;
        if (keep(entry) && existsSync(join(root, entry.path))) {
          ledger.files.push(entry);
          continue;
        }
        if (removeListedFile(root, entry) === 'edited') log(`${entry.path} was edited after wire wrote it; left in place. Delete it by hand if it is no longer wanted.`);
      }
      const blocks = new Set(ledger.blocks.map((b) => b.path));
      for (const entry of prev.blocks) {
        if (blocks.has(entry.path)) continue;
        if (keep(entry) && existsSync(join(root, entry.path))) {
          ledger.blocks.push(entry);
          continue;
        }
        if (removeListedBlock(root, entry) === 'edited') log(`The complex-md section in ${entry.path} was edited after wire wrote it; left in place.`);
      }
      /* Hook and MCP entries are written only on request, so a wire
         without --hooks keeps the record of the ones an earlier wire made. */
      const entries = new Set(ledger.entries.map((e) => `${e.kind} ${e.path}`));
      for (const entry of prev.entries || []) {
        if (!entries.has(`${entry.kind} ${entry.path}`) && existsSync(join(root, entry.path))) ledger.entries.push(entry);
      }
      ledger.dirs = pruneDirs(root, [...(prev.dirs || []), ...ledger.dirs]);
    },
  };
}
