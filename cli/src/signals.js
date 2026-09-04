// Spec 0.3 signals: two axes, computed locally.
//   Structure, from the working tree: what each file is and who depends on
//   it (graph.js). Works on a repository with one commit.
//   History, from git, indexed by commit rather than by the calendar: the
//   most recent N non-merge commits, weights decaying per commit, so a
//   repository built in six weeks and one built over six years are read the
//   same way. Time is reported as a fact (window dates, velocity), never
//   used as a threshold.
// The CLI is the reference implementation; the skill's shell path is the
// degraded twin and says so in `tool`.
import { readFileSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { git, trackedFiles, shortSha } from './git.js';
import { buildGraph, submodulePaths, RANKED_KINDS, TEST_FILE_RE, BINARY_RE } from './graph.js';

export const SPEC_VERSION = '0.3';
export { TEST_FILE_RE, BINARY_RE };

// Kept for the benchmark dataset builder and anyone on the 0.2 shape.
export const EXCLUDE_RE =
  /(^|\/)(docs?|tests?|__tests__|specs?|examples?|benchmarks?|fixtures?|vendor|node_modules|dist|build|\.github)\/|\.(md|mdx|rst|txt|lock|snap)$|\.(test|spec|tst)\.[a-z]+$|_test\.[a-z]+$|(^|\/)(package|package-lock|composer)\.json$|(^|\/)(Cargo\.toml|go\.mod|go\.sum|pyproject\.toml|yarn\.lock|pnpm-lock\.yaml)$/;
// Fix-labeled commits. Issue refs (#123) are deliberately not matched: on a
// squash-merged repo they label every commit a fix (311 of 338 on fastify).
export const FIX_RE = /(^|[^a-z])(fix(es|ed|ing)?|bug|bugfix|hotfix|regression)([^a-z]|$)/i;
const FIX_GREP = '(^|[^a-z])(fix(es|ed|ing)?|bug|bugfix|hotfix|regression)([^a-z]|$)';
// Kinds that take part in co-change. Docs stay: a module that always moves
// with its reference page is real coupling. Tests, generated, vendored,
// assets and data explain themselves.
const PAIR_KINDS = new Set(['source', 'config', 'markup', 'style', 'docs']);
const CHANGELOG_RE = /(^|\/)(CHANGELOG|CHANGES|HISTORY|NEWS|RELEASES?)(\.[a-z]+)?$/i;
// Extensions whose dependencies graph.js actually resolves. Anything else
// that ranks as source gets a blind spot, not a silent fan_in of zero.
const RESOLVED_EXT = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro', 'py', 'pyi', 'rb', 'php', 'sh', 'bash', 'zsh', 'go', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'caddy']);

export const DEFAULTS = {
  windowCommitsMax: 2000,
  bulkCommitFiles: 30,
  minCommits: 3,
  fanInFloor: 5, // a quiet file this many files depend on is still a candidate
  minCoupling: 34, // the quieter side moves with the other at least a third of the time
  conventionShare: 0.25, // in more than a quarter of commits: a ritual, not a coupling
  tableRows: 30,
  hotspotRows: 15,
  hotspotFloor: 5,
  hotspotCut: 0.1, // rows scoring under a tenth of the top row are noise on that repo
  hotspotShare: 0.2, // and never more than a fifth of the rankable files
  pairRows: 10,
  seamRows: 6,
  loadBearingRows: 5,
  thinHistory: 50, // fewer analyzed commits than this: structure carries the ranking
};

/** The most recent N non-merge commits, oldest last, with fix labels matched like `git log --grep`. */
function readCommits(cwd, n) {
  const out = git(['log', `-n${n}`, '--no-merges', '--name-only', '--date=unix', '--pretty=format:@%ct\t%ae\t%H'], { cwd });
  const commits = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) {
      const [ts, author, hash] = line.slice(1).split('\t');
      cur = { ts: Number(ts), author, hash, isFix: false, files: [] };
      commits.push(cur);
    } else if (line && cur) {
      cur.files.push(line);
    }
  }
  if (!commits.length) return commits;
  const oldest = commits[commits.length - 1].hash;
  const range = git(['rev-parse', '--verify', '-q', `${oldest}^`], { cwd, allowFail: true }).trim() ? `${oldest}^..HEAD` : 'HEAD';
  const fixSet = new Set(git(['log', range, '--no-merges', '-i', '-E', `--grep=${FIX_GREP}`, '--pretty=format:%H'], { cwd }).split('\n').filter(Boolean));
  for (const c of commits) c.isFix = fixSet.has(c.hash);
  return commits;
}

