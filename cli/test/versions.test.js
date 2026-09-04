// The three version axes must agree: the spec the engine computes, the spec
// the prompt declares, and the spec the site publishes. The CLI version is
// semver on its own axis and must be a valid release string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC_VERSION } from '../src/signals.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

test('spec version agrees across engine, prompt and spec page', () => {
  const prompt = readFileSync(join(root, 'prompts/generate.md'), 'utf8');
  const promptSpec = /spec_version:\s*"([\d.]+)"/.exec(prompt)?.[1];
  const page = readFileSync(join(root, 'content/spec.md'), 'utf8');
  const pageSpec = /^# COMPLEX\.md spec ([\d.]+)/m.exec(page)?.[1];
  assert.equal(promptSpec, SPEC_VERSION, 'prompts/generate.md spec_version vs signals.js SPEC_VERSION');
  assert.equal(pageSpec, SPEC_VERSION, 'content/spec.md heading vs signals.js SPEC_VERSION');
});

test('prompt version is a full semver and the CLI version is a release semver', () => {
  const prompt = readFileSync(join(root, 'prompts/generate.md'), 'utf8');
  assert.match(/prompt_version:\s*([\d.]+)/.exec(prompt)?.[1] ?? '', /^\d+\.\d+\.\d+$/);
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'cli/package.json version');
});

test('the CLI copy of the prompts is byte-identical to the source of truth', () => {
  for (const f of ['generate.md', 'integration.md']) {
    assert.equal(readFileSync(join(here, '..', 'prompts', f), 'utf8'), readFileSync(join(root, 'prompts', f), 'utf8'), `cli/prompts/${f} out of step; run npm run build`);
  }
});
