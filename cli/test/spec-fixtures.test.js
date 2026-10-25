/* The 0.4 draft conformance fixtures, run against the JSON Schema and the
 * reader in src/complexmd.js.
 *
 * Each folder under spec/0.4/fixtures is a repository root. It holds a
 * COMPLEX.md (or no map at all) and expected.json, which states what the
 * draft says about the file: the document errors, the front matter as the
 * data that a YAML 1.2 parser returns, and the result that a conforming
 * reader gives.
 *
 * Where the reader in src/complexmd.js does not yet give the result the
 * draft requires, the case runs as a todo with the gap named in
 * READER_GAPS. A todo reports its failure and does not fail the suite. When
 * the reader is fixed, the todo passes, and the entry comes out of the list.
 *
 * The schema check uses a small validator for the keywords the schema uses,
 * so the test needs no dependency. It throws on any other keyword, so the
 * schema cannot use a keyword that this test silently skips.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseComplexMd, loadComplexMd } from '../src/complexmd.js';

const SPEC = join(import.meta.dirname, '..', '..', 'spec', '0.4');
const FIXTURES = join(SPEC, 'fixtures');
const SCHEMA = JSON.parse(readFileSync(join(SPEC, 'complex-md.schema.json'), 'utf8'));
const SIZE_CAP = 8192;
const REQUIRED_SECTIONS = ['Where the risk lives', 'Why these files are hot', 'Change coupling', 'What to read first'];
const DIRECTIVE = 'Before editing this file,';

const READER_GAPS = {
  'comma-path': 'the reader splits a flow list at every comma, also inside a double quoted path',
  'empty-test-files': 'the reader reads an empty flow list inside a list item as [""]',
};
/* The gaps above that also change the front matter the reader returns. */
const FRONT_GAPS = new Set(['comma-path', 'empty-test-files']);

/* ---------- a validator for the JSON Schema keywords the schema uses ---------- */

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs']);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function hasType(v, t) {
  if (t === 'integer') return Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
}

function resolveRef(ref) {
  const m = /^#\/\$defs\/([\w]+)$/.exec(ref);
  if (!m || !SCHEMA.$defs[m[1]]) throw new Error(`unsupported $ref ${ref}`);
  return SCHEMA.$defs[m[1]];
}

