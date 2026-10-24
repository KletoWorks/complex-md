// verify: is the committed COMPLEX.md still a fair description of the code?
// It recomputes the signals (no model call) and compares them with the
// front matter. A map is not stale because a number moved by one: every
// commit moves a few. It is stale when a list it names would now read
// differently, so each comparison has a band around its threshold.
//
// The committed map is the latch. A file joins a list only when its fresh
// value clears the list's cut by the band, and a listed file leaves only
// when it falls below the cut by the band. Two files trading places at the
// boundary therefore never flip the result. Regenerating the map resets the
// latch to the new lists.
import { computeSignals, graphFor, DEFAULTS, SPEC_VERSION } from './signals.js';
import { loadComplexMd } from './complexmd.js';
import { git } from './git.js';

export const TOLERANCE = {
  // A hotspot enters above 125% of the fresh cut score and leaves below 75%.
  scoreBand: 0.25,
  // The same band on fan_in for load_bearing files.
  fanInBand: 0.25,
  // The same band on shared commits for co_change pairs and seams.
  pairBand: 0.25,
  // A pair also has to clear the coupling floor by this many points to
  // enter, or drop this many points under it to leave.
  couplingPoints: 10,
  // A number on a kept hotspot row moves when it changes by both this
  // share and this many units: 2 fixes becoming 3 is churn, 2 becoming 6 is not.
  rowRel: 0.5,
  rowAbs: 3,
  locRel: 0.5,
  locAbs: 50,
  // Profile counts that the prose quotes.
  profileRel: 0.25,
  profileAbs: 10,
  historyRel: 0.5,
  historyAbs: 25,
};

const PROFILE_COUNTS = [
  ['files_in_scope', 'profileRel', 'profileAbs'],
  ['dependency_edges', 'profileRel', 'profileAbs'],
  ['commits_analyzed', 'historyRel', 'historyAbs'],
];
const ROW_COUNTS = [
  ['fan_in', 'rowRel', 'rowAbs'],
  ['fixes', 'rowRel', 'rowAbs'],
  ['loc', 'locRel', 'locAbs'],
];

const pairKey = (xs) => [...xs].map(String).sort().join('\t');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** True when `b` differs from `a` by at least `rel` of `a` and at least `abs` units. */
export function moved(a, b, rel, abs) {
  if (num(a) === null || num(b) === null) return false;
  const d = Math.abs(b - a);
  return d >= abs && d / Math.max(Math.abs(a), 1) >= rel;
}

/**
 * The fresh side of the comparison: the lists exactly as a regeneration
 * would write them, plus every candidate behind each cut, so a listed file
 * that slipped just under a cut still has a value to compare.
 */
export function freshState(root) {
  const all = computeSignals(root, { tableRows: Infinity, pairRows: Infinity, seamRows: Infinity, loadBearingRows: Infinity, minCoupling: 0, pairFloor: 1 });
  const D = DEFAULTS;
  const pairMin = all.profile.pair_min;
  const listed = (c) => c.count >= pairMin && c.coupling >= D.minCoupling;
  const co = all.co_change.filter(listed).slice(0, D.pairRows);
  const seams = all.seams.filter(listed).slice(0, D.seamRows);
  const lb = all.load_bearing.slice(0, D.loadBearingRows);
  const { fanIn, kinds } = graphFor(root);
  return {
    spec: all.spec,
    commit: all.commit,
    hotspots: all.hotspots,
    rows: Object.fromEntries(all.table.map((r) => [r.path, r])),
    load_bearing: lb,
    fanInOf: (p) => fanIn.get(p)?.size || 0,
    exists: (p) => kinds.has(p),
    co_change: co,
    pairs: Object.fromEntries(all.co_change.map((c) => [pairKey(c.files), c])),
    seams,
    seamPairs: Object.fromEntries(all.seams.map((c) => [pairKey(c.dirs), c])),
    profile: all.profile,
    shallow: all.blind_spots.some((b) => /^shallow clone/.test(b)),
    // The value a newcomer has to beat to be on each list. A list that is
    // not full has room, so its cut is the list's own floor.
    cuts: {
      hotspots: all.hotspots.length ? all.hotspots[all.hotspots.length - 1].score : 0,
      load_bearing: lb.length >= D.loadBearingRows ? lb[lb.length - 1].fan_in : D.fanInFloor,
      co_change: co.length >= D.pairRows ? co[co.length - 1].count : pairMin,
      seams: seams.length >= D.seamRows ? seams[seams.length - 1].count : pairMin,
      coupling: D.minCoupling,
    },
  };
}

