// A run with no provider key sends nothing anywhere. The bin runs with the
// network taken away (fixtures/no-network.mjs): fetch, http, https, net, tls
// and dns all throw and log the attempt, and the test fails on any entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildRegressionRepo } from './fixtures/regression-repo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'complex-md.js');
// --import takes a URL, and on Windows a drive letter reads as a scheme.
const PRELOAD = pathToFileURL(join(here, 'fixtures', 'no-network.mjs')).href;
const NO_KEYS = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/_API_KEY$|^COMPLEX_MD_|^OLLAMA_HOST$/.test(k)));

function offline(cwd, args) {
  const logFile = join(mkdtempSync(join(tmpdir(), 'cx-net-')), 'attempts.log');
  const r = spawnSync(process.execPath, ['--import', PRELOAD, ...args], { cwd, encoding: 'utf8', env: { ...NO_KEYS, NO_NETWORK_LOG: logFile, GIT_CEILING_DIRECTORIES: dirname(cwd) } });
  return { ...r, attempts: existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n') : [] };
}

test('the network stub records every kind of request it blocks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cx-net-probe-'));
  const probe = "for (const f of [() => fetch('https://example.com'), () => require('node:https').get('https://example.com'), () => require('node:http').request('http://example.com'), () => require('node:net').connect(80, 'example.com')]) { try { const p = f(); p?.catch?.(() => {}); } catch {} }";
  const r = offline(dir, ['-e', probe]);
  assert.equal(r.attempts.length, 4, r.stderr);
});

test('the stub sees the model call a keyed run makes, so a silent pass is not possible', () => {
  const dir = buildRegressionRepo();
  const logFile = join(mkdtempSync(join(tmpdir(), 'cx-net-')), 'attempts.log');
  spawnSync(process.execPath, ['--import', PRELOAD, BIN, '--yes'], { cwd: dir, encoding: 'utf8', env: { ...NO_KEYS, ANTHROPIC_API_KEY: 'test', NO_NETWORK_LOG: logFile, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.match(readFileSync(logFile, 'utf8'), /^fetch https:\/\/api\.anthropic\.com\//);
});

test('a first run with no key makes no network request and still lands a wired map', () => {
  const dir = buildRegressionRepo();
  const r = offline(dir, [BIN, '--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.attempts, []);
  assert.match(readFileSync(join(dir, 'COMPLEX.md'), 'utf8'), /^prose: template$/m);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
});
