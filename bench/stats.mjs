// Paired statistics for the benchmark.
//
// The first analysis of this benchmark used a mean and a t-test on steps to
// first gold read. That was the wrong instrument twice over. The distribution
// is discrete, skewed and has a floor at 1, and a handful of very long runs
// carry most of the variance: the standard deviation of the paired
// differences went from 0.64 on eight easy tasks to 3.43 on twenty four
// mixed ones, which moved the sample needed to resolve one step from 4 pairs
// to 93.
//
// So the primary test here is the Wilcoxon signed rank, which is what
// "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents"
// (arXiv 2601.20404) uses on the same shape of data. It ranks the paired
// differences instead of averaging them, so one 10 step run cannot dominate
// twenty 2 step runs. A trimmed mean is reported beside it for the same
// reason, and the untrimmed mean is kept so nothing is hidden by the choice.

export function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** Symmetric trimmed mean: drops `frac` from each tail. 0.1 is conventional. */
export function trimmedMean(xs, frac = 0.1) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * frac);
  const kept = k > 0 ? s.slice(k, s.length - k) : s;
  return mean(kept.length ? kept : s);
}

export function sd(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

function erf(x) {
  const sgn = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  return sgn * (1 - ((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t * Math.exp(-x * x));
}
const normalTwoSided = (z) => 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));

/* Wilcoxon signed rank on paired differences, normal approximation with a
   tie correction. Zero differences are dropped, which is the standard
   treatment and is why `n` here is smaller than the number of pairs. */
export function wilcoxon(diffs) {
  const d = diffs.filter((v) => v !== 0);
  const n = d.length;
  if (n < 6) return { n, z: NaN, p: NaN, note: 'too few non tied pairs for the normal approximation' };
  const idx = d.map((v, i) => [Math.abs(v), i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(n);
  const tieGroups = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j += 1;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k][1]] = r;
    tieGroups.push(j - i + 1);
    i = j + 1;
  }
  let W = 0;
  for (let k = 0; k < n; k += 1) if (d[k] > 0) W += ranks[k];
  const mu = (n * (n + 1)) / 4;
  const tieAdj = tieGroups.reduce((s, t) => s + (t ** 3 - t), 0) / 48;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieAdj);
  const z = sigma > 0 ? (W - mu) / sigma : 0;
  return { n, z, p: normalTwoSided(z) };
}

/** Sign test: the weakest claim the data can support, and the hardest to argue with. */
export function signTest(diffs) {
  const pos = diffs.filter((v) => v > 0).length;
  const neg = diffs.filter((v) => v < 0).length;
  const n = pos + neg;
  if (!n) return { n: 0, p: NaN };
  const C = (nn, k) => { let r = 1; for (let q = 0; q < k; q += 1) r = (r * (nn - q)) / (q + 1); return r; };
  const at = (k) => C(n, k) * 0.5 ** n;
  const obs = at(pos);
  let p = 0;
  for (let k = 0; k <= n; k += 1) if (at(k) <= obs + 1e-12) p += at(k);
  return { n, pos, neg, p: Math.min(1, p) };
}

/* Pairs needed for 80% power at alpha 0.05, two sided, paired t.
   Stated with the standard deviation it assumes, because assuming the wrong
   one is the mistake this file exists to stop repeating. */
export function pairsNeeded(effect, sdDiff, power = 0.8) {
  const zb = power === 0.8 ? 0.841621 : 1.281552;
  return Math.ceil(((1.959964 + zb) ** 2 * sdDiff ** 2) / effect ** 2);
}

/** The smallest effect this n could detect at 80% power, given the observed sd. */
export function minDetectable(n, sdDiff) {
  return Math.sqrt(((1.959964 + 0.841621) ** 2 * sdDiff ** 2) / n);
}

/** Everything about one metric's paired differences, in one object. */
export function summarise(pairs, { trim = 0.1 } = {}) {
  const a = pairs.map((p) => p[0]);
  const b = pairs.map((p) => p[1]);
  const d = pairs.map((p) => p[1] - p[0]);
  const s = sd(d);
  return {
    pairs: pairs.length,
    median_a: median(a),
    median_b: median(b),
    median_pct: median(a) ? ((median(b) - median(a)) / median(a)) * 100 : NaN,
    mean_delta: mean(d),
    trimmed_delta: trimmedMean(d, trim),
    sd_delta: s,
    wilcoxon: wilcoxon(d),
    sign: signTest(d),
    min_detectable: minDetectable(pairs.length, s),
  };
}

/* McNemar's test on paired pass/fail outcomes: the right test for success
   rate between two arms on the same tasks. Only the discordant pairs carry
   information (one arm passed, the other failed); the concordant ones say
   nothing about the difference and are not counted. Exact binomial, two
   sided, because the discordant count is small at this n. */
export function mcnemar(pairs) {
  /* pairs: [[aPassed, bPassed], ...] as booleans; nulls are skipped. */
  let b = 0, c = 0, n = 0;
  for (const [pa, pb] of pairs) {
    if (typeof pa !== 'boolean' || typeof pb !== 'boolean') continue;
    n += 1;
    if (pa && !pb) b += 1;
    if (!pa && pb) c += 1;
  }
  const disc = b + c;
  if (!disc) return { n, discordant: 0, b, c, p: NaN };
  const C = (nn, k) => { let r = 1; for (let q = 0; q < k; q += 1) r = (r * (nn - q)) / (q + 1); return r; };
  const at = (k) => C(disc, k) * 0.5 ** disc;
  const obs = at(Math.min(b, c));
  let p = 0;
  for (let k = 0; k <= disc; k += 1) if (at(k) <= obs + 1e-12) p += at(k);
  return { n, discordant: disc, b, c, p: Math.min(1, p) };
}