/**
 * Compare a committed front matter with a fresh state. Pure: the tests
 * feed it hand built states to pin each band edge. Returns the drift
 * entries; an empty list means the map is fresh.
 */
export function diffMap(front, fresh, tol = TOLERANCE) {
  const t = { ...TOLERANCE, ...tol };
  const drift = [];
  const list = (v) => (Array.isArray(v) ? v : []);
  const fanInOf = fresh.fanInOf || ((p) => fresh.rows?.[p]?.fan_in ?? 0);
  const exists = fresh.exists || ((p) => Boolean(fresh.rows?.[p]));

  if (front.complex_md !== undefined && String(front.complex_md) !== String(fresh.spec)) {
    drift.push({ list: 'spec', change: 'changed', field: 'complex_md', old: String(front.complex_md), new: String(fresh.spec) });
  }

  // Hotspots, on score.
  const oldHot = list(front.hotspots).filter((h) => h?.path);
  const oldHotSet = new Set(oldHot.map((h) => h.path));
  const oldLbSet = new Set(list(front.load_bearing).filter((h) => h?.path).map((h) => h.path));
  const freshLbSet = new Set(fresh.load_bearing.map((h) => h.path));
  const hc = fresh.cuts.hotspots;
  const enterAt = hc * (1 + t.scoreBand);
  const leaveAt = hc * (1 - t.scoreBand);
  for (const h of fresh.hotspots) {
    if (oldHotSet.has(h.path) || oldLbSet.has(h.path)) continue;
    if (h.score >= enterAt) drift.push({ list: 'hotspots', change: 'entered', path: h.path, value: h.score, needs: Math.ceil(enterAt) });
  }
  for (const h of oldHot) {
    const row = fresh.rows[h.path];
    const score = row ? row.score : 0;
    if ((score < leaveAt || !exists(h.path)) && !freshLbSet.has(h.path)) {
      drift.push({ list: 'hotspots', change: 'left', path: h.path, value: row ? score : null, needs: Math.ceil(leaveAt), gone: !exists(h.path) });
      continue;
    }
    if (!row) continue;
    for (const [k, rel, abs] of ROW_COUNTS) {
      if (moved(num(h[k]), num(row[k]), t[rel], t[abs])) drift.push({ list: 'hotspots', change: 'moved', path: h.path, field: k, old: h[k], new: row[k] });
    }
  }

  // Load-bearing files, on fan_in.
  const lc = fresh.cuts.load_bearing;
  const freshHotSet = new Set(fresh.hotspots.map((h) => h.path));
  for (const h of fresh.load_bearing) {
    if (oldLbSet.has(h.path) || oldHotSet.has(h.path)) continue;
    if (h.fan_in >= lc * (1 + t.fanInBand)) drift.push({ list: 'load_bearing', change: 'entered', path: h.path, value: h.fan_in, needs: Math.ceil(lc * (1 + t.fanInBand)) });
  }
  for (const h of list(front.load_bearing).filter((x) => x?.path)) {
    if (freshHotSet.has(h.path)) continue;
    const fi = fanInOf(h.path);
    if (fi < lc * (1 - t.fanInBand) || !exists(h.path)) drift.push({ list: 'load_bearing', change: 'left', path: h.path, value: fi, needs: Math.ceil(lc * (1 - t.fanInBand)), gone: !exists(h.path) });
  }

  // Co-change pairs and seams, on shared commits and coupling.
  pairs('co_change', 'files', list(front.co_change), fresh.co_change, fresh.pairs, fresh.cuts.co_change);
  pairs('seams', 'dirs', list(front.seams), fresh.seams, fresh.seamPairs, fresh.cuts.seams);

  // Profile counts.
  const op = front.profile || {};
  for (const [k, rel, abs] of PROFILE_COUNTS) {
    if (moved(num(op[k]), num(fresh.profile[k]), t[rel], t[abs])) drift.push({ list: 'profile', change: 'moved', field: k, old: op[k], new: fresh.profile[k] });
  }
  return drift;

  function pairs(name, field, committed, official, all, cut) {
    const floor = fresh.cuts.coupling;
    const oldKeys = new Set(committed.filter((c) => Array.isArray(c?.[field])).map((c) => pairKey(c[field])));
    const enter = cut * (1 + t.pairBand);
    const leave = cut * (1 - t.pairBand);
    for (const c of official) {
      if (oldKeys.has(pairKey(c[field]))) continue;
      if (c.count >= enter && c.coupling >= floor + t.couplingPoints) drift.push({ list: name, change: 'entered', [field]: c[field], value: c.count, coupling: c.coupling, needs: Math.ceil(enter), needs_coupling: floor + t.couplingPoints });
    }
    for (const c of committed) {
      if (!Array.isArray(c?.[field])) continue;
      const now = all[pairKey(c[field])];
      // Not among the candidates: no shared commit left in the window.
      const count = now ? now.count : 0;
      const coupling = now ? now.coupling : 0;
      if (count < leave || coupling < floor - t.couplingPoints) drift.push({ list: name, change: 'left', [field]: c[field], value: count, coupling, needs: Math.ceil(leave), needs_coupling: floor - t.couplingPoints, gone: field === 'files' && c.files.some((f) => !exists(f)) });
    }
  }
}

