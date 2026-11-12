#!/usr/bin/env node
// The notes of a GitHub release: the CHANGELOG.md section of that version.
// A release section has the heading `## YYYY-MM-DD  X.Y.Z: summary`, and
// runs to the next `## ` heading. release.yml checks that the section exists
// before it publishes, and creates the release from it after.
//
//   node scripts/release-notes.mjs 0.11.0      prints the notes, or exits 1
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The notes for `version` from the text of CHANGELOG.md, or null. */
export function releaseNotes(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const v = version.replace(/^v/, '').replace(/\./g, '\\.');
  const head = new RegExp(`^## (\\d{4}-\\d{2}-\\d{2})\\s+${v}:\\s*(.*)$`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  const [, date, summary] = head.exec(lines[start]);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  const body = unwrap((end < 0 ? rest : rest.slice(0, end)).join('\n').trim());
  return `**${version.replace(/^v/, '')}, ${date}:** ${summary}\n\n${body}\n`;
}

/* CHANGELOG.md wraps its paragraphs at about 76 characters. A release page
   shows each line break, so the notes join the lines of a paragraph and
   of a list item. A blank line, a heading or a new list item starts a new
   line, and no line joins a heading. */
export function unwrap(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const prev = out.length ? out[out.length - 1] : '';
    const starts = line.trim() === '' || /^\s*([-*]|\d+\.) /.test(line) || line.startsWith('#');
    if (starts || prev.trim() === '' || prev.startsWith('#')) out.push(starts ? line.trimEnd() : line.trim());
    else out[out.length - 1] = `${prev} ${line.trim()}`;
  }
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version>');
    process.exit(2);
  }
  const notes = releaseNotes(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'), version);
  if (!notes) {
    console.error(`CHANGELOG.md has no section "## YYYY-MM-DD  ${version.replace(/^v/, '')}: ..."`);
    process.exit(1);
  }
  process.stdout.write(notes);
}