function validate(schema, v, at = '') {
  if (schema === true) return [];
  if (schema === false) return [`${at || '/'}: no value is allowed here`];
  const errs = [];
  for (const [k, s] of Object.entries(schema)) {
    if (ANNOTATIONS.has(k)) continue;
    switch (k) {
      case '$ref': errs.push(...validate(resolveRef(s), v, at)); break;
      case 'type': if (!hasType(v, s)) errs.push(`${at}: expected ${s}, got ${typeOf(v)}`); break;
      case 'const': if (v !== s) errs.push(`${at}: expected ${JSON.stringify(s)}`); break;
      case 'enum': if (!s.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} is not one of ${s.join(', ')}`); break;
      case 'pattern': if (typeof v === 'string' && !new RegExp(s, 'u').test(v)) errs.push(`${at}: ${JSON.stringify(v)} does not match ${s}`); break;
      case 'minLength': if (typeof v === 'string' && [...v].length < s) errs.push(`${at}: shorter than ${s}`); break;
      case 'minimum': if (typeof v === 'number' && v < s) errs.push(`${at}: below ${s}`); break;
      case 'maximum': if (typeof v === 'number' && v > s) errs.push(`${at}: above ${s}`); break;
      case 'minItems': if (Array.isArray(v) && v.length < s) errs.push(`${at}: fewer than ${s} items`); break;
      case 'maxItems': if (Array.isArray(v) && v.length > s) errs.push(`${at}: more than ${s} items`); break;
      case 'uniqueItems': if (s && Array.isArray(v) && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) errs.push(`${at}: items repeat`); break;
      case 'items': if (Array.isArray(v)) v.forEach((x, i) => errs.push(...validate(s, x, `${at}/${i}`))); break;
      case 'required': if (typeOf(v) === 'object') for (const r of s) if (!(r in v)) errs.push(`${at}: missing ${r}`); break;
      case 'properties': case 'patternProperties': break;
      case 'additionalProperties': break;
      default: throw new Error(`the schema uses ${k}, which this validator does not implement`);
    }
  }
  if (typeOf(v) === 'object') {
    const props = schema.properties || {};
    const patterns = Object.entries(schema.patternProperties || {}).map(([p, s]) => [new RegExp(p, 'u'), s]);
    for (const [key, val] of Object.entries(v)) {
      let matched = false;
      if (key in props) { matched = true; errs.push(...validate(props[key], val, `${at}/${key}`)); }
      for (const [re, s] of patterns) if (re.test(key)) { matched = true; errs.push(...validate(s, val, `${at}/${key}`)); }
      if (!matched && 'additionalProperties' in schema) errs.push(...validate(schema.additionalProperties, val, `${at}/${key}`));
    }
  }
  return errs;
}

/* ---------- the document rules of the draft that the schema cannot see ---------- */

function documentErrors(bytes, data) {
  const errors = [];
  const raw = bytes.toString('utf8');
  if (raw.startsWith('\uFEFF')) errors.push('bom');
  if (bytes.length > SIZE_CAP) errors.push('size');
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(text);
  if (!m) return [...errors, 'no-front-matter'];
  if (!data || !('complex_md' in data)) errors.push('no-version');
  else if (data.complex_md !== '0.4') errors.push('version');
  else if (validate(SCHEMA, data).length) errors.push('schema');
  const lines = m[2].split('\n');
  const found = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trimEnd()).filter((h) => REQUIRED_SECTIONS.includes(h));
  if (found.join('|') !== REQUIRED_SECTIONS.join('|')) errors.push('sections');
  const hot = sectionText(lines, 'Why these files are hot');
  if (hot !== null && paragraphsOf(hot).some((p) => !p.includes(DIRECTIVE))) errors.push('directive');
  return errors.sort();
}

function sectionText(lines, heading) {
  const i = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).trimEnd() === heading);
  if (i < 0) return null;
  const rest = lines.slice(i + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

function paragraphsOf(text) {
  return text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

/* expected is contained in actual: every key of an expected object is in
   the actual object with a contained value, and arrays match item by item. */
function assertContained(actual, expected, at = 'front') {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${at}: expected a list, got ${JSON.stringify(actual)}`);
    assert.equal(actual.length, expected.length, `${at}: list length`);
    expected.forEach((x, i) => assertContained(actual[i], x, `${at}[${i}]`));
  } else if (typeOf(expected) === 'object') {
    assert.equal(typeOf(actual), 'object', `${at}: expected a map, got ${JSON.stringify(actual)}`);
    for (const [k, v] of Object.entries(expected)) assertContained(actual[k], v, `${at}.${k}`);
  } else {
    assert.strictEqual(actual, expected, at);
  }
}

/* ---------- the fixtures ---------- */

const names = existsSync(FIXTURES) ? readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];

test('the 0.4 fixtures exist, and each folder has expected.json', () => {
  assert.ok(names.length >= 20, `found ${names.length} fixture folders under ${FIXTURES}`);
  for (const n of names) assert.ok(existsSync(join(FIXTURES, n, 'expected.json')), `${n}/expected.json`);
});

test('the fixtures cover every document error code and every reader result', () => {
  const codes = new Set();
  const results = new Set();
  for (const n of names) {
    const e = JSON.parse(readFileSync(join(FIXTURES, n, 'expected.json'), 'utf8'));
    for (const c of e.document?.errors || []) codes.add(c);
    if (e.document?.valid) codes.add('valid');
    results.add(e.reader.result);
  }
  assert.deepEqual([...codes].sort(), ['bom', 'directive', 'no-front-matter', 'no-version', 'schema', 'sections', 'size', 'valid', 'version']);
  assert.deepEqual([...results].sort(), ['absent', 'invalid', 'map']);
});

