/* A deterministic repository for analysis regression.
 *
 * Dempsey and Wrage (CMU SEI, DOI 10.58012/4c2e-xd64) describe the practice
 * this file exists for: "A model, such as the flight controller, records known
 * timing, bandwidth, and reachability results. As the extension evolves, those
 * models can detect changes in parser behavior, instantiation, property
 * interpretation, and analysis output."
 *
 * Same idea, applied to this engine. The repository below is built byte for
 * byte the same every time, so its computed signals are a fixed point. Any
 * change in scanning, classification, graph resolution, scoring, coupling or
 * blind spot detection shows up as a diff against the recorded golden file
 * rather than as a silent change in what users are told about their code.
 *
 * Determinism comes from three things and all three matter: pinned author and
 * committer dates, pinned identities, and an explicit initial branch. With
 * those, the commit SHAs themselves are stable and the fixture can assert on
 * `commit` too.
 *
 * It deliberately exercises the signals that are easy to break:
 *   fan_in            core.js is imported by five modules
 *   co_change         render.js and render.css always move together
 *   fixes             three commits are marked fix:
 *   tests             one module has a covering test, others do not
 *   load_bearing      legacy.js has dependents and no commits in the window
 *   kinds             source, style, markup, docs, config
 *   blind_spots       one file carries a NUL and is unreachable by grep
 */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* One fixed clock. Each commit advances it by a day so the window, the
   half-life weighting and `last` have something to order by. */
const EPOCH = Date.UTC(2026, 0, 1, 12, 0, 0);
const DAY = 86400000;

const IDENT = {
  GIT_AUTHOR_NAME: 'Fixture One',
  GIT_AUTHOR_EMAIL: 'one@fixture.test',
  GIT_COMMITTER_NAME: 'Fixture One',
  GIT_COMMITTER_EMAIL: 'one@fixture.test',
};
/* A second identity, so owner_share and authors are not trivially 1. */
const IDENT2 = {
  GIT_AUTHOR_NAME: 'Fixture Two',
  GIT_AUTHOR_EMAIL: 'two@fixture.test',
  GIT_COMMITTER_NAME: 'Fixture Two',
  GIT_COMMITTER_EMAIL: 'two@fixture.test',
};

/* The options the golden file was recorded with. windowCommitsMax is pinned
   BELOW the fixture's commit count on purpose: the earliest commits then fall
   outside the window, which is the only way a file can be "untouched in the
   window" and therefore the only way load_bearing is exercised at all. */
export const REGRESSION_OPTS = {
  windowCommitsMax: 7,
  /* thinHistory is forced to 0 so the fixture is treated as having enough
     history to rank normally. Below the real default of 50 commits the engine
     deliberately suppresses load_bearing and relaxes minCommits, so a small
     fixture would otherwise exercise only the thin-history path and leave the
     main one unrecorded. Building 50+ commits to reach the same place would
     make the fixture slow for no extra coverage. */
  thinHistory: 0,
};

export function buildRegressionRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cx-regression-'));
  let day = 0;

  const git = (args, ident = IDENT) => {
    const when = new Date(EPOCH + day * DAY).toISOString();
    execFileSync('git', args, {
      cwd: dir,
      stdio: 'pipe',
      env: { ...process.env, ...ident, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
    });
  };
  const put = (path, body) => {
    const at = path.lastIndexOf('/');
    if (at > 0) mkdirSync(join(dir, path.slice(0, at)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const commit = (message, ident = IDENT) => {
    day += 1;
    git(['add', '-A'], ident);
    git(['commit', '-q', '-m', message], ident);
  };

  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'Fixture One']);
  git(['config', 'user.email', 'one@fixture.test']);

  // Seed. core.js is the hub; legacy.js gets dependents and is then left alone.
  put('src/core.js', 'export const version = 1;\nexport const id = (x) => x;\n');
  put('src/legacy.js', 'export const legacy = () => 0;\n');
  put('src/a.js', "import { mid } from './mid.js';\nimport { id } from './core.js';\nimport { legacy } from './legacy.js';\nexport const a = id(legacy());\n");
  put('src/b.js', "import { mid } from './mid.js';\nimport { id } from './core.js';\nimport { legacy } from './legacy.js';\nexport const b = id(2) + legacy();\n");
  put('src/c.js', "import { mid } from './mid.js';\nimport { id } from './core.js';\nimport { legacy } from './legacy.js';\nexport const c = legacy();\n");
  put('src/render.js', "import { id } from './core.js';\nimport { legacy } from './legacy.js';\nexport const render = () => id('<div/>' + legacy());\n");
  put('src/render.css', '.render { color: black; }\n');
  put('src/util.js', "import { mid } from './mid.js';\nimport { version } from './core.js';\nimport { legacy } from './legacy.js';\nexport const v = () => version + legacy() + mid();\n");
  /* fan_in exactly 4, one below fanInFloor. A file sitting ON a threshold is
     what makes the golden sensitive to that threshold moving; without one, a
     floor change from 5 to 4 passes unnoticed, which it did on first run. */
  put('src/mid.js', 'export const mid = () => 1;\n');
  put('test/core.test.js', "import { id } from '../src/core.js';\nid(1);\n");
  put('README.md', '# fixture\n');
  put('package.json', '{\n  "name": "fixture",\n  "private": true\n}\n');
  commit('feat: initial structure');

  // render.js and render.css always move together: a 100% co-change pair.
  for (let i = 0; i < 4; i += 1) {
    put('src/render.js', `import { id } from './core.js';\nimport { legacy } from './legacy.js';\nexport const render = () => id('<div>${i}</div>' + legacy());\n`);
    put('src/render.css', `.render { color: black; padding: ${i}px; }\n`);
    commit(i % 2 ? `fix: render padding off by one (${i})` : `feat: render variant ${i}`, i === 3 ? IDENT2 : IDENT);
  }

  // core.js churns, and picks up one fix and a second author.
  for (let i = 0; i < 3; i += 1) {
    put('src/core.js', `export const version = ${i + 2};\nexport const id = (x) => x;\n`);
    commit(i === 1 ? `fix: core identity on null (${i})` : `feat: core version ${i}`, i === 2 ? IDENT2 : IDENT);
  }

  /* A source file that grep cannot read. The NUL is written as an escape here
     for the same reason the detector exists: a literal one in this source
     would make THIS file invisible to grep too. */
  put('src/opaque.js', `import { id } from './core.js';\nexport const key = (a, b) => \`\${a}\0\${b}\`;\nexport const o = id(1);\n`);
  commit('feat: opaque key separator');

  return dir;
}

/* Fields that are not a property of the engine and must not be asserted:
   the generation date, and the tool version string. Everything else,
   including the commit SHA, is deterministic by construction. */
export function stableSignals(s) {
  const out = JSON.parse(JSON.stringify(s));
  delete out.generated;
  return out;
}
