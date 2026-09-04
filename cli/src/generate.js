// Generate COMPLEX.md: signals from git, front matter written by the tool
// (numbers verbatim, never by a model), prose from one model call or from
// the agent the user is already talking to.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeSignals, TABLE_HEAD, rowToArray } from './signals.js';
import { generatePrompt, promptVersion } from './prompts.js';
import { resolveProvider, PROVIDERS } from './providers.js';
import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../package.json');
const MAX_FILE_CHARS = 60000; // ~15k tokens across all excerpts
const PER_FILE_CHARS = 14000; // so five hotspots fit, not two

const yamlStr = (s) => (/^[\w./@-]+$/.test(s) ? s : JSON.stringify(s));

export function frontMatter(sig, tool) {
  const p = sig.profile;
  const lines = ['---', `complex_md: "${sig.spec}"`, `generated: ${sig.generated}`, `commit: ${sig.commit}`, `tool: ${tool}`, `window_commits: ${sig.window_commits}`, `files_analyzed: ${sig.files_analyzed}`];
  lines.push('profile:');
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined) lines.push(`  ${k}: ${typeof v === 'string' ? yamlStr(v) : v}`);
  lines.push('hotspots:');
  for (const h of sig.hotspots) {
    lines.push(`  - path: ${h.path}`, `    kind: ${h.kind}`, `    loc: ${h.loc}`, `    churn: ${h.churn}`, `    churn_w: ${h.churn_w.toFixed(2)}`, `    fixes: ${h.fixes}`, `    authors: ${h.authors}`, `    owner_share: ${h.owner_share.toFixed(2)}`, `    fan_in: ${h.fan_in}`, `    tests: ${h.tests}`, `    score: ${h.score}`);
  }
  lines.push('load_bearing:');
  for (const h of sig.load_bearing || []) lines.push(`  - path: ${h.path}`, `    kind: ${h.kind}`, `    loc: ${h.loc}`, `    fan_in: ${h.fan_in}`, `    tests: ${h.tests}`);
  lines.push('co_change:');
  for (const c of sig.co_change) lines.push(`  - files: [${c.files[0]}, ${c.files[1]}]`, `    count: ${c.count}`, `    coupling: ${c.coupling}`);
  lines.push('seams:');
  for (const s of sig.seams || []) lines.push(`  - dirs: [${s.dirs[0]}, ${s.dirs[1]}]`, `    count: ${s.count}`, `    coupling: ${s.coupling}`);
  lines.push('blind_spots:');
  for (const b of sig.blind_spots) lines.push(`  - ${yamlStr(b)}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function excerpt(root, path) {
  let text;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
  if (text.length <= PER_FILE_CHARS) return text;
  const lines = text.split('\n');
  let head = '';
  let i = 0;
  while (i < lines.length && head.length + lines[i].length + 1 <= PER_FILE_CHARS * 0.8) head += lines[i++] + '\n';
  const symbols = lines
    .slice(i)
    .filter((l) => /^\s*(export|module\.exports|def |class |func |pub fn|public |function |const \w+ = (async )?\(|[A-Za-z_]\w*\s*\([^)]*\)\s*\{$)/.test(l))
    .slice(0, 80)
    .join('\n');
  return `${head}\n[... ${lines.length - i} more lines; symbols defined below this point follow ...]\n${symbols}`;
}

export function buildBundle(root, sig, tool) {
  const fm = frontMatter(sig, tool);
  const p = sig.profile;
  const parts = [generatePrompt().trim(), '', '---', '', '# Inputs for this repository', '', '## Front matter (computed; copy verbatim, do not alter a number)', '', '```yaml', fm.trim(), '```', '', '## Signals table (all rows, sorted by score)', '', TABLE_HEAD.join('\t')];
  for (const r of sig.table) parts.push(rowToArray(r).join('\t'));
  if (sig.load_bearing?.length) {
    parts.push('', '## Load-bearing files (untouched in the window, many dependents)', '');
    for (const h of sig.load_bearing) parts.push(`- ${h.path} (${h.kind}, ${h.loc} lines): ${h.fan_in} dependents, ${h.tests} covering tests${(sig.importers[h.path] || []).length ? `; e.g. ${(sig.importers[h.path] || []).slice(0, 4).join(', ')}` : ''}`);
  }
  parts.push('', '## Co-change pairs', '');
  for (const c of sig.co_change) parts.push(`- ${c.files[0]} + ${c.files[1]}: ${c.count} shared commits, coupling ${c.coupling}% (of the quieter file's commits, this share also touched the other)`);
  if (sig.seams?.length) {
    parts.push('', '## Directory seams (areas that move together)', '');
    for (const s of sig.seams) parts.push(`- ${s.dirs[0]} + ${s.dirs[1]}: ${s.count} shared commits, coupling ${s.coupling}%`);
  }
  parts.push('', '## Repository profile', '', `- commit: ${sig.commit}`, `- date: ${sig.generated}`, `- files: ${p.files_total} tracked, ${p.files_in_scope} rankable (${p.loc_in_scope} lines); kinds: ${p.kinds}`, `- languages by file count: ${p.languages}`, `- dependency edges found: ${p.dependency_edges}`, `- history: ${p.commits_total} non-merge commits total; ${sig.window_commits} analyzed (${p.window_from} to ${p.window_to}, ${p.velocity_30d} commits per 30 days); ${p.commits_skipped} commits skipped as bulk or touching only deleted files; ${sig.fix_commits} labeled fixes; half-life ${p.half_life_commits} commits`, `- committer identities: ${p.authors_total}`, `- concentration: ${p.concentration_50} files hold half the total score`, `- confidence: ${p.confidence}`);
  if (sig.conventions.length) parts.push(`- convention files (in over a quarter of commits, excluded from co-change): ${sig.conventions.join(', ')}`);
  if (sig.blind_spots.length) parts.push('', 'Blind spots (state these in the prose where relevant):', ...sig.blind_spots.map((b) => `- ${b}`));
  parts.push('', '## Hotspot files', '');
  let budget = MAX_FILE_CHARS;
  let n = 0;
  for (const h of sig.hotspots) {
    if (n >= 10 || budget <= 0) break;
    const ex = excerpt(root, h.path);
    if (ex === null) continue;
    const cut = ex.length > budget ? ex.slice(0, budget) + '\n[... truncated ...]' : ex;
    const tests = sig.tests[h.path] || [];
    const imps = sig.importers[h.path] || [];
    parts.push(`### ${h.path}`, '', `Kind: ${h.kind}. Covering tests: ${tests.length ? tests.slice(0, 8).join(', ') : 'none found'}.`, `Depended on by ${h.fan_in} file${h.fan_in === 1 ? '' : 's'}${imps.length ? `: ${imps.slice(0, 8).join(', ')}${imps.length > 8 ? `, and ${imps.length - 8} more` : ''}` : ''}.`, '', '```', cut, '```', '');
    budget -= cut.length;
    n++;
    if (n >= 5 && budget < MAX_FILE_CHARS * 0.3) break;
  }
  return { bundle: parts.join('\n'), frontMatter: fm };
}

// The four prose sections the spec requires, in order. A model reply that
// lacks one is an apology, a refusal or a truncation, never a map.
export const REQUIRED_SECTIONS = ['## Where the risk lives', '## Why these files are hot', '## Change coupling', '## What to read first'];

/** The required section headings missing from `prose`, as an array (empty when the prose is complete). */
export function validateOutput(prose) {
  const lines = new Set(String(prose).split('\n').map((l) => l.trim()));
  return REQUIRED_SECTIONS.filter((h) => !lines.has(h));
}

/**
 * Replace whatever front matter the model produced with the computed one,
 * strip an outer fence, and refuse anything that is not a complete map.
 * Throws rather than returning junk: the caller must never overwrite a
 * good COMPLEX.md with an apology or a truncated reply.
 */
export function normalizeOutput(text, fm) {
  let t = String(text || '').trim();
  const fence = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/.exec(t);
  if (fence) t = fence[1].trim();
  const m = /^---\n[\s\S]*?\n---\n?/.exec(t);
  const prose = (m ? t.slice(m[0].length) : t).trim();
  if (!prose) throw new Error('model returned no prose; COMPLEX.md not written');
  const missing = validateOutput(prose);
  if (missing.length) throw new Error(`model output is missing required section${missing.length > 1 ? 's' : ''} ${missing.map((h) => `"${h}"`).join(', ')}; COMPLEX.md not written`);
  return fm + '\n' + prose + '\n';
}

// One model call has two minutes; a hung socket must not hang the run.
const CALL_TIMEOUT_MS = 120000;

async function readJson(res, label) {
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${label} API ${res.status}: response body is not JSON (${e.message})`);
  }
}

async function callAnthropic(prompt, model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const j = await readJson(res, 'Anthropic');
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${j.error?.message || JSON.stringify(j)}`);
  if (!Array.isArray(j.content)) throw new Error(`Anthropic API ${res.status}: malformed response, no content array (${JSON.stringify(j).slice(0, 200)})`);
  return { text: j.content.map((c) => c.text || '').join(''), usage: { input: j.usage?.input_tokens, output: j.usage?.output_tokens } };
}

