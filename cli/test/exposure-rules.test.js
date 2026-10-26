// The E1 rule set in cli/rules/exposure.json: every rule is well formed,
// matches its fake token and nothing in the near misses, and no shipped
// expression can stall a scan. The loader refuses an expression outside
// the bounded subset, and a rule that names code it does not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shippedRules, compileRules, checkRegex, checkRuleFile, looksRandom } from '../src/exposure-rules.js';
import { scanText, fingerprint, allowComments, inlineAllow } from '../src/exposure-scan.js';
import { FAKE } from './fixtures/fake-secrets.mjs';

const all = compileRules(shippedRules().rules);
const ids = (text) => scanText(text, all).map((m) => m.rule.id);

test('the shipped rule file is well formed: 54 E1 rules, each with every field', () => {
  const s = shippedRules();
  assert.deepEqual(checkRuleFile(s), []);
  assert.equal(s.rules.length, 54);
  for (const r of s.rules) {
    assert.equal(r.slice, 'E1', r.id);
    for (const k of ['id', 'title', 'established', 'severity', 'confidence', 'cwe', 'directive']) assert.ok(r[k], `${r.id}: ${k}`);
    assert.ok(r.match.keywords.length, `${r.id}: keywords`);
  }
  assert.equal(s.rules.at(-1).id, 'generic-assignment', 'the heuristic rule runs last, so a specific rule keeps a shared span');
  assert.equal(s.rules.find((r) => r.id === 'generic-assignment').confidence, 'low');
  assert.match(s.hash, /^[0-9a-f]{12}$/);
});

test('each rule matches its fake value, and only that rule', () => {
  assert.deepEqual(Object.keys(FAKE).sort(), shippedRules().rules.map((r) => r.id).sort(), 'a fake for every rule');
  for (const [rule, values] of Object.entries(FAKE)) {
    for (const v of values) {
      const line = rule === 'generic-assignment' ? `const apiSecret = "${v}";` : `const x = '${v}';`;
      assert.deepEqual(ids(line), [rule], `${rule} in ${line.slice(0, 50)}`);
    }
  }
});

test('code, names, ids, paths, hashes and prose are not secrets', () => {
  const misses = [
    'const token = req.headers.authorization;',
    'this.oauth20tokenServices = oauth20tokenServices;',
    'ClientSecret: config.Setting.OAUTH2_SETTINGS.ClientSecret,',
    'if (keyPairType==KeyPairType.RSA) {',
    '(click)="passwordVisible = !passwordVisible"',
    'prompt_tokens: usage.prompt_tokens ?? null,',
    'clientId = "a8F3kL0pQz7Xw2Ty9"',
    'ACTIVATION_KEY_NAME_1="activation_key_1_$RAND"',
    'TokenURL: "Q7fk2Lm9xPz4Rt8wQ7"',
    'keystoreFile = "D:\\\\keys\\\\Q7fk2Lm9.jks"',
    'public static final String APPLICATION_JWT_UTF8 = "application/jwt;charset=UTF-8";',
    'jdbc.url=jdbc:mysql://db/maxkey?allowPublicKeyRetrieval=true&serverTimezone=UTC8',
    '"password": "$6$Q7fk2Lm9$xPz4Rt8wa8F3kL0pQz7Xw2Ty"',
    '"fieldDefKey": "0A1B2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D",',
    'spring.druid.publickey=MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKQ7fk2Lm9xPz4Rt8w',
    'keyFinding: "人参皂苷可以帮助肺部健康和呼吸系统的功能恢复"',
    '# DB_PASSWORD=\n\nSESSION_DRIVER=database',
    'APP_KEY=',
    'aws_secret_access_key = AKIAIOSFODNN7EXAMPLEAKIAIOSFODNN7EXAMPLE',
    'url = "postgres://app:${DB_PASSWORD}@db:5432/app"',
  ];
  for (const m of misses) assert.deepEqual(ids(m), [], m);
});

test('a UUID counts under a secret name, not under a name that only says key', () => {
  assert.deepEqual(ids('const JwtSecret = "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"'), ['generic-assignment']);
  assert.deepEqual(ids('"fieldDefKey": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"'), []);
});

test('a specific rule keeps a span that the generic rule also matches', () => {
  const [gh] = FAKE['github-token'];
  assert.deepEqual(ids(`GITHUB_TOKEN="${gh}"`), ['github-token']);
});

test('a match reports its line and column, and its fingerprint has no path in it', () => {
  const [v] = FAKE['aws-access-key'];
  const [m] = scanText(`a\nb\n  key = '${v}'\n`, all);
  assert.equal(m.line, 3);
  assert.equal(m.column, 10);
  assert.equal(m.value, v);
  assert.match(fingerprint(m.rule.id, m.value), /^[0-9a-f]{16}$/);
  assert.equal(fingerprint('aws-access-key', v), fingerprint('aws-access-key', v));
  assert.notEqual(fingerprint('aws-access-key', v), fingerprint('github-token', v));
});

