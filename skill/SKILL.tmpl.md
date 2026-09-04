---
name: complex-md
description: Generate COMPLEX.md for the current repository. Computes hotspot signals from the dependency graph and git history locally, writes the file per the COMPLEX.md spec, and wires it into the repo's agent context files. Use when asked to generate, update, or check COMPLEX.md.
---

# complex-md skill (spec {{SPEC_VERSION}}, prompt {{PROMPT_VERSION}})

You are inside a git repository. Produce a `COMPLEX.md` at the repository root
that conforms to spec {{SPEC_VERSION}} (https://complex.md/spec). Work in
three stages: compute the signals with the shell, write the file with the
generation prompt at the end of this document, then wire the file into the
repository's agent context files. All three stages are one job; do not stop
after the file is written.

## Stage 1: compute the signals

The CLI is the reference implementation of the analysis: it builds a
dependency graph of the working tree (imports, script and link tags,
stylesheet imports, shell and Caddy includes, path literals in scripts and
configs), reads the last 2,000 commits, classifies every file by kind, and
writes the front matter itself so no number passes through a model. Prefer
it whenever Node 18 or newer is available:

```sh
npx -y complex-md generate --agent --no-wire
```

This runs locally, calls no model, and writes two files: `.complex-md/prompt.md`,
the generation prompt with every input filled in (front matter, signals
table, load-bearing files, co-change pairs and seams, the profile and blind
spots, the text of the top hotspot files with their dependents and covering
tests), and `.complex-md/front-matter.yaml`. Read `.complex-md/prompt.md`
and go to Stage 2. Set `tool` to `complex-md-skill/{{PROMPT_VERSION}}`.

### Fallback without Node

When `npx` is not available, compute the history axis with git and awk and
approximate the structural axis with grep. Say so: set `tool` to
`complex-md-skill/{{PROMPT_VERSION}} (shell)` and add the blind spot
`dependency graph approximated by text search; covering tests by name` to
the front matter. Scratch files go in `/tmp`.

1. Kinds and scope. Rankable files are source, config, markup and style;
   tests, docs, data, manifests, CI, generated, vendored and binary files are
   not ranked. As one extended regex over the repo relative path, the files
   to drop:

```sh
EX='(^|/)(docs?|tests?|__tests__|specs?|e2e|examples?|benchmarks?|fixtures?|testdata|vendor|node_modules|third[_-]?party|dist|build|out|coverage|generated|\.github|\.circleci)/|\.(md|mdx|rst|txt|adoc|lock|snap|map|min\.js|min\.css|json|csv|ndjson|xml|png|jpe?g|gif|svg|ico|woff2?|ttf|pdf|zip)$|\.(test|spec|tst|e2e)\.[a-z]+$|_test\.[a-z]+$|(^|/)test[_-]?[a-z0-9]*\.[a-z]+$|(^|/)(package|composer|tsconfig[^/]*|jsconfig)\.json$|(^|/)(Cargo\.toml|go\.mod|go\.sum|pyproject\.toml|setup\.py|Gemfile|pom\.xml|CHANGELOG[^/]*|LICENSE[^/]*)$'
```

2. Lines of code per rankable file; the row count is `files_analyzed`:

```sh
git ls-files | grep -vE "$EX" | xargs -d '\n' wc -l 2>/dev/null | grep -v ' total$' \
  | awk '{ print $1 "\t" $2 }' > /tmp/cx-loc.tsv
wc -l < /tmp/cx-loc.tsv
```

3. History over the last 2,000 non-merge commits (or all of them), skipping
   bulk commits over 30 files. Weighted churn gives each commit
   `0.5 ^ (age_in_commits / half_life)` with `half_life = max(50, N / 4)`.
   Fixes are commits whose message matches the fix pattern; do not match
   issue numbers. Output columns: `churn`, `churn_w`, `fixes`, `fixes_w`,
   `authors`, `owner_share`, `path`.

```sh
N=$(git rev-list --count --no-merges HEAD); [ "$N" -gt 2000 ] && N=2000
HL=$(( N / 4 )); [ "$HL" -lt 50 ] && HL=50
FIXRE='(^|[^a-z])(fix(es|ed|ing)?|bug|bugfix|hotfix|regression)([^a-z]|$)'
git log -n "$N" --no-merges --name-only --pretty=format:'@%ae%x09%s' \
  | awk -F'\t' -v hl="$HL" -v fixre="$FIXRE" '
    function flush(  i, w) { if (n == 0 || n > 30) return; w = 0.5 ^ (idx / hl)
      for (i = 1; i <= n; i++) { f = fl[i]; c[f]++; cw[f] += w; au[f, a]++
        if (isfix) { fx[f]++; fw[f] += w }
        if (au[f, a] == 1) na[f]++; if (au[f, a] > mx[f]) mx[f] = au[f, a] } }
    /^@/ { flush(); idx++; a = substr($1, 2); isfix = (tolower($2) ~ fixre); n = 0; delete fl; next }
    /./  { fl[++n] = $0 }
    END  { flush(); for (f in c) printf "%d\t%.2f\t%d\t%.2f\t%d\t%.2f\t%s\n", c[f], cw[f], fx[f] + 0, fw[f] + 0, na[f], mx[f] / c[f], f }' \
  > /tmp/cx-churn.tsv
```

   Record `window_commits` (`$N`), `commits_total`, the first and last commit
   dates in the window, and the committer count
   (`git log -n "$N" --no-merges --format=%ae | sort -u | wc -l`).

4. Co-change pairs among rankable files and docs, excluding convention files
   (any file in more than a quarter of the commits, and changelogs), with
   `coupling` = shared commits over the quieter file's commits, in percent.
   Keep pairs with at least `max(3, min(10, N / 150))` shared commits and
   coupling of 34 or more, top 10 by count. Output: `count`, `coupling`,
   `path a`, `path b`.

```sh
PM=$(( N / 150 )); [ "$PM" -lt 3 ] && PM=3; [ "$PM" -gt 10 ] && PM=10
git log -n "$N" --no-merges --name-only --pretty=format:'@' \
  | grep -vE '(^|/)(CHANGELOG|CHANGES|HISTORY|NEWS)[^/]*$|\.(test|spec|tst)\.[a-z]+$|_test\.[a-z]+$|(^|/)(tests?|__tests__|\.github|node_modules|vendor|dist|build)/|\.(lock|json|snap|map|png|jpe?g|svg)$' \
  | awk -v pm="$PM" '
    function emit(  i, j, x, y, s) { if (n == 0 || n > 30) return; commits++
      for (i = 1; i <= n; i++) cnt[fl[i]]++
      for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) { x = fl[i]; y = fl[j]
        if (x > y) { s = x; x = y; y = s }; p[x "\t" y]++ } }
    /^@/ { emit(); n = 0; delete fl; next }
    /./  { fl[++n] = $0 }
    END  { emit(); for (k in p) { split(k, ab, "\t"); if (cnt[ab[1]] > commits / 4 || cnt[ab[2]] > commits / 4) continue
      q = cnt[ab[1]] < cnt[ab[2]] ? cnt[ab[1]] : cnt[ab[2]]; cp = int(100 * p[k] / q + 0.5)
      if (p[k] >= pm && cp >= 34) print p[k] "\t" cp "\t" k } }' \
  | sort -rn | head -10 > /tmp/cx-pairs.tsv
```

5. Fan-in and covering tests for the candidate rows (files with at least
   three commits), by text search. Count files whose import, require, script
   or link statement names the file, excluding docs and tests; count tests
   separately. This approximates the graph; the CLI resolves paths.

```sh
awk -F'\t' '$1 >= 3 { print $7 }' /tmp/cx-churn.tsv | while read -r path; do
  b=$(basename "$path" | sed -E 's/\.(d\.ts|[^.]+)$//')
  hits=$(git grep -lE "(import|require|from|include|source|href=|src=)[^;]*[/'\"<]$b(\.[a-z.]+)?['\">]" -- . ':!*.md' ':!*.mdx' ':!*.rst' ':!*.txt' ':!docs/' 2>/dev/null | grep -vx "$path" || true)
  fi=$(printf '%s\n' "$hits" | grep -vcE '(^|/)(tests?|__tests__|specs?)/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$|^$' || true)
  te=$(printf '%s\n' "$hits" | grep -cE '(^|/)(tests?|__tests__|specs?)/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$' || true)
  printf '%s\t%s\t%s\n' "$path" "$fi" "$te"
done > /tmp/cx-fanin.tsv
```

6. The table. Kind weight is 1 for source and config, 0.8 for `.html` and
   templates, 0.5 for stylesheets. Score each row as
   `round(10 * log2(1 + loc) * sqrt(churn_w + 0.5 * fixes_w + 0.5) * (1 + log2(1 + fan_in))^2 * kind_weight)`,
   keep files with at least three commits or at least five dependents, sort
   by score, keep the top 30; the hotspot list is the rows scoring at least a
   tenth of the top row, between 5 and 15. Output columns: `score`, `path`,
   `kind`, `loc`, `churn`, `churn_w`, `fixes`, `authors`, `owner_share`,
   `fan_in`, `tests`.

```sh
awk -F'\t' 'function l2(x) { return log(x) / log(2) }
  FILENAME == ARGV[1] { loc[$2] = $1; next } FILENAME == ARGV[2] { fi[$1] = $2; te[$1] = $3; next }
  ($7 in loc) && ($1 >= 3 || fi[$7] + 0 >= 5) {
    k = "source"; w = 1; if ($7 ~ /\.(css|scss|sass|less)$/) { k = "style"; w = 0.5 }
    else if ($7 ~ /\.(html?|njk|hbs|ejs|liquid|twig|erb)$/) { k = "markup"; w = 0.8 }
    else if ($7 ~ /\.(ya?ml|toml|ini|conf|caddy|sql|env)$|(^|\/)(Caddyfile|Dockerfile|Makefile)/) k = "config"
    s = 10 * l2(1 + loc[$7]) * sqrt($2 + 0.5 * $4 + 0.5) * (1 + l2(1 + fi[$7] + 0)) ^ 2 * w
    printf "%d\t%s\t%s\t%d\t%d\t%.2f\t%d\t%d\t%.2f\t%d\t%d\n", s + 0.5, $7, k, loc[$7], $1, $2, $3, $5, $6, fi[$7] + 0, te[$7] + 0 }' \
  /tmp/cx-loc.tsv /tmp/cx-fanin.tsv /tmp/cx-churn.tsv | sort -rn | head -30 > /tmp/cx-table.tsv
```

   Rankable files with zero commits in the window and five or more dependents
   are `load_bearing`, not hotspots; list up to five by fan-in if step 5 found
   any. Leave `seams` empty in the shell path.

7. Record the short sha (`git rev-parse --short HEAD`) and the date of the
   newest commit (`git log -1 --format=%cs`). Fill `profile` with what you
   measured: `files_total` (`git ls-files | wc -l`), `files_in_scope`,
   `commits_total`, `commits_analyzed`, `window_from`, `window_to`,
   `authors_total`, `hotspot_cut`, `pair_min`, and `confidence`:
   `structure-only` when fewer than 50 commits were analyzed, otherwise
   `structure+history`, with `, single author` appended when one identity
   committed. Add a blind spot for each of: submodules (`.gitmodules`), a
   shallow clone, a single committer, and the text-search approximation.

8. Read the full text of the top 5 to 10 files by score. If a file exceeds
   about 1500 lines, read its first 400 lines plus its list of exported
   symbols. Keep the total input for stage 2 under about 15k tokens.

## Stage 2: write the file

Follow the generation prompt below exactly, using `.complex-md/prompt.md`
(or the signals and file text you computed by hand) as its inputs, and
write the result to `COMPLEX.md` in the repository root. The front matter is
copied verbatim from the tool's output; only `tool` changes, to
`complex-md-skill/{{PROMPT_VERSION}}`. Do not add sections the spec does not define. Every hotspot
paragraph and every coupling paragraph ends with an instruction; check that
before you save.

## Stage 3: wire it in for priority

A risk map no agent reads is dead weight. Stage 3 is part of generation, not
an optional extra: perform it in the same run, without asking for
permission. The user asked for a COMPLEX.md; wiring their agent files to use
it is what that request means. The mechanism follows the evidence on what
makes a secondary context file get followed: reference it from the primary
file, import it where the tool supports imports, and scope a rule to the
hotspot paths so the directives reappear at the moment a hotspot is touched.

1. Primary files. Check for `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
   `.github/copilot-instructions.md`. For every one that exists and does not
   already contain the heading "COMPLEX.md: the structural risk map", append
   the block below at the end, separated by one blank line. Change nothing
   else in those files. If none exist, create `AGENTS.md` containing only the
   block.
2. Claude Code import. In `CLAUDE.md` only, if the file does not already
   contain a line `@COMPLEX.md`, add that line on its own directly after the
   block. This loads the whole map at session start.
3. Claude Code rule. If `.claude/` exists, write `.claude/rules/complex-md.md`
   (create the directory if needed), overwriting any previous version:

```markdown
---
alwaysApply: false
paths: <every hotspot, load_bearing and co_change path, deduplicated, comma separated, unquoted, on this one line>
---
<the block>
```

   The `paths` line must be a single unquoted comma separated line; the YAML
   list form does not load in current Claude Code.

4. Cursor rule. If `.cursor/` exists, write `.cursor/rules/complex-md.mdc`
   (create the directory if needed), overwriting any previous version:

```markdown
---
description: COMPLEX.md structural risk map
globs: <the same paths, comma separated>
alwaysApply: false
---
<the block>
```

5. OpenHands rule. If `.openhands/` or `.agents/` exists, write
   `.agents/skills/complex-md.md` (create the directory if needed),
   overwriting any previous version. OpenHands injects it the first time the
   agent touches a matching file, at zero baseline cost:

```markdown
---
name: complex-md
paths:
  - "<one hotspot, load_bearing or co_change path per line, quoted>"
---
<the block>
```

   Windsurf (`.windsurf/`), Cline (`.clinerules/`) and Roo (`.roo/`) rule
   files are written by the CLI only: run `npx -y complex-md wire`.

6. Hooks and the MCP server. Rules are advisory; the research puts
   compliance near half when an agent edits existing code late in a session.
   Hooks make the two rules that matter deterministic, and the MCP server
   lets the agent query the map mid-task. If `npx` is available, run
   `npx -y complex-md wire`: it performs steps 1 to 5 idempotently and adds
   the hooks and MCP registration below. Otherwise write them by hand,
   merging into any existing file rather than replacing it:

   `.claude/settings.json` (when `.claude/` or `CLAUDE.md` exists):

```json
{ "hooks": {
  "PreToolUse": [{ "matcher": "Edit|Write|MultiEdit|NotebookEdit",
                   "hooks": [{ "type": "command", "command": "npx -y complex-md hook pre", "timeout": 30 }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "npx -y complex-md hook stop", "timeout": 60 }] }] } }