/**
 * Verify the COMPLEX.md at `root`. status is 'fresh', 'drift' or 'error'
 * (no map, an unreadable map, or a history too short to compare with).
 */
export function verifyMap(root, { tolerance = {} } = {}) {
  const map = loadComplexMd(root);
  if (!map) return { status: 'error', reason: 'No readable COMPLEX.md at the repository root; generate one with `npx complex-md`.' };
  const fresh = freshState(root);
  const front = map.front;
  const wasShallow = (front.blind_spots || []).some((b) => /^shallow clone/.test(String(b)));
  if (fresh.shallow && !wasShallow) {
    return { status: 'error', reason: 'This is a shallow clone, so the history is truncated and every count would read as drift. Fetch the full history first (in GitHub Actions: fetch-depth: 0).' };
  }
  const head = fresh.commit;
  const mapCommit = front.commit ? String(front.commit) : null;
  let behind = null;
  if (mapCommit) {
    const out = git(['rev-list', '--count', `${mapCommit}..HEAD`], { cwd: root, allowFail: true }).trim();
    if (/^\d+$/.test(out)) behind = Number(out);
  }
  const drift = diffMap(front, fresh, tolerance);
  return { status: drift.length ? 'drift' : 'fresh', map_commit: mapCommit, head, commits_behind: behind, drift, tolerance: { ...TOLERANCE, ...tolerance } };
}

const pct = (a, b) => {
  const r = Math.round(((b - a) / Math.max(Math.abs(a), 1)) * 100);
  return `${r >= 0 ? '+' : ''}${r}%`;
};

const LISTS = ['spec', 'hotspots', 'load_bearing', 'co_change', 'seams', 'profile'];
const CHANGES = ['changed', 'entered', 'left', 'moved'];

function describe(d) {
  const what = d.path || (d.files || d.dirs || []).join(' + ');
  if (d.list === 'spec') return `spec: the map is format ${d.old}; this version writes ${d.new}`;
  if (d.change === 'moved') return `${d.list === 'profile' ? 'profile' : what}: ${d.field} ${d.old} -> ${d.new} (${pct(d.old, d.new)})`;
  const who = d.change === 'entered' ? 'a newcomer' : 'a listed entry';
  if (d.gone) return `${d.list}: ${what} left (${d.files ? 'a file of the pair is gone' : 'the file is gone'})`;
  if (d.list === 'hotspots' || d.list === 'load_bearing') {
    const unit = d.list === 'hotspots' ? 'score' : 'fan_in';
    if (d.value === null) return `${d.list}: ${what} left (too few commits and dependents to rank; ${who} needs a score of ${d.needs})`;
    return `${d.list}: ${what} ${d.change} (${unit} ${d.value}; ${who} needs ${d.needs})`;
  }
  return `${d.list}: ${what} ${d.change} (${d.value} shared commits at coupling ${d.coupling}%; ${who} needs ${d.needs} commits and coupling ${d.needs_coupling}%)`;
}

export function formatVerify(r) {
  if (r.status === 'error') return `complex-md verify: ${r.reason}`;
  const later = r.commits_behind !== null ? `, ${r.commits_behind} commit${r.commits_behind === 1 ? '' : 's'} later` : r.map_commit ? " (the map's commit is not in this history)" : '';
  const where = `Map at ${r.map_commit || 'an unknown commit'}, HEAD at ${r.head}${later}.`;
  if (r.status === 'fresh') return `complex-md verify: COMPLEX.md is fresh.\n${where} No list or count moved past its tolerance.`;
  const n = r.drift.length;
  const order = (d) => LISTS.indexOf(d.list) * 10 + CHANGES.indexOf(d.change);
  const lines = [...r.drift].sort((a, b) => order(a) - order(b)).map((d) => `- ${describe(d)}`);
  return [`complex-md verify: COMPLEX.md has drifted (${n} change${n === 1 ? '' : 's'} past tolerance).`, where, ...lines, 'Regenerate the map: npx complex-md'].join('\n');
}
