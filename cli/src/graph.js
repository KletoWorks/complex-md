// The structural axis: what each file is, and who depends on it. Computed
// from the working tree in one pass, no git history involved, so it works
// on a repository that was born yesterday from three combined projects as
// well as on one with ten years of commits.
import { readFileSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { parseJsonc, loadTsAliases, loadWorkspaces, resolveWorkspace, loadImportMaps, resolveHashImport, loadBundlerAliases, pythonRoots } from './resolve.js';

export const BINARY_RE = /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|jar|wasm|mp4|mp3|webp|avif|bmp|tiff?|psd|ai|sketch|db|sqlite3?|pyc|class|o|so|dylib|dll|exe|bin|dat)$/i;

const VENDORED_RE = /(^|\/)(vendor|node_modules|third[_-]?party|external|bower_components|\.yarn\/|\.pnpm\/)(\/|$)|\.min\.(js|css)$|(^|\/)[^/]*\.bundle\.js$/;
const GENERATED_RE = /(^|\/)(dist|target|coverage|\.next|\.nuxt|\.svelte-kit|__pycache__|\.cache|generated|__generated__)\/|\.generated\.[a-z]+$|_pb2?\.(py|js|ts)$|\.pb\.go$|\.d\.ts\.map$|\.map$|\.snap$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Cargo\.lock|poetry\.lock|Gemfile\.lock|go\.sum|bun\.lockb?|uv\.lock)$/;
export const TEST_FILE_RE = /(^|\/)(tests?|__tests__|specs?|test_?utils?|e2e|cypress|playwright)\/|\.(test|spec|tst|e2e)\.[a-z]+$|_test\.[a-z]+$|(^|\/)test(?:[_-](?!(?:utils?|helpers?|support|common)\.)[a-z0-9_-]+)?\.(m?js|cjs|ts|mts|py|rb|go|rs|java|kt|php|ex|exs|sh)$|(^|\/)(conftest\.py|tests?\.py|spec_helper\.rb|jest\.setup\.[a-z]+)$/;
// Files a test suite loads but never runs as a test: fixtures, setup and
// shared helpers. Inside a test directory they keep the test kind, so they
// never rank, but they are never named as a covering test either. Before
// this rule flask's src/flask/testing.py was the "covering test" of app.py.
const TEST_HELPER_RE = /(^|\/)(conftest\.py|testing\.[a-z]+|test[_-]?(utils?|helpers?|support|common)\.[a-z]+|helpers?\.[a-z]+|utils?\.[a-z]+|fixtures?\.[a-z]+|factories\.[a-z]+|spec_helper\.rb|rails_helper\.rb|jest\.setup\.[a-z]+|setup[_-]?tests?\.[a-z]+)$/i;
// Build and out directories hold hand-written scripts in many repositories,
// because real build output is gitignored. They are generated only when a
// manifest or tsconfig names them as output (see outputDirs).
const OUTPUT_DIR_RE = /(^|\/)(build|out)\//;
const DOC_EXT_RE = /\.(md|mdx|markdown|rst|txt|adoc|asciidoc|org|pod|mdc)$/i;
const EXAMPLE_RE = /(^|\/)(examples?|samples?|demos?|playground|sandbox)\//;
const DOTFILE_RE = /(^|\/)\.[^/]+$/;
const DOCS_RE = /(^|\/)(docs?|documentation|\.github\/ISSUE_TEMPLATE|adr|rfcs?)\/|\.(md|mdx|markdown|rst|txt|adoc|asciidoc|org|pod)$|(^|\/)(LICENSE|LICENCE|COPYING|AUTHORS|CONTRIBUTORS|CHANGELOG|HISTORY|NEWS|NOTICE|CODEOWNERS)(\.[a-z]+)?$/i;
const CONFIG_RE = /\.(ya?ml|toml|ini|cfg|conf|env|properties|caddy|nginx|tf|tfvars|hcl|json5|jsonc|crontab|cron)$|(^|\/)(\.env(\.[a-z]+)?|crontab|Caddyfile|Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose[^/]*\.ya?ml|Makefile|GNUmakefile|Justfile|Procfile|Vagrantfile|Brewfile|Gemfile|Rakefile|package\.json|tsconfig[^/]*\.json|jsconfig\.json|babel\.config\.[a-z]+|jest\.config\.[a-z]+|vitest\.config\.[a-z]+|vite\.config\.[a-z]+|webpack[^/]*\.[a-z]+|rollup\.config\.[a-z]+|esbuild\.[a-z]+|tailwind\.config\.[a-z]+|postcss\.config\.[a-z]+|next\.config\.[a-z]+|nuxt\.config\.[a-z]+|svelte\.config\.[a-z]+|astro\.config\.[a-z]+|playwright\.config\.[a-z]+|cypress\.config\.[a-z]+|pyproject\.toml|setup\.cfg|setup\.py|requirements[^/]*\.txt|Pipfile|Cargo\.toml|go\.mod|composer\.json|pom\.xml|build\.gradle[^/]*|CMakeLists\.txt|\.gitignore|\.gitattributes|\.gitmodules|\.dockerignore|\.tool-versions|crontab)$|(^|\/)\.github\/|(^|\/)\.circleci\/|(^|\/)\.gitlab-ci\.yml$|(^|\/)(migrations?|seeds?|schema)\/[^/]*\.sql$|\.sql$/;
const MANIFEST_RE = /(^|\/)(package\.json|composer\.json|Cargo\.toml|go\.mod|pyproject\.toml|setup\.py|setup\.cfg|Pipfile|Gemfile|pom\.xml|build\.gradle(\.kts)?|deno\.json|jsr\.json|pubspec\.yaml|mix\.exs|Package\.swift|project\.clj|\.tool-versions|\.nvmrc|requirements[^/]*\.txt)$/;
const CI_RE = /(^|\/)(\.github|\.circleci|\.gitlab|\.buildkite|\.azure-pipelines)\/|(^|\/)(\.gitlab-ci\.yml|\.travis\.yml|azure-pipelines\.yml|Jenkinsfile|appveyor\.yml|\.drone\.yml|bitbucket-pipelines\.yml|cloudbuild\.yaml|\.pre-commit-config\.yaml|renovate\.json|\.releaserc[^/]*|\.dependabot\/[^/]*)$/;
const STYLE_RE = /\.(css|scss|sass|less|styl|pcss)$/;
const MARKUP_RE = /\.(html?|xhtml|njk|hbs|handlebars|mustache|ejs|pug|jade|liquid|twig|erb|haml|slim|jinja2?|j2|tmpl|tpl)$/;
const DATA_RE = /\.(json|ndjson|jsonl|csv|tsv|xml|geojson|parquet|arrow|avro|proto|graphql|gql|sqlite|webmanifest|vcf|ics|yaml\.example)$|(^|\/)(fixtures?|testdata|__fixtures__|__snapshots__|seed-data|mocks?|__mocks__)\//;
// A data/ directory holds data files, and also loaders and schemas written
// in code (src/data/loader.ts). Only the files without a source extension
// are data; the code ranks.
const DATA_DIR_RE = /(^|\/)(data|datasets?)\//;
const SOURCE_EXT_RE = /\.(m?js|cjs|jsx|ts|mts|cts|tsx|vue|svelte|astro|py|pyi|rb|go|rs|java|kt|kts|scala|groovy|php|cs|fs|vb|swift|m|mm|c|h|cc|cpp|cxx|hpp|hh|hxx|zig|nim|d|dart|ex|exs|erl|hrl|clj|cljs|cljc|edn|hs|lhs|ml|mli|elm|purs|lua|pl|pm|r|R|jl|sh|bash|zsh|fish|ps1|psm1|bat|cmd|awk|sed|sql\.js|wat|sol|move|cairo|tf\.js|gd|glsl|hlsl|wgsl|cu|f90|f95|f03|for|nix|dhall|cue|rego|star|bzl)$|(^|\/)(BUILD|WORKSPACE|Snakefile)$/;
const GENERATED_HEADER_RE = /@generated|DO NOT EDIT|Code generated|automatically generated|autogenerated|auto-generated|this file was generated|generated by/i;