const graphCache = new Map();
function graphFor(cwd) {
  let g = graphCache.get(cwd);
  if (!g) graphCache.set(cwd, (g = buildGraph(cwd, trackedFiles(cwd))));
  return g;
}

export function computeSignals(cwd, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const tracked = trackedFiles(cwd);
  const graph = buildGraph(cwd, tracked);
  graphCache.set(cwd, graph);
  const { kinds, loc, fanIn, tests: testEdges, edges } = graph;

  // 1. History window, by commit count.
  const commitsTotal = Number(git(['rev-list', '--count', '--no-merges', 'HEAD'], { cwd }).trim()) || 0;
  const n = Math.min(commitsTotal, o.windowCommitsMax);
  const commits = n ? readCommits(cwd, n) : [];
  const halfLife = Math.max(50, Math.round(commits.length / 4));
  const churn = new Map(); // path -> { c, cw, fixes, fw, authors: Map, last }
  const pairs = new Map();
  const perFile = new Map(); // path -> commits touching it (non-bulk), for coupling
  let fixCommits = 0;
  let counted = 0;
  const allAuthors = new Set();
  commits.forEach((cm, i) => {
    allAuthors.add(cm.author);
    const files = cm.files.filter((f) => kinds.has(f)); // deleted files leave no row
    if (files.length === 0 || files.length > o.bulkCommitFiles) return;
    counted++;
    if (cm.isFix) fixCommits++;
    const w = Math.pow(0.5, i / halfLife);
    for (const f of files) {
      let r = churn.get(f);
      if (!r) churn.set(f, (r = { c: 0, cw: 0, fixes: 0, fw: 0, authors: new Map(), last: i }));
      r.c++;
      r.cw += w;
      r.authors.set(cm.author, (r.authors.get(cm.author) || 0) + 1);
      if (cm.isFix) { r.fixes++; r.fw += w; }
      perFile.set(f, (perFile.get(f) || 0) + 1);
    }
  });
  // Convention files: in more than a quarter of counted commits. They pair
  // with everything, which is a ritual (changelog per change), not coupling.
  const conventions = [];
  for (const [f, c] of perFile) if (counted >= 20 && c / counted > o.conventionShare) conventions.push(f);
  const conventionSet = new Set(conventions);
  const dirPairs = new Map();
  const perDir = new Map();
  commits.forEach((cm) => {
    const files = cm.files.filter((f) => kinds.has(f) && PAIR_KINDS.has(kinds.get(f)) && !conventionSet.has(f) && !CHANGELOG_RE.test(f)).sort();
    if (files.length < 1 || cm.files.length > o.bulkCommitFiles) return;
    for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) {
      const k = files[i] + '\t' + files[j];
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
    // Directory seams: the same coupling one level up, where a schema
    // directory and a compose file move together although the individual
    // files differ each time.
    const ds = [...new Set(files.map(areaOf))].sort();
    for (const d of ds) perDir.set(d, (perDir.get(d) || 0) + 1);
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      const k = ds[i] + '\t' + ds[j];
      dirPairs.set(k, (dirPairs.get(k) || 0) + 1);
    }
  });

  const thin = counted < o.thinHistory;
  const minCommits = thin ? 1 : o.minCommits;

  // 2. Rows: every rankable file with enough history, or enough dependents.
  // On a repository with real history, a file nobody has touched in the
  // window is not a hotspot however many files depend on it; it is load
  // bearing, and goes in its own list. When history is thin everything is
  // untouched, so structure alone ranks.
  const rows = [];
  const loadBearing = [];
  let locInScope = 0;
  let filesInScope = 0;
  const ext = new Map();
  for (const [path, kind] of kinds) {
    if (!(kind in RANKED_KINDS)) continue;
    const l = loc.get(path);
    if (l === null || l === undefined) continue;
    filesInScope++;
    locInScope += l;
    const e = posix.extname(path).slice(1);
    if (e && !posix.basename(path).startsWith('.')) ext.set(e, (ext.get(e) || 0) + 1);
    const r = churn.get(path) || { c: 0, cw: 0, fixes: 0, fw: 0, authors: new Map(), last: null };
    const fi = fanIn.get(path)?.size || 0;
    if (r.c < minCommits && fi < o.fanInFloor) continue;
    if (l === 0) continue;
    if (!thin && r.c === 0) {
      loadBearing.push({ path, kind, loc: l, fan_in: fi, tests: testEdges.get(path)?.size || 0 });
      continue;
    }
    const top = r.authors.size ? Math.max(...r.authors.values()) : 0;
    // Size is logarithmic: a 4,000 line file is not forty times a 100 line
    // one. Activity is square rooted: fault density rises with churn, but
    // sub-linearly, and a fix is worth half a commit on top of the commit it
    // already is. Structure is the squared log of dependents: each doubling
    // of importers widens the blast radius by a fixed step, and blast radius
    // compounds with the chance of a mistake. The half-point activity floor
    // is what lets a quiet, load-bearing file rank at all.
    const activity = Math.sqrt(r.cw + 0.5 * r.fw + 0.5);
    const size = Math.log2(1 + l);
    const structure = Math.pow(1 + Math.log2(1 + fi), 2);
    rows.push({
      path,
      kind,
      loc: l,
      churn: r.c,
      churn_w: Number(r.cw.toFixed(2)),
      fixes: r.fixes,
      authors: r.authors.size,
      owner_share: r.c ? Number((top / r.c).toFixed(2)) : 0,
      fan_in: fi,
      fan_out: [...(edges.get(path) || [])].filter((t) => kinds.get(t) in RANKED_KINDS).length,
      tests: testEdges.get(path)?.size || 0,
      score: Math.round(size * activity * structure * RANKED_KINDS[kind] * 10),
    });
  }
  rows.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  loadBearing.sort((a, b) => b.fan_in - a.fan_in || a.path.localeCompare(b.path));
  const table = rows.slice(0, o.tableRows);
  const topScore = rows[0]?.score || 0;
  let cut = rows.filter((r) => r.score >= topScore * o.hotspotCut).length;
  // A flat score distribution passes nearly everything through the tenth-
  // of-top cut: on express that made 10 of 13 files hotspots. A hotspot list
  // is a minority of the code or it is not a list.
  const share = Math.max(3, Math.round(rows.length * o.hotspotShare));
  cut = Math.min(o.hotspotRows, share, Math.max(o.hotspotFloor, cut));
  const hotspots = rows.slice(0, cut);

  // 3. Co-change: shared commits, and coupling = the share of the less
  // active side's commits that also touch the other side, as a percentage.
  // "When the seed changes, compose changes 84% of the time" is the sentence
  // an agent needs; a changelog that rides along with everything scores in
  // the teens and is already excluded as a convention.
  const N = counted || 1;
  const pairMin = Math.min(10, Math.max(3, Math.round(N / 150)));
  const conf = (count, ca, cb) => Math.round((100 * count) / Math.max(Math.min(ca || count, cb || count), count));
  const coChange = [...pairs.entries()]
    .map(([k, count]) => {
      const [a, b] = k.split('\t');
      return { files: [a, b], count, coupling: conf(count, perFile.get(a), perFile.get(b)) };
    })
    .filter((p) => p.count >= pairMin && p.coupling >= o.minCoupling)
    .sort((a, b) => b.count - a.count || b.coupling - a.coupling || a.files[0].localeCompare(b.files[0]))
    .slice(0, o.pairRows);
  const seams = [...dirPairs.entries()]
    .map(([k, count]) => {
      const [a, b] = k.split('\t');
      return { dirs: [a, b], count, coupling: conf(count, perDir.get(a), perDir.get(b)) };
    })
    .filter((p) => p.count >= pairMin && p.coupling >= o.minCoupling)
    .sort((a, b) => b.count - a.count || b.coupling - a.coupling || a.dirs[0].localeCompare(b.dirs[0]))
    .slice(0, o.seamRows);

  // 4. Profile and blind spots.
  const importers = {};
  const tests = {};
  for (const r of [...table, ...loadBearing.slice(0, o.loadBearingRows)]) {
    importers[r.path] = [...(fanIn.get(r.path) || [])].sort();
    tests[r.path] = [...(testEdges.get(r.path) || [])].sort();
  }
  const total = rows.reduce((a, r) => a + r.score, 0);
  let acc = 0;
  let conc = 0;
  for (const r of rows) { acc += r.score; conc++; if (acc >= total / 2) break; }
  const kindCounts = {};
  for (const k of kinds.values()) kindCounts[k] = (kindCounts[k] || 0) + 1;
  const from = commits.length ? commits[commits.length - 1].ts : null;
  const to = commits.length ? commits[0].ts : null;
  const spanDays = from && to ? Math.max(1, (to - from) / 86400) : null;
  const subs = submodulePaths(cwd);
  const edgeCount = [...edges.values()].reduce((a, s) => a + s.size, 0);
  const blind = [];
  if (subs.length) blind.push(`${subs.length} submodule${subs.length > 1 ? 's' : ''} not analyzed: ${subs.join(', ')}`);
  if (kindCounts.vendored) blind.push(`${kindCounts.vendored} vendored files excluded`);
  if (kindCounts.generated) blind.push(`${kindCounts.generated} generated or lock files excluded`);
  if (graph.skippedLarge) blind.push(`${graph.skippedLarge} files over 1 MB not read for dependencies`);
  if (git(['rev-parse', '--is-shallow-repository'], { cwd, allowFail: true }).trim() === 'true') blind.push('shallow clone: history is truncated');
  if (thin) blind.push(`${counted} commits of usable history: ranking rests on structure and size; churn, fixes and ownership carry little weight yet`);
  if (allAuthors.size <= 1) blind.push('one committer identity: authors and owner_share carry no information on this repository');
  // The graph resolves some languages and not others. Say which files it
  // could not see through, and when that is most of the repository, say the
  // structural axis is missing rather than pretend fan_in is zero.
  const unresolved = new Map();
  let unresolvedFiles = 0;
  for (const [path, kind] of kinds) {
    if (!(kind in RANKED_KINDS)) continue;
    const e = posix.extname(path).slice(1);
    if (!e || RESOLVED_EXT.has(e) || kind !== 'source') continue;
    unresolved.set(e, (unresolved.get(e) || 0) + 1);
    unresolvedFiles++;
  }
  const noGraph = edgeCount === 0 || (filesInScope >= 10 && unresolvedFiles > filesInScope / 2);
  if (edgeCount === 0 && filesInScope > 0) blind.push('no dependency edges resolved (unsupported language, or a Go module without go.mod): fan_in is zero everywhere; ranking rests on history and size');
  else if (unresolvedFiles) blind.push(`dependencies not resolved for ${[...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e, c]) => `${c} .${e}`).join(', ')} files: their fan_in and covering tests are undercounted${noGraph ? '; ranking rests on history and size' : ''}`);
  const dates = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const langs = [...ext.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e, c]) => `${e} ${c}`).join(', ');

  return {
    spec: SPEC_VERSION,
    generated: dates(to || Math.floor(Date.now() / 1000)),
    commit: shortSha(cwd),
    window_commits: commits.length,
    files_analyzed: filesInScope,
    commits_analyzed: counted,
    fix_commits: fixCommits,
    hotspots,
    table,
    load_bearing: loadBearing.slice(0, o.loadBearingRows),
    co_change: coChange,
    seams,
    importers,
    tests,
    conventions,
    blind_spots: blind,
    profile: {
      files_total: tracked.length,
      files_in_scope: filesInScope,
      loc_in_scope: locInScope,
      kinds: Object.entries(kindCounts).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join(', '),
      languages: langs,
      dependency_edges: edgeCount,
      commits_total: commitsTotal,
      commits_analyzed: counted,
      commits_skipped: commits.length - counted, // bulk, or touching no file that still exists
      half_life_commits: halfLife,
      window_from: from ? dates(from) : null,
      window_to: to ? dates(to) : null,
      velocity_30d: spanDays ? Number((commits.length / spanDays * 30).toFixed(1)) : null,
      authors_total: allAuthors.size,
      concentration_50: conc,
      hotspot_cut: cut,
      pair_min: pairMin,
      confidence: (thin && noGraph ? 'size-only' : thin ? 'structure-only' : noGraph ? 'history-only' : 'structure+history') + (allAuthors.size <= 1 ? ', single author' : ''),
    },
  };
}