test('checkRegex accepts the bounded subset and refuses the rest', () => {
  for (const ok of ['\\b(ghp_[A-Za-z0-9]{36})\\b', '(?:ab){1,3}', 'a{0,5}?', '(?:x{1,2})?', '[a+*]{1,2}', 'x{2}', '\\{1,2']) assert.equal(checkRegex(ok), null, ok);
  const bad = {
    'a+': /no upper bound/,
    'a*': /no upper bound/,
    'a{1,}': /no upper bound/,
    '(a{1,3}){1,4}': /repeated group holds another quantifier/,
    '(?=a)': /lookaround/,
    '(?<!a)b': /lookaround/,
    '(a)\\1': /back references/,
    'a{1,99999}': /above/,
    '(a': /not closed/,
    'a)': /never opened/,
    'ab|?': /follows nothing/,
  };
  for (const [re, why] of Object.entries(bad)) assert.match(checkRegex(re) || '', why, re);
  assert.match(checkRegex('a'.repeat(1025)), /longer than/);
});

test('a rule file with an unbounded expression or an unknown predicate is refused', () => {
  const rule = (match) => ({ id: 'own-token', slice: 'E1', title: 'Own token', established: 'exact', severity: 'high', confidence: 'high', cwe: 'CWE-798', directive: 'Rotate it.', match: { type: 'content', keywords: ['own_'], regex: '(own_[a-z0-9]{20})', ...match } });
  assert.deepEqual(checkRuleFile({ rules: [rule({})] }), []);
  assert.match(checkRuleFile({ rules: [rule({ regex: '(own_.+)' })] }).join('\n'), /own-token: match\.regex: the quantifier \+ has no upper bound/);
  assert.match(checkRuleFile({ rules: [rule({ predicate: 'run-code' })] }).join('\n'), /predicate "run-code" is not one of random-value/);
  assert.match(checkRuleFile({ rules: [rule({ keywords: ['OWN_'] })] }).join('\n'), /lower case/);
  assert.match(checkRuleFile({ rules: [rule({}), rule({})] }).join('\n'), /appears twice/);
});

test('no shipped expression stalls on long adversarial text', () => {
  const inputs = [
    'a'.repeat(100000), 'A'.repeat(100000), '0'.repeat(100000), 'key='.repeat(25000),
    `key = "${'a1'.repeat(50000)}`, `-----BEGIN RSA PRIVATE KEY-----${'A'.repeat(100000)}`,
    `eyJ${'a'.repeat(50000)}.eyJ${'a'.repeat(50000)}`, 'sk-'.repeat(33000), 'ghp_'.repeat(25000),
    `postgres://${'a'.repeat(100)}:${'b'.repeat(100000)}`, `${'secret_'.repeat(10000)}= x`, 'AAAA'.repeat(25000),
    `token: ${'-'.repeat(100000)}`, `${'Fake0'.repeat(20000)}=`,
  ];
  for (const r of all.rules) {
    const t0 = performance.now();
    for (const s of inputs) { r.re.lastIndex = 0; [...s.matchAll(r.re)]; }
    const ms = performance.now() - t0;
    assert.ok(ms < 2000, `${r.id} took ${Math.round(ms)} ms on the adversarial inputs`);
  }
});

test('allow comments need a rule id and a reason', () => {
  assert.deepEqual(allowComments('x = 1 // complex-md: allow aws-access-key test fixture, revoked'), [{ rule: 'aws-access-key', reason: 'test fixture, revoked' }]);
  assert.deepEqual(allowComments('<!-- complex-md: allow jwt sample token -->'), [{ rule: 'jwt', reason: 'sample token' }]);
  assert.deepEqual(allowComments('# complex-md: allow aws-access-key'), [{ rule: 'aws-access-key', reason: '' }]);
  assert.deepEqual(inlineAllow('aws-access-key', 'k = 1', '// complex-md: allow aws-access-key fixture'), { reason: 'fixture' });
  assert.equal(inlineAllow('aws-access-key', 'k = 1 # complex-md: allow aws-access-key', null), null, 'no reason, no allow');
  assert.equal(inlineAllow('aws-access-key', 'k = 1 # complex-md: allow github-token fixture', null), null, 'another rule');
  assert.equal(inlineAllow('aws-access-key', 'k = 1 # complex-md: allow * fixture', null), null, 'no blanket allow');
});

test('looksRandom: entropy, a mix of character classes, and no prose', () => {
  assert.ok(looksRandom('Q7fk2Lm9xPz4Rt8w'));
  assert.ok(looksRandom('Ab.Cd-Ef_Gh!Ij@Kl', { minEntropy: 3 }), '3 classes without a digit');
  assert.ok(!looksRandom('usage.prompt_tokens'), 'a member chain');
  assert.ok(!looksRandom('aaaaaaaaaaaaaaaa1'));
  assert.ok(!looksRandom('https://example.com/token2024'));
  assert.ok(!looksRandom('web-article-v1-cache'));
  assert.ok(looksRandom('0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d'), 'a UUID');
});
