// The skill ships to several agent tools from one template. These tests check
// each package against the format its tool documents, offline. They run only
// inside the repository checkout; the published CLI package has none of these
// files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inCheckout = existsSync(join(ROOT, 'skill/SKILL.tmpl.md'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Minimal YAML front matter reader: flat `key: value` lines, which is all the
// skill uses. Quotes around a value are removed.
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

// Agent Skills specification (agentskills.io/specification): name is 1 to 64
// lowercase letters, digits and single hyphens and matches its directory;
// description is 1 to 1024 characters.
const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const SKILL_COPIES = ['skills/complex-md/SKILL.md', 'plugins/complex-md/skills/complex-md/SKILL.md'];

test('every shipped SKILL.md is the rendered template, byte for byte', async (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const { renderSkill } = await import(join(ROOT, 'scripts/skill.mjs'));
  const rendered = renderSkill();
  assert.ok(!rendered.includes('{{'), 'the rendered skill still has a placeholder');
  for (const p of SKILL_COPIES) {
    assert.ok(existsSync(join(ROOT, p)), `${p} is missing; run npm run build`);
    assert.equal(read(p), rendered, `${p} is out of step with skill/SKILL.tmpl.md; run npm run build`);
  }
});

test('every shipped SKILL.md meets the Agent Skills specification', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  for (const p of SKILL_COPIES) {
    const fm = frontMatter(read(p));
    assert.ok(fm, `${p} has no front matter`);
    assert.match(fm.name, SKILL_NAME, `${p} name`);
    assert.equal(fm.name, p.split('/').at(-2), `${p} name must match its directory`);
    assert.ok(fm.description.length >= 1 && fm.description.length <= 1024, `${p} description is ${fm.description.length} characters`);
  }
});

// ------------------------------------------------------------ Claude Code
// Plugin manifest reference: code.claude.com/docs/en/plugins-reference.
// Marketplace reference: code.claude.com/docs/en/plugins/marketplace-reference.
const readJson = (p) => JSON.parse(read(p));
const CLI_VERSION = () => readJson('cli/package.json').version;
const PLUGIN_ROOT = 'plugins/complex-md';
const CLAUDE_PLUGIN_KEYS = new Set(['$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'metadata', 'icon', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl', 'termsOfServiceUrl', 'defaultEnabled', 'dependencies', 'settings', 'userConfig', 'types', 'channels', 'skills', 'commands', 'agents', 'hooks', 'mcpServers', 'lspServers', 'outputStyles', 'workflows', 'experimental']);
const MARKET_KEYS = new Set(['$schema', 'name', 'owner', 'plugins', 'description', 'version', 'metadata', 'forceRemoveDeletedPlugins', 'allowCrossMarketplaceDependenciesOn', 'renames']);
const ENTRY_KEYS = new Set(['name', 'source', 'description', 'version', 'category', 'tags', 'strict', 'relevance', 'dependencies', 'defaultEnabled', 'displayName', 'metadata', 'author', 'homepage', 'repository', 'license', 'keywords']);
const ID_PART = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertNotReserved(name) {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  assert.ok(!/^(claude|anthropic|anthropics|cc-plugin)-/.test(n), `${name} starts with a reserved prefix`);
  assert.ok(!/(^|-)(claude|anthropic|anthropics)(-|$)/.test(n), `${name} reads as one of Anthropic's own`);
}

test('the Claude Code plugin manifest uses documented fields and ships no hooks', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const m = readJson(`${PLUGIN_ROOT}/.claude-plugin/plugin.json`);
  for (const k of Object.keys(m)) assert.ok(CLAUDE_PLUGIN_KEYS.has(k), `unknown plugin.json field ${k}`);
  assert.match(m.name, KEBAB);
  assertNotReserved(m.name);
  assert.equal(m.version, CLI_VERSION(), 'plugin version follows cli/package.json; run npm run build');
  assert.ok(m.description && m.author?.name, 'description and author.name are set');
  assert.doesNotThrow(() => new URL(m.homepage), 'homepage must parse as a URL');
  // No component may run code in the user's session: no hooks, no MCP
  // server, no executables on PATH. CLAUDE.md at a plugin root is never loaded.
  for (const k of ['hooks', 'mcpServers', 'lspServers', 'commands', 'agents', 'channels', 'userConfig']) assert.ok(!(k in m), `plugin.json declares ${k}`);
  for (const f of ['hooks', '.mcp.json', 'mcp.json', '.lsp.json', 'bin', 'monitors', 'CLAUDE.md', 'settings.json']) assert.ok(!existsSync(join(ROOT, PLUGIN_ROOT, f)), `${PLUGIN_ROOT}/${f} must not exist`);
  assert.ok(existsSync(join(ROOT, PLUGIN_ROOT, 'skills/complex-md/SKILL.md')));
});

