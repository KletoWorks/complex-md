// Fake secrets, 1 or more per E1 rule in cli/rules/exposure.json. Each
// value has the shape of a real token format and is plainly fake (FAKE,
// Fake0, 0123). Each is built from fragments at run time, so no whole
// token sits in this repository for a secret scanner to report.

import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const j = (...parts) => parts.join('');
/** `seed` repeated and cut to exactly `n` characters. */
const fill = (seed, n) => seed.repeat(Math.ceil(n / seed.length)).slice(0, n);
// 31 distinct characters, so a value cut from it passes every entropy floor.
const MIX = j('Fake0Qz7Xw2Ty9', 'Lm4Pk8Rv3Ns6Hd1Jb5');
const HEX = '0123456789abcdef';

/** rule id -> fake values that the rule must match. */
export const FAKE = {
  'private-key': [j('-----BEGIN ', 'RSA PRIVATE KEY-----\n', 'FAKEfakeFAKEfake0123456789+/FAKEfakeFAKEfake0123456789+/\n', 'ZmFrZWZha2VmYWtl\n', '-----END ', 'RSA PRIVATE KEY-----')],
  'aws-access-key': [j('AKIA', 'FAKEKEYFAKEKEY22'), j('ASIA', 'FAKE2345FAKE2345')],
  // A name-bound rule: the fake carries its assignment.
  'aws-secret-key': [j('aws_secret', '_access_key = ', fill(j(MIX, '/+'), 40))],
  'github-token': [j('ghp', '_', 'fake'.repeat(9)), j('gho', '_', 'Fake0'.repeat(7), 'F'), j('github', '_pat_', 'FAKE0'.repeat(4), 'FA', '_', 'fake0'.repeat(11), 'fake')],
  'gitlab-token': [j('glpat', '-', fill(MIX, 20))],
  'anthropic-key': [j('sk-', 'ant-', 'api03-', 'Fake0-'.repeat(15), 'AA')],
  'openai-key': [j('sk-', 'proj-', 'Fake0_'.repeat(8)), j('sk-', 'fake'.repeat(5), 'T3Blbk', 'FJ', 'fake'.repeat(5))],
  'openrouter-key': [j('sk-or', '-v1-', fill(HEX, 64))],
  'groq-key': [j('gsk', '_', fill(MIX, 52))],
  'xai-key': [j('xai', '-', fill(MIX, 80))],
  'perplexity-key': [j('pplx', '-', fill(MIX, 48))],
  'huggingface-token': [j('hf', '_', fill(MIX, 34))],
  'replicate-token': [j('r8', '_', fill(MIX, 37))],
  'slack-token': [j('xox', 'b-', '1234567890-', '1234567890-', 'FakeFakeFakeFake0123')],
  'slack-webhook': [j('https://hooks.', 'slack.com/services/', 'T00000000/', 'B00000000/', 'FAKE'.repeat(6))],
  'discord-webhook': [j('https://discord', '.com/api/webhooks/', '123456789012345678/', fill(MIX, 68))],
  'telegram-bot-token': [j('123456789', ':AA', fill(MIX, 33))],
  'stripe-key': [j('sk', '_live_', 'Fake0'.repeat(5)), j('rk', '_live_', 'fake1'.repeat(5))],
  'stripe-webhook-secret': [j('whsec', '_', fill(MIX, 32))],
  'google-api-key': [j('AI', 'za', 'Fake0'.repeat(7))],
  'google-oauth-secret': [j('GOCSPX', '-', fill(MIX, 28))],
  'alibaba-access-key': [j('LTAI', fill(MIX, 16))],
  'tencent-secret-id': [j('AKID', fill(MIX, 32))],
  'azure-storage-key': [j('Account', 'Key=', fill(MIX, 86), '==')],
  'digitalocean-token': [j('dop', '_v1_', fill(HEX, 64))],
  'npm-token': [j('npm', '_', fill(MIX, 36))],
  'pypi-token': [j('pypi-', 'AgEIcHlwaS5vcmc', fill(MIX, 60))],
  'rubygems-key': [j('rubygems', '_', fill(HEX, 48))],
  'docker-hub-token': [j('dckr', '_pat_', fill(MIX, 27))],
  'sendgrid-key': [j('SG', '.', fill(MIX, 22), '.', fill(MIX, 43))],
  'mailchimp-key': [j(fill(HEX, 32), '-us', '12')],
  'shopify-token': [j('shpat', '_', fill(HEX, 32))],
  'linear-key': [j('lin', '_api_', fill(MIX, 40))],
  'notion-token': [j('ntn', '_', fill(MIX, 46))],
  'airtable-token': [j('pat', fill(MIX, 14), '.', fill(HEX, 64))],
  'figma-token': [j('figd', '_', fill(MIX, 43))],
  'postman-key': [j('PMAK', '-', fill(HEX, 24), '-', fill(HEX, 34))],
  'databricks-token': [j('dapi', fill(HEX, 32))],
  'doppler-token': [j('dp', '.pt.', fill(MIX, 43))],
  'vault-token': [j('hvs', '.', fill(MIX, 90))],
  'terraform-token': [j(fill(MIX, 14), '.atlas', 'v1.', fill(MIX, 67))],
  'atlassian-token': [j('ATATT', '3', fill(MIX, 183))],
  'sentry-token': [j('sntrys', '_', fill(MIX, 60))],
  'grafana-token': [j('glsa', '_', fill(MIX, 32), '_', '0123abcd')],
  'newrelic-key': [j('NRAK', '-', fill('FAKE0123456789QZXWTYLMPRVNS', 27))],
  'planetscale-token': [j('pscale', '_tkn_', fill(MIX, 43))],
  'supabase-key': [j('sbp', '_', fill(HEX, 40))],
  'square-token': [j('sq0', 'atp-', fill(MIX, 22))],
  'mapbox-secret-token': [j('sk', '.eyJ', fill(MIX, 60), '.', fill(MIX, 22))],
  'age-secret-key': [j('AGE-SECRET', '-KEY-1', fill('QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L', 58))],
  'fcm-server-key': [j('AAAA', fill(MIX, 7), ':', fill(MIX, 140))],
  jwt: [j('eyJ', 'hbGciOiJub25lIn0', '.', 'eyJ', 'zdWIiOiJmYWtlIn0', '.', 'ZmFrZXNpZ25hdHVyZQ')],
  'credentials-in-url': [j('postgres', '://app:', 'Q7fk2Lm9', 'xPz4', '@db.internal:5432/app')],
  'generic-assignment': [j('Q7fk2Lm9', 'xPz4Rt8w'), j('a8F3kL0p', 'Qz7Xw2Ty')],
};

/** A source file that holds every fake value, the way code hard-codes a key. */
export function leakyFile() {
  const [g1, g2] = FAKE['generic-assignment'];
  const done = new Set(['private-key', 'aws-access-key', 'github-token', 'anthropic-key', 'openai-key', 'slack-token', 'slack-webhook', 'stripe-key', 'google-api-key', 'jwt', 'generic-assignment']);
  const rest = Object.entries(FAKE).filter(([rule]) => !done.has(rule)).flatMap(([, values]) => values);
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
    ...rest.map((v, i) => `const v${i} = '${v}';`),
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