// Every non-Anthropic provider speaks this shape; only base URL, key and
// extra headers differ (see providers.js).
async function callOpenAICompat(prompt, p) {
  const headers = { 'content-type': 'application/json', ...p.headers };
  if (p.key) headers.authorization = `Bearer ${p.key}`;
  const res = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const j = await readJson(res, p.name);
  if (!res.ok) throw new Error(`${p.name} API ${res.status}: ${j.error?.message || JSON.stringify(j)}`);
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`${p.name} API ${res.status}: malformed response, no choices[0].message.content (${JSON.stringify(j).slice(0, 200)})`);
  return { text: content, usage: { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens } };
}

export async function generate(root, { model = null, provider = null, agent = false, log = () => {} } = {}) {
  const t0 = Date.now();
  const sig = computeSignals(root);
  log(`signals: ${sig.files_analyzed} files in scope, ${sig.profile.dependency_edges} dependency edges, ${sig.commits_analyzed} commits (${sig.fix_commits} fixes), ${sig.hotspots.length} hotspots, ${sig.co_change.length} pairs, confidence ${sig.profile.confidence}, ${Date.now() - t0} ms`);
  for (const b of sig.blind_spots) log(`note: ${b}`);
  const tool = `complex-md/${pkg.version}`;
  const { bundle, frontMatter: fm } = buildBundle(root, sig, tool);

  // The bundle is the fallback for every path that does not end in a
  // written COMPLEX.md: no key, --agent, or a model call that failed.
  const writeBundle = (why) => {
    const dir = join(root, '.complex-md');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'prompt.md'), bundle);
    writeFileSync(join(dir, 'front-matter.yaml'), fm);
    log(`${why}: wrote .complex-md/prompt.md (${Math.round(bundle.length / 4)} tokens approx).`);
    log('Tell your agent: "Write COMPLEX.md by following .complex-md/prompt.md exactly, then run npx complex-md wire."');
    return join(dir, 'prompt.md');
  };

  const sel = agent ? null : resolveProvider({ model, provider });
  if (!sel) {
    const promptPath = writeBundle(`no API key${agent ? ' requested' : ' found'}`);
    log(`Or set a provider key (${PROVIDERS.filter((p) => p.env).map((p) => p.env).join(', ')}) and rerun to make the model call from here.`);
    return { sig, written: false, promptPath };
  }

  log(`model: ${sel.name}/${sel.model}, prompt ${Math.round(bundle.length / 4)} tokens approx`);
  let out;
  let r;
  try {
    r = sel.name === 'anthropic' ? await callAnthropic(bundle, sel.model) : await callOpenAICompat(bundle, sel);
    out = normalizeOutput(r.text, fm);
  } catch (e) {
    // Network error, non-2xx, malformed body, or prose that is not a map:
    // the existing COMPLEX.md stays as it is and the bundle goes to the agent.
    const reason = e?.name === 'TimeoutError' ? `model call timed out after ${CALL_TIMEOUT_MS / 1000} s` : String(e?.message || e);
    log(`model call failed: ${reason}`);
    const promptPath = writeBundle('falling back to the prompt bundle');
    return { sig, written: false, fallback: reason, promptPath };
  }
  writeFileSync(join(root, 'COMPLEX.md'), out);
  log(`wrote COMPLEX.md (${out.split('\n').length} lines); tokens in ${r.usage.input ?? '?'} out ${r.usage.output ?? '?'}; prompt ${promptVersion()}; ${Date.now() - t0} ms`);
  return { sig, written: true, usage: r.usage };
}