/** The area a file belongs to: its first two path components (`sites/ops`, `platform-api/lib`), or the first for shallow paths. */
function areaOf(path) {
  const parts = path.split('/');
  if (parts.length <= 2) return parts.length === 1 ? '.' : parts[0];
  return parts.slice(0, 2).join('/');
}

/** Files that import or otherwise depend on `path` (graph-backed, no git grep). */
export function findImporters(cwd, path) {
  return [...(graphFor(cwd).fanIn.get(path) || [])].sort();
}

/** Test files that reach `path` through an import, a path literal or an exact name match. */
export function findCoveringTests(cwd, path) {
  return [...(graphFor(cwd).tests.get(path) || [])].sort().slice(0, 8);
}

export function kindOf(cwd, path) {
  return graphFor(cwd).kinds.get(path) || null;
}

/** Best guess at the repo's test command, for the check report. Never invented: null when unknown. */
export function detectTestCommand(cwd) {
  const pj = join(cwd, 'package.json');
  if (existsSync(pj)) {
    try {
      const p = JSON.parse(readFileSync(pj, 'utf8'));
      if (p.scripts?.test && !/no test specified/.test(p.scripts.test)) return 'npm test';
    } catch {}
  }
  // A manifest alone is not enough: a stray go.sum at the root of a JS
  // monorepo must not turn into `go test ./...`.
  const paths = [...graphFor(cwd).kinds.keys()];
  const has = (re) => paths.some((f) => re.test(f));
  if ((existsSync(join(cwd, 'pytest.ini')) || existsSync(join(cwd, 'conftest.py')) || existsSync(join(cwd, 'pyproject.toml'))) && has(/\.py$/)) return 'pytest';
  if (existsSync(join(cwd, 'Cargo.toml')) && has(/\.rs$/)) return 'cargo test';
  if (existsSync(join(cwd, 'go.mod')) && has(/\.go$/)) return 'go test ./...';
  if (has(/\.test\.m?js$|\.test\.ts$/) && !existsSync(pj)) return 'node --test';
  return null;
}

export const TABLE_HEAD = ['score', 'path', 'kind', 'loc', 'churn', 'churn_w', 'fixes', 'authors', 'owner_share', 'fan_in', 'tests'];

export function rowToArray(r) {
  return [r.score, r.path, r.kind, r.loc, r.churn, r.churn_w.toFixed(2), r.fixes, r.authors, r.owner_share.toFixed(2), r.fan_in, r.tests];
}

export function toTsv(sig) {
  const lines = [TABLE_HEAD.join('\t')];
  for (const r of sig.table) lines.push(rowToArray(r).join('\t'));
  return lines.join('\n');
}
