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
import { GENERATED_NOTICE } from './targets.js';
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

    /** Write a generated file. */
    write(rel, content) {
      const p = join(root, rel);
      if (existsSync(p)) {
        if (read(p) !== content) writeFileSync(p, content);
      } else {
        ensureDir(root, dirname(rel), ledger);
        writeFileSync(p, content);
      }
      ledger.files.push({ path: rel, sha256: normalizedHash(content), ...(ledger.target ? { target: ledger.target } : {}) });
      return true;
    },

    /** Remove a block only copy an earlier wire wrote: it holds our heading. */
    drop(rel) {
      const p = join(root, rel);
      if (!existsSync(p) || !read(p).includes(BLOCK_HEADING)) return false;
      rmSync(p);
      return true;
    },

    /** Remove the files in a folder that `match` selects. */
    clear(relDir, match) {
      const dir = join(root, relDir);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
      for (const name of readdirSync(dir)) if (match(name) && statSync(join(dir, name)).isFile()) rmSync(join(dir, name));
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
      ledger.dirs = pruneDirs(root, [...(prev.dirs || []), ...ledger.dirs]);
    },
  };
}
