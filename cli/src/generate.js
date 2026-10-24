// Generate COMPLEX.md: signals from git, front matter written by the tool
// (numbers verbatim, never by a model), prose from one model call or from
// the agent the user is already talking to.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeSignals, graphFor, detectTestCommand, TABLE_HEAD, rowToArray } from './signals.js';
import { templateProse, packageRoots, reachableFrom } from './template.js';
import { loadComplexMd } from './complexmd.js';
import { ignoreWorkDir, gitignoreAction, WORK_DIR } from './gitignore.js';
import { generatePrompt, promptVersion } from './prompts.js';
import { resolveProvider, PROVIDERS } from './providers.js';
import { runVia, viaSelection } from './via.js';
import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../package.json');
const MAX_FILE_CHARS = 60000; // ~15k tokens across all excerpts
const PER_FILE_CHARS = 14000; // so five hotspots fit, not two

const yamlStr = (s) => (/^[\w./@-]+$/.test(s) ? s : JSON.stringify(s));

/* `prose` names the source of the prose when a template wrote it. The bundle
   and a model reply carry no such line, so both stay as they were. */
export function frontMatter(sig, tool, { prose = null } = {}) {
  const p = sig.profile;
  const lines = ['---', `complex_md: "${sig.spec}"`, `generated: ${sig.generated}`, `commit: ${sig.commit}`, `tool: ${tool}`];
  if (prose) lines.push(`prose: ${prose}`);
  lines.push(`window_commits: ${sig.window_commits}`, `files_analyzed: ${sig.files_analyzed}`);
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

/* The output cap for the Anthropic call. A whole trpc map was 12.1 KB,
   about 3.5k tokens, and the prompt asks the model to echo the front
   matter, which is 10 KB on django. Thinking, on by default for current
   models, counts against the same cap. The old 4,000 cut big repositories.
   Current models accept up to 128,000, but only with streaming; 16,000 is
   the cap Anthropic recommends for a request without streaming. */
export const MAX_OUTPUT_TOKENS = 16000;

// One model call has five minutes, enough for a full 16,000 token reply at
// about 60 tokens a second; a hung socket must not hang the run.
const CALL_TIMEOUT_MS = 300000;

// Stop reasons that mean the reply is complete. Anything else (max_tokens,
// refusal, a context window limit) is a reply that must not become a map.
const ANTHROPIC_DONE = new Set([undefined, null, 'end_turn', 'stop_sequence']);
const OPENAI_DONE = new Set([undefined, null, 'stop']);

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
    body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const j = await readJson(res, 'Anthropic');
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${j.error?.message || JSON.stringify(j)}`);
  if (!Array.isArray(j.content)) throw new Error(`Anthropic API ${res.status}: malformed response, no content array (${JSON.stringify(j).slice(0, 200)})`);
  if (!ANTHROPIC_DONE.has(j.stop_reason)) {
    const why = j.stop_reason === 'max_tokens' ? `reply stopped at the ${MAX_OUTPUT_TOKENS} token output cap` : 'reply did not finish';
    throw new Error(`Anthropic API: ${why} (stop_reason ${j.stop_reason}, ${j.usage?.output_tokens ?? '?'} output tokens); COMPLEX.md not written`);
  }
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
  // No max_tokens is sent here (OpenAI rejects it on current models), so
  // the provider's own default caps the reply; finish_reason says if it hit.
  const finish = j.choices[0].finish_reason;
  if (!OPENAI_DONE.has(finish)) {
    const why = finish === 'length' ? "reply stopped at the provider's output limit" : 'reply did not finish';
    throw new Error(`${p.name} API: ${why} (finish_reason ${finish}, ${j.usage?.completion_tokens ?? '?'} output tokens); COMPLEX.md not written`);
  }
  return { text: content, usage: { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens } };
}

/** COMPLEX.md with template prose (template.js): the computed front matter, marked `prose: template`, and prose from the same signals. */
export function templateMap(root, sig, tool) {
  const g = graphFor(root);
  const roots = packageRoots(root, g.kinds);
  const prose = templateProse(sig, { reachable: reachableFrom(roots, g.edges), roots, testCommand: detectTestCommand(root) });
  return frontMatter(sig, tool, { prose: 'template' }) + '\n' + prose;
}

/* Template prose never replaces prose a model or a person wrote: a run with
   no key would otherwise turn a reviewed map into a generic one. A map that
   a template wrote is refreshed, and --template replaces any map. */
function holdsOtherProse(root) {
  if (!existsSync(join(root, 'COMPLEX.md'))) return false;
  return loadComplexMd(root)?.front?.prose !== 'template';
}

/* `approve({ files, fallback, mapText })` sees the file plan before the
   first write and returns false to stop the run. */
export async function generate(root, { model = null, provider = null, agent = false, template = false, via = null, viaTimeoutMs, approve = async () => true, log = () => {} } = {}) {
  const t0 = Date.now();
  const sig = computeSignals(root);
  log(`signals: ${sig.files_analyzed} files in scope, ${sig.profile.dependency_edges} dependency edges, ${sig.commits_analyzed} commits (${sig.fix_commits} fixes), ${sig.hotspots.length} hotspots, ${sig.co_change.length} pairs, confidence ${sig.profile.confidence}, ${Date.now() - t0} ms`);
  for (const b of sig.blind_spots) log(`note: ${b}`);
  const tool = `complex-md/${pkg.version}`;
  const { bundle, frontMatter: fm } = buildBundle(root, sig, tool);

  // The bundle is the fallback for every path that does not end in a
  // written COMPLEX.md: no key, --agent, or a model call that failed.
  const TELL = 'Tell your agent: "Write COMPLEX.md by following .complex-md/prompt.md exactly, then run npx complex-md wire."';
  const saveBundle = () => {
    const dir = join(root, '.complex-md');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'prompt.md'), bundle);
    writeFileSync(join(dir, 'front-matter.yaml'), fm);
    if (ignoreWorkDir(root)) log(`added ${WORK_DIR}/* to .gitignore, so its working files stay out of commits; ${WORK_DIR}/bounds.json stays committable.`);
    return join(dir, 'prompt.md');
  };
  const writeBundle = (why) => {
    const path = saveBundle();
    log(`${why}: wrote .complex-md/prompt.md (${Math.round(bundle.length / 4)} tokens approx).`);
    log(TELL);
    return path;
  };

  const keys = PROVIDERS.filter((p) => p.env).map((p) => p.env).join(', ');
  // --via names an agent CLI on this machine; it replaces the provider call.
  const sel = agent || template ? null : via ? viaSelection(via, model) : resolveProvider({ model, provider });
  const mode = agent ? 'agent' : sel ? 'model' : !template && holdsOtherProse(root) ? 'keep' : 'template';

  /* The file plan, before the first write. `mapText` is the map the wiring
     will read: the template map stands in for a model reply, because the
     wiring depends only on the front matter, which is the same in both. */
  // A file whose content stays the same is not in the plan.
  const entry = (path, content = null) => {
    const p = join(root, path);
    if (!existsSync(p)) return [{ path, action: 'create' }];
    return content !== null && readFileSync(p, 'utf8') === content ? [] : [{ path, action: 'change' }];
  };
  const bundleFiles = [...entry(`${WORK_DIR}/prompt.md`, bundle), ...entry(`${WORK_DIR}/front-matter.yaml`, fm)];
  const ignore = gitignoreAction(root);
  if (ignore) bundleFiles.push({ path: '.gitignore', action: ignore });
  const writesMap = mode === 'model' || mode === 'template';
  const mapText = writesMap ? templateMap(root, sig, tool) : null;
  const files = mode === 'model' ? entry('COMPLEX.md') : [...(writesMap ? entry('COMPLEX.md', mapText) : []), ...bundleFiles];
  if (!(await approve({ files, fallback: mode === 'model' ? bundleFiles : [], mapText }))) {
    log('Nothing written.');
    return { sig, written: false, declined: true };
  }

  if (mode === 'agent') {
    const promptPath = writeBundle('no API key requested');
    log(`Or set a provider key (${keys}) and rerun to make the model call from here.`);
    return { sig, written: false, promptPath };
  }
  if (mode === 'keep') {
    const promptPath = writeBundle('no API key found');
    log('COMPLEX.md exists and a template did not write its prose, so this run keeps it as it is. Pass --template to replace it with template prose.');
    return { sig, written: false, promptPath };
  }
  if (mode === 'template') {
    const out = mapText;
    const promptPath = saveBundle();
    writeFileSync(join(root, 'COMPLEX.md'), out);
    log(`${template ? 'template prose requested' : 'no API key found'}: wrote COMPLEX.md (${out.split('\n').length} lines) with template prose from the computed numbers; ${Date.now() - t0} ms`);
    log(`To replace the template prose, set a provider key (${keys}) and rerun.`);
    log(`Or use the agent you already run. ${TELL}`);
    return { sig, written: true, prose: 'template', promptPath };
  }

  log(`model: ${sel.name}/${sel.model}, prompt ${Math.round(bundle.length / 4)} tokens approx`);
  let out;
  let r;
  try {
    r = sel.via ? await runVia(sel.via, { root, bundle, fm, model, timeoutMs: viaTimeoutMs, log }) : sel.name === 'anthropic' ? await callAnthropic(bundle, sel.model) : await callOpenAICompat(bundle, sel);
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
