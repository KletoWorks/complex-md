// unwire: remove what wire wrote, as .complex-md/manifest.json records it.
// A file wire wrote whole is deleted, and a marked block is cut out with
// the separators added around it, but only while the text still matches
// the recorded hash. Anything the user edited since is left in place and
// reported, and nothing the manifest does not name is touched. COMPLEX.md
// is the map, not wiring, so it stays.
import { existsSync, readdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { readManifest, writeManifest, MANIFEST_PATH } from './manifest.js';
import { removeListedFile, removeListedBlock, removeListedEntry, pruneDirs } from './own.js';
import { WORK_DIR } from './gitignore.js';
import { OWN_BRIEF_DIRS } from './targets.js';

export function unwire(root, { log = () => {} } = {}) {
  const report = { manifest: true, removed: [], deleted: [], left: [], missing: [] };
  const m = readManifest(root);
  if (!m) {
    log(`complex-md: no ${MANIFEST_PATH}, so there is no record of what wire wrote and unwire removes nothing. A wire from this version writes the record; run wire, then unwire.`);
    return { ...report, manifest: false };
  }
  if (m.invalid) throw new Error(`${MANIFEST_PATH} is not readable JSON; unwire removes nothing it cannot prove complex-md wrote.`);
  if (m.rejected.length) log(`ignored ${m.rejected.length} ${MANIFEST_PATH} entries whose path is outside the repository or in .git: ${m.rejected.join(', ')}`);
  const linked = (entry) => {
    report.left.push(entry);
    log(`left ${entry.path}: a symbolic link resolves outside the repository or into .git, so unwire does not touch it.`);
  };

  const left = { files: [], blocks: [], entries: [], dirs: [] };
  for (const entry of m.files) {
    const r = removeListedFile(root, entry);
    if (r === 'removed') report.deleted.push(entry.path);
    else if (r === 'missing') report.missing.push(entry.path);
    else if (r === 'linked') linked(entry);
    else {
      report.left.push(entry);
      left.files.push(entry);
      log(`left ${entry.path}: it was edited after wire wrote it. Delete it by hand if it is no longer wanted.`);
    }
  }
  for (const entry of m.blocks) {
    const r = removeListedBlock(root, entry);
    if (r === 'removed') report.removed.push(entry.path);
    else if (r === 'deleted') report.deleted.push(entry.path);
    else if (r === 'missing') report.missing.push(entry.path);
    else if (r === 'linked') linked(entry);
    else {
      report.left.push(entry);
      left.blocks.push(entry);
      log(`left the complex-md section in ${entry.path}: it was edited after wire wrote it. Delete it between its markers by hand.`);
    }
  }
  for (const entry of m.entries || []) {
    const r = removeListedEntry(root, entry);
    if (r === 'removed') report.removed.push(entry.path);
    else if (r === 'deleted') report.deleted.push(entry.path);
    else if (r === 'missing') report.missing.push(entry.path);
    else if (r === 'linked') linked(entry);
    else {
      report.left.push(entry);
      left.entries.push(entry);
      log(`left ${entry.path}: the JSON or a recorded complex-md entry was edited after wire wrote it. Restore it and run unwire again, or remove the entry by hand.`);
    }
  }
  if ((m.entries || []).some((e) => e.path === '.claude/settings.local.json')) {
    log('The line /.claude/settings.local.json that wire --hooks --local added to .git/info/exclude stays; it affects this clone only.');
  }
  left.dirs = pruneDirs(root, m.dirs || []);
  // A brief folder named after complex-md goes once it is empty (targets.js).
  pruneDirs(root, OWN_BRIEF_DIRS);
  /* What is left stays on record, so a later unwire, after the user
     reverts or deletes those files, still knows they were complex-md's. */
  writeManifest(root, left);
  const work = join(root, WORK_DIR);
  if (existsSync(work) && readdirSync(work).length === 0) rmdirSync(work);

  if (report.deleted.length) log(`deleted: ${report.deleted.join(', ')}`);
  if (report.removed.length) log(`removed the complex-md section from: ${report.removed.join(', ')}`);
  if (report.missing.length) log(`already gone: ${report.missing.join(', ')}`);
  log('COMPLEX.md stays: unwire removes the wiring, not the map. Delete COMPLEX.md and .complex-md/ by hand to remove the map as well.');
  return report;
}
