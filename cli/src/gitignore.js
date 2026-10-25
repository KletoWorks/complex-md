// The CLI writes its working files (the prompt bundle, the computed front
// matter) to .complex-md/ at the repository root. They are inputs for one
// run and belong to no commit, so the directory goes into .gitignore when
// the CLI writes there. One file in it is the engineer's own and is not
// ignored: bounds.json, which `impact` reads and CI needs in the commit.
// Git cannot re-include a file under an ignored directory, so the entry
// ignores the directory's content (`.complex-md/*`), not the directory.
// manifest.json, the record of what wire wrote, is kept the same way.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const WORK_DIR = '.complex-md';
const ENTRY = `${WORK_DIR}/*`;
const KEEP = `!${WORK_DIR}/bounds.json`;
const KEEP_MANIFEST = `!${WORK_DIR}/manifest.json`;
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
  writeFileSync(join(root, '.gitignore'), `${text}${sep}# complex-md working files; bounds.json and manifest.json stay committable\n${ENTRY}\n${KEEP}\n${KEEP_MANIFEST}\n`);
  return action;
}