const MAX_READ = 1024 * 1024;

/**
 * Classify one repo-relative path. Order matters: vendored and generated
 * win over everything (a vendored test is still vendored); tests win over
 * source; docs, config, style, markup, data, then source by extension.
 * `head` is the first few hundred bytes when the caller has them, for the
 * generated-header check. `ctx` is what the repository declares about
 * itself (see loadClassifyContext); without it, build/ and out/ count as
 * output and only the built-in test names apply.
 */
export function classify(path, head = null, ctx = null) {
  if (BINARY_RE.test(path)) return 'asset';
  if (VENDORED_RE.test(path)) return 'vendored';
  if (GENERATED_RE.test(path)) return 'generated';
  if (OUTPUT_DIR_RE.test(path) && (!ctx || underOutputDir(path, ctx.outputDirs))) return 'generated';
  if (head && GENERATED_HEADER_RE.test(head)) return 'generated';
  // A markdown file in spec/ or e2e/ is documentation, not a test.
  if (DOC_EXT_RE.test(path)) return 'docs';
  if (TEST_FILE_RE.test(path) || matchesTestPatterns(path, ctx)) return 'test';
  // A docs/ directory makes prose documentation; a Go `doc` package or a
  // docs site's build script is still code.
  if (DOCS_RE.test(path) && !SOURCE_EXT_RE.test(path)) return 'docs';
  // Examples are documentation that happens to compile; at 0.2 they were
  // out of scope and at 0.3.0 they filled express's table.
  if (EXAMPLE_RE.test(path)) return 'example';
  // Dotfiles at any level (.gitignore, .npmrc, .prettierrc) are tool
  // settings, not a place an edit breaks behavior.
  if (DOTFILE_RE.test(path)) return 'other';
  // Manifests change on every release and dependency bump; that is not risk
  // an edit lands in (package.json: 631 commits on fastify).
  if (MANIFEST_RE.test(path)) return 'manifest';
  // CI configuration pairs with itself (four workflow files edited together)
  // and with nothing an agent edits for behavior.
  if (CI_RE.test(path)) return 'ci';
  if (CONFIG_RE.test(path)) return 'config';
  if (STYLE_RE.test(path)) return 'style';
  if (MARKUP_RE.test(path)) return 'markup';
  if (DATA_RE.test(path)) return 'data';
  if (DATA_DIR_RE.test(path) && !SOURCE_EXT_RE.test(path)) return 'data';
  if (SOURCE_EXT_RE.test(path)) return 'source';
  return 'other';
}