for (const name of names) {
  const dir = join(FIXTURES, name);
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
  const file = join(dir, 'COMPLEX.md');
  const present = readdirSync(dir).includes('COMPLEX.md');

  if (expected.document) {
    test(`fixture ${name}: the schema and the document rules give the expected errors`, () => {
      assert.ok(present, 'a fixture with document expectations holds a COMPLEX.md');
      const errors = documentErrors(readFileSync(file), expected.data);
      assert.deepEqual(errors, [...expected.document.errors].sort());
      assert.equal(expected.document.valid, errors.length === 0, 'valid agrees with the error list');
    });
  }

  const gap = READER_GAPS[name];
  test(`fixture ${name}: the reader gives the expected result`, gap ? { todo: gap } : {}, (t) => {
    const r = expected.reader;
    if (r.result === 'absent') {
      if (!present && existsSync(file)) {
        t.skip('this file system ignores case, so the lower case file is found');
        return;
      }
      assert.equal(loadComplexMd(dir), null);
      return;
    }
    const map = parseComplexMd(readFileSync(file, 'utf8'));
    assert.equal(map ? 'map' : 'invalid', r.result);
    if (!map) return;
    if (r.front) assertContained(map.front, r.front);
    if (r.sections) for (const h of REQUIRED_SECTIONS) assert.equal(h in map.sections, r.sections.includes(h), `section "${h}"`);
    for (const [p, has] of Object.entries(r.rows || {})) assert.equal(map.row(p) !== null, has, `row(${JSON.stringify(p)})`);
    for (const [p, d] of Object.entries(r.directives || {})) assert.equal(map.directive(p), d, `directive(${JSON.stringify(p)})`);
  });

  /* The schema check above runs on the data in expected.json, not on the
     file. This test ties the 2 together: the reader's front matter must
     equal that data, without x- keys and with null lists read as []
     (section 10.3). A fixture whose COMPLEX.md and data drift apart fails
     here. */
  if (expected.data && expected.reader.result === 'map') {
    test(`fixture ${name}: the reader's front matter equals the fixture data`, FRONT_GAPS.has(name) ? { todo: gap } : {}, () => {
      const map = parseComplexMd(readFileSync(file, 'utf8'));
      assert.ok(map, 'the reader returns a map');
      assert.deepStrictEqual(map.front, asRead(expected.data));
    });
  }
}

/* The data as a conforming reader returns it: x- keys left out at every
   level, and a top level list key with a null value read as []. */
function asRead(data) {
  const strip = (v) => (Array.isArray(v) ? v.map(strip)
    : typeOf(v) === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('x-')).map(([k, x]) => [k, strip(x)]))
    : v);
  const out = strip(data);
  if (out.complex_md === '0.3' && !('generator' in out) && typeof out.tool === 'string') {
    const slash = out.tool.indexOf('/');
    out.generator = slash < 0
      ? { name: out.tool }
      : { name: out.tool.slice(0, slash), version: out.tool.slice(slash + 1) };
    delete out.tool;
  }
  for (const k of ['hotspots', 'load_bearing', 'co_change', 'seams', 'blind_spots', 'workspaces']) if (k in out && out[k] === null) out[k] = [];
  return out;
}

/* ---------- the spec text and the schema agree ---------- */

test('the top level key table in spec.md and the schema name the same keys', () => {
  const spec = readFileSync(join(SPEC, 'spec.md'), 'utf8');
  const table = spec.split('### 7.1 Top level keys')[1].split('\nRules:')[0];
  const rows = [...table.matchAll(/^\| `(\w+)` \| [^|]+ \| (yes|no) \|/gm)].map((m) => [m[1], m[2] === 'yes']);
  assert.deepEqual(rows.map(([k]) => k).sort(), Object.keys(SCHEMA.properties).sort());
  assert.deepEqual(rows.filter(([, req]) => req).map(([k]) => k).sort(), [...SCHEMA.required].sort());
});

test('the hotspot row table in spec.md and the schema name the same keys', () => {
  const spec = readFileSync(join(SPEC, 'spec.md'), 'utf8');
  const table = spec.split('### 7.4 `hotspots` rows')[1].split('### 7.5')[0];
  const rows = [...table.matchAll(/^\| `(\w+)` \| [^|]+ \| (yes|no) \|/gm)].map((m) => [m[1], m[2] === 'yes']);
  const hot = SCHEMA.$defs.hotspot;
  assert.deepEqual(rows.map(([k]) => k).sort(), Object.keys(hot.properties).sort());
  assert.deepEqual(rows.filter(([, req]) => req).map(([k]) => k).sort(), [...hot.required].sort());
});