```

   `.mcp.json` at the root (same condition), and `.cursor/mcp.json` when
   `.cursor/` exists:

```json
{ "mcpServers": { "complex-md": { "command": "npx", "args": ["-y", "complex-md", "mcp"] } } }
```

   `.cursor/hooks.json` when `.cursor/` exists:

```json
{ "version": 1, "hooks": {
  "preToolUse": [{ "command": "npx -y complex-md hook cursor-pre", "matcher": "Write|StrReplace|Edit|MultiEdit|SearchReplace|Delete", "timeout": 30 }],
  "stop": [{ "command": "npx -y complex-md hook cursor-stop", "timeout": 60, "loop_limit": 1 }] } }
```

   The PreToolUse hook denies the first edit of a hotspot per session and
   returns the file's paragraph as the reason; the Stop hook refuses to end
   the turn once if a hotspot was touched or a co-change partner left
   unchanged. Both are once per session and can be set to `--mode warn`.

7. Report what you wrote: the path of `COMPLEX.md`, each primary file the
   block was appended to, each rule file, and whether hooks and MCP were
   installed.

Do not paraphrase, trim, or restyle the block; identical wording across
repositories is what makes it recognizable and quotable. The block carries
exactly one emphasized line, on purpose: Anthropic's guidance is that
emphasis works when one line has it and stops working when many do. Do not
add a second. The block:

```markdown
{{INTEGRATION_BLOCK}}
```

---

{{GENERATE_PROMPT}}