/** A file the test runner loads but does not run: never a covering test, unless the project's own test patterns name it. */
export function isTestHelper(path, ctx = null) {
  return TEST_HELPER_RE.test(path) && !matchesTestPatterns(path, ctx);
}

function matchesTestPatterns(path, ctx) {
  if (!ctx?.testPatterns?.length || !/\.py$/.test(path)) return false;
  const base = posix.basename(path);
  return ctx.testPatterns.some((re) => re.test(base));
}

function underOutputDir(path, outputDirs) {
  for (const d of outputDirs || []) if (path.startsWith(d + '/')) return true;
  return false;
}

// pytest's python_files: whitespace separated globs in an ini value (which
// may continue on indented lines), or a TOML string or array.
const PYTEST_SECTIONS = { 'pytest.ini': /^\[pytest\]/m, 'tox.ini': /^\[pytest\]/m, 'setup.cfg': /^\[tool:pytest\]/m, 'pyproject.toml': /^\[tool\.pytest\.ini_options\]/m };
const OUTPUT_FIELDS = ['main', 'module', 'browser', 'types', 'typings', 'unpkg', 'jsdelivr', 'exports', 'bin', 'files'];

function fnmatchToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

/**
 * What the repository declares about its own files: the test file patterns
 * pytest is configured with, and the build/ or out/ directories a
 * package.json or tsconfig names as output. Read once per graph.
 */
