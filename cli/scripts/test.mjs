#!/usr/bin/env node
// Run the test suite with its own temporary folder, and delete it after.
// Tests make about 150 temporary repositories with mkdtempSync(tmpdir())
// and leave them; on a busy machine they filled the disk. Pointing TMPDIR,
// TMP and TEMP at 1 folder per run catches every one of them, including
// those made by child processes.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'cx-test-run-'));
const env = { ...process.env, TMPDIR: dir, TMP: dir, TEMP: dir };
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2)], { stdio: 'inherit', env });
try { rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { console.error(`test: could not remove ${dir}: ${e.message}`); }
process.exit(r.status ?? 1);
