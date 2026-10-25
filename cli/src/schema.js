/* A validator for the JSON Schema keywords that spec/0.4/complex-md.schema.json
 * uses, so the CLI needs no dependency. It throws on any other keyword, so
 * the schema cannot use a keyword that this validator silently skips.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* The packaged copy sits in cli/schema; a checkout also has the spec folder. */
export function loadSchema() {
  const packaged = join(here, '..', 'schema', 'complex-md.schema.json');
  const p = existsSync(packaged) ? packaged : join(here, '..', '..', 'spec', '0.4', 'complex-md.schema.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs']);

export function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function hasType(v, t) {
  if (t === 'integer') return Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
}

/* Returns a list of messages, each "<json pointer>: <problem>". `root` is the
   schema that $ref pointers resolve against. */
export function validate(root, v, schema = root, at = '') {
  const resolveRef = (ref) => {
    const m = /^#\/\$defs\/([\w]+)$/.exec(ref);
    if (!m || !root.$defs?.[m[1]]) throw new Error(`unsupported $ref ${ref}`);
    return root.$defs[m[1]];
  };
  if (schema === true) return [];
  if (schema === false) return [`${at || '/'}: no value is allowed here`];
  const errs = [];
  for (const [k, s] of Object.entries(schema)) {
    if (ANNOTATIONS.has(k)) continue;
    switch (k) {
      case '$ref': errs.push(...validate(root, v, resolveRef(s), at)); break;
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
      case 'items': if (Array.isArray(v)) v.forEach((x, i) => errs.push(...validate(root, x, s, `${at}/${i}`))); break;
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
      if (key in props) { matched = true; errs.push(...validate(root, val, props[key], `${at}/${key}`)); }
      for (const [re, s] of patterns) if (re.test(key)) { matched = true; errs.push(...validate(root, val, s, `${at}/${key}`)); }
      if (!matched && 'additionalProperties' in schema) errs.push(...validate(root, val, schema.additionalProperties, `${at}/${key}`));
    }
  }
  return errs;
}
