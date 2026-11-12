// The CLI writes its working files (the prompt bundle, the computed front
// matter) to .complex-md/ at the repository root. They are inputs for one
// run and belong to no commit, so the directory goes into .gitignore when
// the CLI writes there. One file in it is the engineer's own and is not
// ignored: bounds.json, which `impact` reads and CI needs in the commit.
// Git cannot re-include a file under an ignored directory, so the entry
// ignores the directory's content (`.complex-md/*`), not the directory.
// manifest.json, the record of what wire wrote, is kept the same way, and
// so is exposure.json, the allows and baseline of `complex-md exposure`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const WORK_DIR = '.complex-md';
const ENTRY = `${WORK_DIR}/*`;
const KEEP = `!${WORK_DIR}/bounds.json`;
const KEEP_MANIFEST = `!${WORK_DIR}/manifest.json`;
const KEEP_EXPOSURE = `!${WORK_DIR}/exposure.json`;
// Spellings that ignore the folder itself: git then never looks inside it,
// so no `!` line below can bring a file back.
const WHOLE_FOLDER = new Set(['', '/'].flatMap((tail) => [`${WORK_DIR}${tail}`, `/${WORK_DIR}${tail}`]));
const SPELLINGS = new Set(['', '/', '/*', '/**'].flatMap((tail) => [`${WORK_DIR}${tail}`, `/${WORK_DIR}${tail}`]));

function read(root) {
  const p = join(root, '.gitignore');
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** True when the root .gitignore already ignores the working directory. */
export function ignoresWorkDir(root) {
  const text = read(root);
  return text !== null && text.split(/\r?\n/).some((l) => SPELLINGS.has(l.trim()));
}

/** What adding the entry would do to .gitignore: 'create', 'change', or null when it is there already. */
export function gitignoreAction(root) {
  if (ignoresWorkDir(root)) return null;
  return read(root) === null ? 'create' : 'change';
}

/** Add the entry when it is missing. Returns the action taken, or null. */
export function ignoreWorkDir(root) {
  const action = gitignoreAction(root);
  if (!action) return null;
  const text = read(root) || '';
  const sep = text && !text.endsWith('\n') ? '\n' : '';
  writeFileSync(join(root, '.gitignore'), `${text}${sep}# complex-md working files; bounds.json, manifest.json and exposure.json stay committable\n${ENTRY}\n${KEEP}\n${KEEP_MANIFEST}\n${KEEP_EXPOSURE}\n`);
  return action;
}

/**
 * A .gitignore written before `complex-md exposure` existed ignores
 * .complex-md/exposure.json with the rest of the folder. Append its keep
 * line once, after the entry. Returns 'added', null when there is nothing
 * to do (no entry, or the line is there), or 'blocked' when the entry
 * ignores the whole folder, so no keep line can work.
 */
export function keepExposureConfig(root) {
  const text = read(root);
  if (text === null || !ignoresWorkDir(root)) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(KEEP_EXPOSURE) || lines.includes(`/${KEEP_EXPOSURE.slice(1)}`)) return null;
  if (lines.some((l) => WHOLE_FOLDER.has(l))) return 'blocked';
  const sep = text.endsWith('\n') ? '' : '\n';
  writeFileSync(join(root, '.gitignore'), `${text}${sep}${KEEP_EXPOSURE}\n`);
  return 'added';
}