export function loadClassifyContext(root, files) {
  const testPatterns = [];
  const outputDirs = new Set();
  const read = (f) => { try { return readFileSync(join(root, f), 'utf8'); } catch { return null; } };
  const addOutput = (dir, p) => {
    if (typeof p !== 'string') return;
    const m = /^(build|out)(\/|$)/.exec(posix.normalize(p).replace(/^\.\//, ''));
    if (m) outputDirs.add(dir === '.' ? m[1] : dir + '/' + m[1]);
  };
  const walk = (dir, v) => {
    if (typeof v === 'string') addOutput(dir, v);
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(dir, x);
  };
  for (const f of files) {
    const base = posix.basename(f);
    const dir = posix.dirname(f);
    if (PYTEST_SECTIONS[base]) {
      const txt = read(f);
      const at = txt ? txt.search(PYTEST_SECTIONS[base]) : -1;
      if (at < 0) continue;
      const body = txt.slice(at).split('\n').slice(1);
      const end = body.findIndex((l) => /^\[/.test(l));
      const section = (end < 0 ? body : body.slice(0, end)).join('\n');
      const m = /^python_files\s*=\s*((?:.*)(?:\n[ \t]+.*)*)/m.exec(section);
      if (m) for (const g of m[1].replace(/[\[\]"',]/g, ' ').split(/\s+/)) if (g) testPatterns.push(fnmatchToRe(g));
    } else if (base === 'package.json') {
      let pkg;
      try { pkg = JSON.parse(read(f) || ''); } catch { continue; }
      for (const k of OUTPUT_FIELDS) walk(dir, pkg?.[k]);
    } else if (/^[jt]sconfig[^/]*\.json$/.test(base)) {
      let cfg;
      try { cfg = parseJsonc(read(f) || ''); } catch { continue; }
      addOutput(dir, cfg?.compilerOptions?.outDir);
    }
  }
  return { testPatterns, outputDirs };
}

/** Kinds that can be hotspots. Weight says how much an edit there can break. */
export const RANKED_KINDS = { source: 1, config: 1, markup: 0.8, style: 0.5 };
/** Kinds that count as importers for fan-in. Tests are covering tests instead; docs are prose. */
export const IMPORTER_KINDS = new Set(['source', 'config', 'markup', 'style']);
/** Kinds whose edges to a file mean "this test exercises it". */
export const TEST_KINDS = new Set(['test']);

function countLines(buf) {
  if (buf.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  if (buf[buf.length - 1] !== 10) n++;
  return n;
}

const JS_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.json'];
const PY_INIT = ['/__init__.py'];

/** Resolve a relative-ish specifier from `fromDir` against the tracked set, probing extensions and index files. */
function resolveRel(spec, fromDir, files, dirs) {
  spec = spec.replace(/[?#].*$/, '');
  if (!spec) return null;
  const base = posix.normalize(posix.join(fromDir, spec)).replace(/^\.\//, '');
  return probe(base, files, dirs);
}

function probe(base, files, dirs) {
  if (files.has(base)) return base;
  for (const e of JS_EXTS) if (files.has(base + e)) return base + e;
  if (dirs.has(base)) for (const e of JS_EXTS) if (files.has(base + '/index' + e)) return base + '/index' + e;
  for (const e of PY_INIT) if (files.has(base + e)) return base + e;
  if (files.has(base + '.py')) return base + '.py';
  if (files.has(base + '.rb')) return base + '.rb';
  if (files.has(base + '.php')) return base + '.php';
  if (files.has(base + '.sh')) return base + '.sh';
  if (files.has(base + '.scss')) return base + '.scss';
  const b = posix.basename(base);
  const d = posix.dirname(base);
  if (files.has(posix.join(d, '_' + b + '.scss'))) return posix.join(d, '_' + b + '.scss');
  return null;
}

/** tsconfig/jsconfig and bundler aliases (scoped per config dir), plus the common `@/` -> src convention. */
function loadAliases(root, files) {
  const trackedList = [...files];
  const aliases = [...loadTsAliases(root, trackedList), ...loadBundlerAliases(root, trackedList)];
  if (!aliases.some((a) => a.from === '@/')) {
    for (const cand of ['src', 'app', 'lib']) if (files.has(cand) || trackedList.some((f) => f.startsWith(cand + '/'))) { aliases.push({ scope: '', from: '@/', to: cand + '/' }); break; }
  }
  return aliases;
}

// A scoped alias applies only under its config's directory; entries are
// sorted longest scope first, so the nearest config wins.
function resolveAlias(spec, fromDir, aliases, files, dirs) {
  const from = fromDir === '.' ? '' : fromDir;
  for (const a of aliases) {
    if (a.scope && from !== a.scope && !from.startsWith(a.scope + '/')) continue;
    if (!spec.startsWith(a.from)) continue;
    const r = probe(posix.normalize(a.to + (a.to && !a.to.endsWith('/') && spec.length > a.from.length ? '/' : '') + spec.slice(a.from.length)), files, dirs);
    if (r) return r;
  }
  return null;
}

// Specifier extraction per family. Each returns raw specifiers; resolution is shared.
const JS_SPEC_RE = /(?:import|export)\s*(?:[\w*\s{},$]*?\s*from\s*)?['"]([^'"\n]+)['"]|\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)|\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const HTML_SPEC_RE = /<(?:script|link|iframe|img|source|use|object|embed)\b[^>]*?\b(?:src|href|data)\s*=\s*["']([^"'\n]+)["']/gi;
const CSS_SPEC_RE = /@(?:import|use|forward)\s+(?:url\()?["']([^"'\n]+)["']/g;
const PY_SPEC_RE = /^\s*(?:from\s+([\w.]+)\s+import\s+(\([^)]*\)|(?:[^\n#;\\]|\\\r?\n)*)|import\s+([\w.]+(?:\s*,\s*[\w.]+)*))/gm;
const RB_SPEC_RE = /\brequire(_relative)?\s*\(?\s*['"]([^'"\n]+)['"]/g;
const PHP_SPEC_RE = /\b(?:require|include)(?:_once)?\s*\(?\s*(?:__DIR__\s*\.\s*)?['"]([^'"\n]+)['"]/g;
const SH_SPEC_RE = /(?:^|[;&|]\s*|\$\(|`)\s*(?:source|\.)\s+["']?([^\s"'`;)]+)/gm;
const CADDY_IMPORT_RE = /^\s*import\s+([^\s]+)/gm;
// Go imports packages, not files: `import "module/path/pkg"` depends on every
// non-test .go file in that directory. Resolved against the module path in
// go.mod; standard library and third-party paths do not resolve.
const GO_IMPORT_BLOCK_RE = /^import\s*\(([\s\S]*?)\)|^import\s+(?:\w+\s+)?"([^"]+)"/gm;
const GO_IMPORT_LINE_RE = /(?:^|\n)\s*(?:\w+\s+)?"([^"]+)"/g;
// Anything that looks like a repo path with an extension, for scripts, cron,
// compose files and configs that name files without an import keyword.
const PATH_LITERAL_RE = /(?<![\w@])((?:\.\.?\/|\/)?(?:[\w@][\w@.-]*\/)+[\w@][\w@.-]*\.[A-Za-z0-9]{1,8})(?![\w/])/g;

function pyModuleToPath(mod, fromDir, files, roots) {
  if (mod.startsWith('.')) {
    let dots = 0;
    while (mod[dots] === '.') dots++;
    let d = fromDir;
    for (let i = 1; i < dots; i++) d = posix.dirname(d);
    const rest = mod.slice(dots).replace(/\./g, '/');
    const base = rest ? posix.join(d, rest) : d;
    return files.has(base + '.py') ? base + '.py' : files.has(base + '/__init__.py') ? base + '/__init__.py' : null;
  }
  const rel = mod.replace(/\./g, '/');
  // Package roots are computed from __init__.py chains (src/ layouts, lib/,
  // nested roots); the importing file's own directory covers scripts that
  // sit beside their modules.
  for (const prefix of [...roots, 'lib', fromDir]) {
    const base = posix.normalize(prefix ? prefix + '/' + rel : rel);
    if (files.has(base + '.py')) return base + '.py';
    if (files.has(base + '/__init__.py')) return base + '/__init__.py';
  }
  return null;
}

function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
}

/**
 * Build the dependency graph over tracked files.
 * Returns { kinds: Map path->kind, loc: Map path->lines, edges: Map from->Set(to),
 *           fanIn: Map to->Set(from), tests: Map to->Set(testFile), skipped }.
 */
export function buildGraph(root, tracked) {
  const files = new Set(tracked);
  const dirs = new Set();
  for (const f of tracked) {
    let d = posix.dirname(f);
    while (d && d !== '.' && !dirs.has(d)) { dirs.add(d); d = posix.dirname(d); }
  }
  const kinds = new Map();
  const loc = new Map();
  const heads = new Map();
  const texts = new Map();
  let skippedLarge = 0;
  // Text files carrying a NUL past the sniff window below. They read as
  // source here and are invisible to grep, which is a blind spot the map
  // has to declare rather than paper over. See grepBlind at the return.
  const grepBlind = [];
  const TEXT_KINDS = new Set(['source', 'style', 'markup', 'config', 'docs', 'data', 'manifest', 'test']);
  const ctx = loadClassifyContext(root, tracked);
  for (const f of tracked) {
    if (BINARY_RE.test(f)) { kinds.set(f, 'asset'); continue; }
    let buf;
    try {
      const st = statSync(join(root, f));
      if (!st.isFile()) { kinds.set(f, 'other'); continue; }
      if (st.size > MAX_READ) { skippedLarge++; kinds.set(f, classify(f, null, ctx)); loc.set(f, null); continue; }
      buf = readFileSync(join(root, f));
    } catch { kinds.set(f, 'other'); continue; }
    // Binary sniff: a NUL in the first 8k means not text.
    const sniff = buf.subarray(0, 8192);
    if (sniff.includes(0)) {
      /* A file whose EXTENSION says source and whose bytes say binary is
         almost never an asset that was misnamed; it is a source file with a
         stray control byte in it. Dropping it from the map without a word
         hides a file that grep is also skipping without a word, so the
         repository ends up with a module nothing can find. Classify it as an
         asset as before, and say so. */
      if (TEXT_KINDS.has(classify(f, null, ctx))) grepBlind.push(f);
      kinds.set(f, 'asset');
      continue;
    }
    const head = sniff.toString('utf8', 0, Math.min(sniff.length, 600));
    heads.set(f, head);
    const kind = classify(f, head, ctx);
    kinds.set(f, kind);
    /* A NUL ANYWHERE in a file makes grep classify it as binary, and grep
       skips a binary file in SILENCE when its output is piped: no match, no
       warning, exit 0. The sniff above only reads the first 8k, so a file can
       pass as text here, be ranked and described in the map, and still be
       unreachable by every text search in the repository. That is the worst
       case, because the map then implies the file is findable. Scanning the
       whole buffer is one pass over bytes already in memory. */
    if (TEXT_KINDS.has(kind) && buf.includes(0)) {
      grepBlind.push(f);
    }
    loc.set(f, countLines(buf));
    if (kind !== 'asset' && kind !== 'vendored' && kind !== 'generated') texts.set(f, buf.toString('utf8'));
  }

  const aliases = loadAliases(root, files);
  const trackedList = [...files];
  const workspaces = loadWorkspaces(root, trackedList);
  const importMaps = loadImportMaps(root, trackedList);
  const pyRoots = pythonRoots(files);
  const goModule = files.has('go.mod') ? (/^module\s+(\S+)/m.exec(texts.get('go.mod') || '') || [])[1] : null;
  const goPkgFiles = new Map();
  if (goModule) for (const f of files) if (/\.go$/.test(f) && !/_test\.go$/.test(f)) {
    const d = posix.dirname(f);
    if (!goPkgFiles.has(d)) goPkgFiles.set(d, []);
    goPkgFiles.get(d).push(f);
  }
  const edges = new Map();
  const add = (from, to) => {
    if (!to || to === from || !files.has(to)) return;
    let s = edges.get(from);
    if (!s) edges.set(from, (s = new Set()));
    s.add(to);
  };
  const probeHere = (base) => probe(base, files, dirs);
  const resolveSpec = (spec, fromDir) => {
    if (/^(https?:)?\/\//.test(spec) || /^(data|mailto|tel|javascript|node|bun|npm|jsr|deno):/.test(spec)) return null;
    if (spec.startsWith('.')) return resolveRel(spec, fromDir, files, dirs);
    if (spec.startsWith('/')) return probe(spec.slice(1), files, dirs) || nearestRootProbe(spec.slice(1), fromDir, files, dirs);
    if (spec.startsWith('#')) return resolveHashImport(spec, fromDir, importMaps, probeHere);
    return resolveAlias(spec, fromDir, aliases, files, dirs) || resolveWorkspace(spec, workspaces, probeHere);
  };
  // In HTML and CSS a bare path is relative to the document, not a package.
  const resolveDoc = (spec, fromDir) => {
    if (/^(https?:)?\/\//.test(spec) || /^(data|mailto|tel|javascript):/.test(spec) || spec.startsWith('#')) return null;
    if (spec.startsWith('.') || spec.startsWith('/')) return resolveSpec(spec, fromDir);
    return resolveRel('./' + spec, fromDir, files, dirs) || probe(spec, files, dirs);
  };

  for (const [f, text] of texts) {
    const kind = kinds.get(f);
    const fromDir = posix.dirname(f);
    const family = /\.(m?js|cjs|jsx|ts|mts|cts|tsx|vue|svelte|astro)$/.test(f) ? 'js'
      : /\.(html?|xhtml|njk|hbs|ejs|liquid|twig|erb|jinja2?|j2)$/.test(f) ? 'html'
      : /\.(css|scss|sass|less|pcss)$/.test(f) ? 'css'
      : /\.pyi?$/.test(f) ? 'py'
      : /\.rb$/.test(f) ? 'rb'
      : /\.php$/.test(f) ? 'php'
      : /\.(sh|bash|zsh)$/.test(f) || /^#!.*\b(ba|z)?sh\b/.test(heads.get(f) || '') ? 'sh'
      : /(^|\/)Caddyfile$|\.caddy$/.test(f) ? 'caddy'
      : /\.go$/.test(f) && goModule ? 'go'
      : null;
    let m;
    if (family === 'js') {
      JS_SPEC_RE.lastIndex = 0;
      while ((m = JS_SPEC_RE.exec(text))) add(f, resolveSpec(m[1] || m[2] || m[3], fromDir));
    } else if (family === 'html') {
      HTML_SPEC_RE.lastIndex = 0;
      while ((m = HTML_SPEC_RE.exec(text))) add(f, resolveDoc(m[1], fromDir));
    } else if (family === 'css') {
      CSS_SPEC_RE.lastIndex = 0;
      while ((m = CSS_SPEC_RE.exec(text))) add(f, resolveDoc(m[1], fromDir));
    } else if (family === 'py') {
      PY_SPEC_RE.lastIndex = 0;
      while ((m = PY_SPEC_RE.exec(text))) {
        if (m[3]) { for (const mod of m[3].split(/\s*,\s*/)) add(f, pyModuleToPath(mod.trim(), fromDir, files, pyRoots)); continue; }
        // `from M import a, b`: a name that is a submodule (M/a.py or
        // M/a/__init__.py) is the dependency; any other name is an
        // attribute of M. `from . import cli` used to land on __init__.py.
        let attr = false;
        for (const name of m[2].replace(/#[^\n]*/g, ' ').replace(/[()\\]/g, ' ').split(',')) {
          const n = name.trim().split(/\s+/)[0];
          if (!n) continue; // a trailing comma
          if (n === '*') { attr = true; continue; }
          const sub = /^\w+$/.test(n) && pyModuleToPath(m[1].endsWith('.') ? m[1] + n : m[1] + '.' + n, fromDir, files, pyRoots);
          if (sub) add(f, sub); else attr = true;
        }
        if (attr) add(f, pyModuleToPath(m[1], fromDir, files, pyRoots));
      }
    } else if (family === 'rb') {
      RB_SPEC_RE.lastIndex = 0;
      // require_relative resolves against the file's directory and nowhere
      // else; plain require goes through the load path (lib/, the root).
      while ((m = RB_SPEC_RE.exec(text))) add(f, m[1] ? resolveRel(m[2], fromDir, files, dirs) : probe(m[2], files, dirs) || probe('lib/' + m[2], files, dirs));
    } else if (family === 'php') {
      PHP_SPEC_RE.lastIndex = 0;
      while ((m = PHP_SPEC_RE.exec(text))) add(f, resolveRel(m[1].replace(/^\//, './'), fromDir, files, dirs));
    } else if (family === 'sh') {
      SH_SPEC_RE.lastIndex = 0;
      while ((m = SH_SPEC_RE.exec(text))) add(f, resolveRel(m[1].replace(/^\$\{?[A-Z_]+\}?\/?/, ''), fromDir, files, dirs) || probe(m[1].replace(/^\$\{?[A-Z_]+\}?\/?/, ''), files, dirs));
    } else if (family === 'go') {
      GO_IMPORT_BLOCK_RE.lastIndex = 0;
      while ((m = GO_IMPORT_BLOCK_RE.exec(text))) {
        const specs = m[2] ? [m[2]] : [...m[1].matchAll(GO_IMPORT_LINE_RE)].map((x) => x[1]);
        for (const spec of specs) {
          if (spec !== goModule && !spec.startsWith(goModule + '/')) continue;
          const dir = spec === goModule ? '.' : spec.slice(goModule.length + 1);
          for (const g of goPkgFiles.get(dir) || []) add(f, g);
        }
      }
    } else if (family === 'caddy') {
      CADDY_IMPORT_RE.lastIndex = 0;
      while ((m = CADDY_IMPORT_RE.exec(text))) {
        const pat = posix.normalize(posix.join(fromDir, m[1]));
        if (/[*?]/.test(pat)) { const re = globToRe(pat); for (const g of files) if (re.test(g)) add(f, g); } else add(f, probe(pat, files, dirs));
      }
    }
    // Path literals: scripts, cron, compose, configs and code that name a
    // repo file outright. Docs, data and examples never count; they
    // describe, not depend.
    if (kind === 'docs' || kind === 'data' || kind === 'other' || kind === 'example') continue;
    PATH_LITERAL_RE.lastIndex = 0;
    while ((m = PATH_LITERAL_RE.exec(text))) {
      const lit = m[1];
      if (/^(https?:)?\/\//.test(lit) || /\.(com|org|net|io|dev|md)$/.test(lit) && !files.has(lit)) continue;
      const hit = lit.startsWith('/') ? null : files.has(lit) ? lit : (lit.startsWith('.') ? resolveRel(lit, fromDir, files, dirs) : (files.has(posix.normalize(posix.join(fromDir, lit))) ? posix.normalize(posix.join(fromDir, lit)) : null));
      add(f, hit);
    }
  }

  const fanIn = new Map();
  const tests = new Map();
  for (const [from, set] of edges) {
    const k = kinds.get(from);
    for (const to of set) {
      // Only files that can be hotspots have a blast radius worth counting.
      if (!(kinds.get(to) in RANKED_KINDS)) continue;
      if (TEST_KINDS.has(k)) {
        if (isTestHelper(from, ctx)) continue;
        let t = tests.get(to);
        if (!t) tests.set(to, (t = new Set()));
        t.add(from);
      } else if (IMPORTER_KINDS.has(k)) {
        let s = fanIn.get(to);
        if (!s) fanIn.set(to, (s = new Set()));
        s.add(from);
      }
    }
  }
  // Name-adjacent tests: a.test.js next to a.js, or test/a.test.js for src/a.js,
  // exact stem only. Never a substring match; that is how the 0.2 tool told an
  // agent app.js was covered by admin.test.mjs.
  const byStem = new Map();
  for (const [f, k] of kinds) if (k === 'test' && !isTestHelper(f, ctx)) {
    const stem = posix.basename(f).replace(/\.(test|spec|tst|e2e)\.[a-z]+$|_test\.[a-z]+$|\.[a-z]+$/g, '').replace(/^test_/, '');
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(f);
  }
  for (const [f, k] of kinds) {
    if (!(k in RANKED_KINDS)) continue;
    const stem = posix.basename(f).replace(/\.d\.ts$|\.[a-z]+$/g, '');
    const cands = byStem.get(stem);
    if (!cands) continue;
    for (const t of cands) {
      // Same top-level area, or a sibling tests dir: keep it local.
      if (topDir(t) === topDir(f) || posix.dirname(t).replace(/\/(tests?|__tests__|specs?)$/, '') === posix.dirname(f)) {
        let s = tests.get(f);
        if (!s) tests.set(f, (s = new Set()));
        s.add(t);
      }
    }
  }
  return { kinds, loc, edges, fanIn, tests, skippedLarge, grepBlind };
}

function topDir(p) {
  const i = p.indexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

// Root-relative URLs in HTML ("/app.js") resolve against the nearest ancestor
// directory that actually contains the target: each site in a monorepo is
// its own web root.
function nearestRootProbe(rel, fromDir, files, dirs) {
  let d = fromDir;
  for (;;) {
    const hit = probe(d === '.' || d === '' ? rel : posix.join(d, rel), files, dirs);
    if (hit) return hit;
    if (d === '.' || d === '' || !d.includes('/')) return null;
    d = posix.dirname(d);
  }
}

/** Submodules from .gitmodules, so the map can say what it could not see. */
export function submodulePaths(root) {
  try {
    const txt = readFileSync(join(root, '.gitmodules'), 'utf8');
    return [...txt.matchAll(/^\s*path\s*=\s*(.+)$/gm)].map((m) => m[1].trim());
  } catch {
    return [];
  }
}