test('the repository marketplace lists the plugin by a relative path', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const mk = readJson('.claude-plugin/marketplace.json');
  for (const k of Object.keys(mk)) assert.ok(MARKET_KEYS.has(k), `unknown marketplace field ${k}`);
  assert.match(mk.name, ID_PART);
  assertNotReserved(mk.name);
  assert.ok(mk.owner?.name, 'owner.name is required');
  assert.ok(mk.description, 'a missing description is a validate warning');
  assert.ok(Array.isArray(mk.plugins) && mk.plugins.length > 0);
  const names = new Set();
  for (const e of mk.plugins) {
    for (const k of Object.keys(e)) assert.ok(ENTRY_KEYS.has(k), `unknown entry field ${k}`);
    assert.match(e.name, ID_PART);
    assert.ok(!names.has(e.name), `duplicate entry ${e.name}`);
    names.add(e.name);
    assert.equal(typeof e.source, 'string');
    assert.ok(e.source.startsWith('./') && !e.source.includes('..'), `source ${e.source}`);
    const manifest = join(e.source, '.claude-plugin/plugin.json');
    assert.ok(existsSync(join(ROOT, manifest)), `${manifest} is missing`);
    assert.equal(readJson(manifest).name, e.name, 'entry name and manifest name must match');
    assert.ok(!('version' in e), 'plugin.json carries the version; an entry version only warns');
  }
});

// ---------------------------------------------- Agent Plugins 1.0.0 (Codex)
// The portable manifest at the plugin root, read by Codex and other clients
// of the Agent Plugins format. Rules from
// https://agent-plugins.org/schemas/1.0.0/plugin.schema.json.
const AP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const AP_KEYS = new Set(['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']);
const AP_NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

test('the portable plugin.json meets the Agent Plugins 1.0.0 schema', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const m = readJson(`${PLUGIN_ROOT}/plugin.json`);
  assert.equal(m.$schema, AP_SCHEMA);
  for (const k of Object.keys(m)) assert.ok(AP_KEYS.has(k), `field ${k} is not in the schema`);
  assert.ok(m.name.length <= 64);
  assert.match(m.name, AP_NAME);
  assert.equal(m.name, readJson(`${PLUGIN_ROOT}/.claude-plugin/plugin.json`).name, 'one name in both manifests');
  assert.equal(m.version, CLI_VERSION(), 'plugin version follows cli/package.json; run npm run build');
  for (const k of ['description', 'homepage', 'repository', 'license']) assert.equal(typeof m[k], 'string', k);
  for (const k of Object.keys(m.author ?? {})) assert.ok(['name', 'email', 'url'].includes(k), `author.${k}`);
  assert.ok(Array.isArray(m.keywords) && m.keywords.every((k) => typeof k === 'string'));
  for (const [ns, v] of Object.entries(m.extensions ?? {})) {
    assert.match(ns, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, `extension namespace ${ns}`);
    assert.equal(typeof v, 'object');
  }
  // Codex reads hooks from extensions["com.openai"].hooks; none may ship.
  assert.ok(!('hooks' in (m.extensions?.['com.openai'] ?? {})), 'no hooks for Codex either');
});

// ------------------------------------------------------------- Gemini CLI
// Extension reference: geminicli.com/docs/extensions/reference. The gallery
// requires gemini-extension.json at the repository root, so the extension
// root is the repository root and it loads skills/ from there.
const GEMINI_KEYS = new Set(['name', 'version', 'description', 'migratedTo', 'mcpServers', 'contextFileName', 'excludeTools', 'plan', 'settings', 'themes']);

test('the Gemini CLI extension manifest uses documented fields and a small context file', (t) => {
  if (!inCheckout) return t.skip('not a repository checkout');
  const m = readJson('gemini-extension.json');
  for (const k of Object.keys(m)) assert.ok(GEMINI_KEYS.has(k), `unknown gemini-extension.json field ${k}`);
  assert.match(m.name, KEBAB, 'lowercase letters, digits and dashes');
  assert.equal(m.version, CLI_VERSION(), 'extension version follows cli/package.json; run npm run build');
  assert.equal(typeof m.description, 'string');
  assert.ok(!('mcpServers' in m), 'the extension starts no MCP server');
  assert.equal(typeof m.contextFileName, 'string');
  assert.ok(existsSync(join(ROOT, m.contextFileName)), `${m.contextFileName} is missing`);
  // Everything the extension loader picks up from the root besides the
  // manifest: the context file and skills/. Nothing else may exist there.
  for (const d of ['hooks', 'commands', 'agents', 'policies', 'GEMINI.md']) assert.ok(!existsSync(join(ROOT, d)), `${d} at the repository root would load into the extension`);
  assert.ok(existsSync(join(ROOT, 'skills/complex-md/SKILL.md')));
});
