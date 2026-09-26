import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSecretPath, dropSecretPaths } from '../src/secrets.js';

test('credential shaped paths are recognised', () => {
  for (const p of ['.env', '.env.production', 'config/.env.local', 'deploy/id_rsa', 'certs/server.pem',
    'k8s/secrets.yaml', 'credentials.json', '.npmrc', '.aws/credentials', 'gcp-key-prod.json', '.git-credentials']) {
    assert.ok(isSecretPath(p), `${p} should be dropped`);
  }
});

test('ordinary paths are not', () => {
  for (const p of ['src/env.js', 'src/environment.ts', 'lib/keys.js', 'docs/secrets-policy.md',
    'test/credentials.test.js', 'src/pem-parser.js', '.env.example', '.envrc.sample']) {
    assert.ok(!isSecretPath(p), `${p} should be kept`);
  }
});

test('dropSecretPaths partitions and preserves order', () => {
  const { kept, dropped } = dropSecretPaths(['a.js', '.env', 'b.js', 'x.pem']);
  assert.deepEqual(kept, ['a.js', 'b.js']);
  assert.deepEqual(dropped, ['.env', 'x.pem']);
});

test('a credential shaped path is dropped from the map and counted in blind_spots', async () => {
  const { computeSignals } = await import('../src/signals.js');
  const { mkdtempSync: mk, writeFileSync: w, mkdirSync: md } = await import('node:fs');
  const { tmpdir: td } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mk(join(td(), 'cx-secret-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  md(join(dir, 'src'));
  w(join(dir, 'src/a.js'), "import x from '../.env.production';\nexport const a = 1;\n");
  w(join(dir, '.env.production'), 'TOKEN=abc\n');
  w(join(dir, 'README.md'), '# r\n');
  g('add', '.'); g('commit', '-q', '-m', 'init');
  for (let i = 0; i < 4; i += 1) { w(join(dir, '.env.production'), `TOKEN=${i}\n`); g('add', '.'); g('commit', '-q', '-m', `fix: rotate ${i}`); }
  const s = computeSignals(dir);
  const named = (list) => list.some((r) => (r.path || '').includes('.env'));
  assert.ok(!named(s.hotspots) && !named(s.load_bearing) && !named(s.table), 'never named in a list');
  assert.ok(s.blind_spots.some((b) => /credential shaped path/.test(b)), 'declared in blind_spots');
});
