// Fake secrets, 1 or more per redact.js rule. Each value has the shape of
// a real token format and is plainly fake (FAKE, fake, 0123). Each is built
// from fragments at run time, so no whole token sits in this repository
// for a secret scanner to report.

import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const j = (...parts) => parts.join('');

/** rule name -> fake values that the rule must replace. */
export const FAKE = {
  'aws-access-key': [j('AKIA', 'FAKEKEYFAKEKEY22'), j('ASIA', 'FAKE2345FAKE2345')],
  'github-token': [j('ghp', '_', 'fake'.repeat(9)), j('gho', '_', 'Fake0'.repeat(7), 'F'), j('github', '_pat_', 'FAKE0'.repeat(4), 'FA', '_', 'fake0'.repeat(11), 'fake')],
  'anthropic-key': [j('sk-', 'ant-', 'api03-', 'Fake0-'.repeat(15), 'AA')],
  'openai-key': [j('sk-', 'proj-', 'Fake0_'.repeat(8)), j('sk-', 'fake'.repeat(5), 'T3Blbk', 'FJ', 'fake'.repeat(5))],
  'slack-token': [j('xox', 'b-', '1234567890-', '1234567890-', 'FakeFakeFakeFake0123')],
  'slack-webhook': [j('https://hooks.', 'slack.com/services/', 'T00000000/', 'B00000000/', 'FAKE'.repeat(6))],
  'stripe-key': [j('sk', '_live_', 'Fake0'.repeat(5)), j('rk', '_live_', 'fake1'.repeat(5))],
  'google-api-key': [j('AI', 'za', 'Fake0'.repeat(7))],
  'private-key': [j('-----BEGIN ', 'RSA PRIVATE KEY-----\n', 'FAKEfakeFAKEfake0123456789+/FAKEfakeFAKEfake0123456789+/\n', 'ZmFrZWZha2VmYWtl\n', '-----END ', 'RSA PRIVATE KEY-----')],
  jwt: [j('eyJ', 'hbGciOiJub25lIn0', '.', 'eyJ', 'zdWIiOiJmYWtlIn0', '.', 'ZmFrZXNpZ25hdHVyZQ')],
  'generic-assignment': [j('Q7fk2Lm9', 'xPz4Rt8w'), j('a8F3kL0p', 'Qz7Xw2Ty')],
};

/** A source file that holds every fake value, the way code hard-codes a key. */
export function leakyFile() {
  const [g1, g2] = FAKE['generic-assignment'];
  return [
    "// config with keys pasted in",
    `export const AWS_ID = '${FAKE['aws-access-key'][0]}';`,
    `export const session = "${FAKE['aws-access-key'][1]}";`,
    `const gh = '${FAKE['github-token'][0]}', oauth = '${FAKE['github-token'][1]}';`,
    `const pat = \`${FAKE['github-token'][2]}\`;`,
    `const anthropic = '${FAKE['anthropic-key'][0]}';`,
    `const openai = ['${FAKE['openai-key'][0]}', '${FAKE['openai-key'][1]}'];`,
    `const slack = { bot: '${FAKE['slack-token'][0]}', hook: '${FAKE['slack-webhook'][0]}' };`,
    `const stripe = ['${FAKE['stripe-key'][0]}', '${FAKE['stripe-key'][1]}'];`,
    `const maps = '${FAKE['google-api-key'][0]}';`,
    `const pem = \`${FAKE['private-key'][0]}\`;`,
    `const bearer = '${FAKE.jwt[0]}';`,
    `const dbPassword = "${g1}";`,
    `// API_TOKEN=${g2}`,
    'export function a() { return 1; }',
    '',
  ].join('\n');
}

/** Every fake value, flat. */
export const ALL_FAKES = Object.values(FAKE).flat();

/* A repository whose top hotspot holds every fake value. */
export function leakyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-redact-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@x' } });
  g('init', '-q');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/b.js'), "import { a } from './a.js';\nexport const b = a;\n");
  for (let i = 0; i < 4; i++) {
    writeFileSync(join(dir, 'src/a.js'), leakyFile() + `export const n = ${i};\n`);
    g('add', '.');
    g('commit', '-q', '-m', i ? `fix: a (${i})` : 'init');
  }
  return dir;
}
