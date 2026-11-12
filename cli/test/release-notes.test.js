// The GitHub release notes come from CHANGELOG.md (scripts/release-notes.mjs).
// release.yml refuses to publish a version that has no section there. Runs
// only inside the repository checkout; the published CLI package has no
// scripts/ folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts/release-notes.mjs');
const inCheckout = existsSync(SCRIPT);
const load = () => import(pathToFileURL(SCRIPT).href);

const CHANGELOG = `# Changelog

## Unreleased

**Change:** not released yet.

## 2026-10-02  0.9.10: the tenth patch

**Change:** ten.

## 2026-10-01  0.9.1: the CLI reads its prompts from the repository

**Intent:** a run failed when the
packaged copy was absent.

**Change:** the CLI reads
\`prompts/\` first.

### Also in 0.9.1

- A list item that wraps
  onto a second line.
- A second item.

## 2026-09-30  Credential shaped paths are never named

**Change:** a section with no version.
`;

test('the notes are the section of the version, its lines joined per paragraph', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { releaseNotes } = await load();
  assert.equal(releaseNotes(CHANGELOG, '0.9.1'), [
    '**0.9.1, 2026-10-01:** the CLI reads its prompts from the repository',
    '',
    '**Intent:** a run failed when the packaged copy was absent.',
    '',
    '**Change:** the CLI reads `prompts/` first.',
    '',
    '### Also in 0.9.1',
    '',
    '- A list item that wraps onto a second line.',
    '- A second item.',
    '',
  ].join('\n'));
});

test('a version matches only its own heading, with or without the v', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { releaseNotes } = await load();
  assert.match(releaseNotes(CHANGELOG, 'v0.9.10'), /^\*\*0\.9\.10, 2026-10-02:\*\* the tenth patch\n\n\*\*Change:\*\* ten\.\n$/);
  assert.ok(!releaseNotes(CHANGELOG, '0.9.1').includes('ten.'), '0.9.1 does not take the 0.9.10 section');
  assert.equal(releaseNotes(CHANGELOG, '0.9'), null);
  assert.equal(releaseNotes(CHANGELOG, '1.0.0'), null);
  assert.equal(releaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '0.9.10'), releaseNotes(CHANGELOG, '0.9.10'), 'CRLF reads the same');
});

test('CHANGELOG.md has a release section for the version in cli/package.json', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { version } = JSON.parse(readFileSync(join(ROOT, 'cli/package.json'), 'utf8'));
  const r = spawnSync(process.execPath, [SCRIPT, version], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith(`**${version}, `), r.stdout.slice(0, 80));
  const missing = spawnSync(process.execPath, [SCRIPT, '99.0.0'], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no section "## YYYY-MM-DD {2}99\.0\.0: \.\.\."/);
});
