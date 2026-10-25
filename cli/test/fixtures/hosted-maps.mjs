// Inputs for scripts/hosted-pages.mjs, in the shape the export writes.
// cleanMap is a map a template wrote for an ordinary repository. hostileInput
// is everything a stranger controls at once: owner and repository names,
// file paths, blind spot text, prose, extra front matter keys, and a value
// that tries to close the front matter block early. The hostile strings are
// built here with escapes, so no bidi control character sits in a file.

const SHA = 'a'.repeat(40);

/** A COMPLEX.md in the shape template prose takes, with the given paths. */
export function cleanMap({ hot = ['src/core/engine.js', 'src/net/parser.js', 'lib/util.js'], pair = ['src/core/engine.js', 'src/net/parser.js'] } = {}) {
  const rows = hot.map((p, i) => `  - path: ${p}\n    kind: source\n    loc: ${400 - i * 100}\n    churn: ${20 - i * 5}\n    fixes: ${9 - i * 3}\n    fan_in: ${12 - i * 3}\n    tests: ${3 - i}\n    score: ${9000 - i * 2000}`).join('\n');
  const paras = hot.map((p, i) => `\`${p}\` is a JavaScript source file of ${400 - i * 100} lines. It changed in ${20 - i * 5} of the last 140 commits, and ${9 - i * 3} of them were fixes. Before editing this file, run \`npm test -- ${p.split('/').pop().replace(/\.js$/, '')}\`.`).join('\n\n');
  return `---
complex_md: "0.3"
generated: 2026-10-20
commit: aaaaaaa
tool: complex-md/0.10.0
prose: template
window_commits: 140
files_analyzed: 48
profile:
  commits_analyzed: 138
  window_from: 2026-06-01
  window_to: 2026-10-19
  confidence: "structure+history"
hotspots:
${rows}
co_change:
  - files: [${pair[0]}, ${pair[1]}]
    count: 7
    coupling: 64
blind_spots:
  - "2 generated or lock files excluded"
---

## Where the risk lives

Change risk concentrates in ${hot.length} hotspots: \`${hot[0]}\` and ${hot.length - 1} more files. A template wrote this prose from the computed numbers.

## Why these files are hot

${paras}

## Change coupling

\`${pair[0]}\` and \`${pair[1]}\` changed together in 7 commits, with 64% coupling. When you change one of them, open the other and check whether it needs the same change.

## What to read first

1. \`${hot[0]}\`: the top hotspot.
`;
}

export function entry(owner, name, extra = {}) {
  return {
    owner,
    name,
    repo_key: `${owner}/${name}`.toLowerCase(),
    commit_sha: SHA,
    generated_at: '2026-10-20T04:00:00Z',
    tool: 'complex-md/0.10.0',
    prose_source: 'template',
    raw_text: cleanMap(),
    indexable: true,
    github_url: `https://github.com/${owner}/${name}`,
    stars: 1200,
    language: 'JavaScript',
    ...extra,
  };
}

export const RLO = '\u202E';
export const LONG = 'src/' + 'a'.repeat(10000) + '.js';
export const SUBJECT = 'fix: <img src=x onerror=alert(1)> by Jane Doe';

/** A map whose front matter and prose carry every hostile string at once. */
export function hostileMap() {
  const hot = [
    'src/core/engine.js',
    'src/<script>alert(1)</script>.js',
    `lib/it's "quoted".js`,
    '../../etc/passwd',
    `src/${RLO}sj.txt.exe`,
    LONG,
    'src/ok/after.js',
  ];
  const rows = hot.map((p, i) => `  - path: ${p}\n    loc: 100\n    churn: ${10 - i}\n    fixes: ${7 - i}\n    fan_in: 3\n    tests: 1\n    score: ${1000 - i}`).join('\n');
  return `---
complex_md: "0.3"
generated: 2026-10-20
commit: aaaaaaa
tool: complex-md/0.10.0
prose: template
recent_commits:
  - "${SUBJECT}"
hotspots:
${rows}
co_change:
  - files: [src/core/engine.js, ../../etc/passwd]
    count: 4
    coupling: 50
  - files: [src/core/engine.js, src/ok/after.js]
    count: 3
    coupling: 40
blind_spots:
  - "<img src=x onerror=alert(2)> a hostile blind spot ${RLO}"
  - "2 source files contain a NUL byte, so ripgrep skips them in silence: src/ok/after.js, ../x/<b>.js. Search with git grep -I --text, and fix the byte."
  - path: src/closer.js
---
## Where the risk lives

<script>alert('prose')</script> Injected after an early close of the front matter.
---
hosted: true
---

## Why these files are hot

\`src/core/engine.js\` is the hub. It names \`src/<b>bold</b>.js\` and \`${LONG}\`. Before editing this file, run \`npm test\` and read <img src=y onerror=alert(3)>.
`;
}


/** The whole export file: clean maps, hostile maps and hostile identities. */
export function hostileInput() {
  return {
    version: 1,
    site: 'https://complex.md',
    exported_at: '2026-10-24T03:00:00Z',
    maps: [
      entry('Acme', 'Widgets.js'),
      entry('evil-org', 'trap', { raw_text: hostileMap(), indexable: false }),
      entry('quiet', 'model-prose', { prose_source: 'model', indexable: false }),
      entry('<script>', 'x', { repo_key: '<script>/x' }),
      entry('dots', '..', { repo_key: 'dots/..' }),
      entry('acme', 'escape', { repo_key: '../../escape/x' }),
      entry('acme', 'mismatch', { repo_key: 'other/repo' }),
      entry('Spec', 'reserved'),
      entry('acme', 'badsha', { commit_sha: 'abc' }),
      entry('acme', 'nodate', { generated_at: 'yesterday' }),
      entry('acme', 'optout', { raw_text: cleanMap().replace('prose: template', 'prose: template\nhosted: false') }),
      entry('acme', 'committed'),
      entry('acme', 'notamap', { raw_text: 'no front matter here' }),
      entry('acme', 'huge', { raw_text: cleanMap() + 'x'.repeat(300000) }),
      entry(`acme${RLO}`, 'bidi', { repo_key: `acme${RLO}/bidi` }),
      entry('Acme', 'Widgets.js', { raw_text: cleanMap({ hot: ['dup/first.js'] }) }),
    ],
    committed: [
      { repo_key: 'acme/committed', url: 'https://github.com/acme/committed/blob/main/COMPLEX.md' },
      { repo_key: 'acme/js', url: 'javascript:alert(1)' },
      { repo_key: 'acme/other', url: 'https://github.com/someone/else/blob/main/COMPLEX.md' },
    ],
  };
}
