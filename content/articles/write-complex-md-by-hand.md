<!-- meta
title: How to write a COMPLEX.md by hand
description: The full COMPLEX.md workflow with nothing but git, awk, grep and a text editor: compute the signals, fill the front matter, write the four sections, wire it in.
date: 2026-09-02
updated: 2026-09-04
-->

# How to write a COMPLEX.md by hand

You do not need the CLI or a model to produce a conforming COMPLEX.md. The
signals come from git, the format is small, and writing the prose yourself is
a decent code review of your own repo. Budget half an hour for a mid sized
codebase. The commands below need git, awk, grep and wc. They compute the
history axis the simple way, over twelve months; the [skill](/skill/) carries
the spec 0.3 versions that index by commit and add a dependency graph, and
step 7 says which fields those add.

## Step 1: scope and size

The hotspot table ranks source files. Docs, tests, examples, vendored and
generated code, CI config, lockfiles and manifests are out, because they
otherwise fill the table with a reference page and a `package.json`. Set the
[spec's](/spec/) default exclusion, then count lines per file in scope:

```sh
EX='(^|/)(docs?|tests?|__tests__|specs?|examples?|benchmarks?|fixtures?|vendor|node_modules|dist|build|\.github)/|\.(md|mdx|rst|txt|lock|snap)$|\.(test|spec|tst)\.[a-z]+$|_test\.[a-z]+$|(^|/)(package|package-lock|composer)\.json$|(^|/)(Cargo\.toml|go\.mod|go\.sum|pyproject\.toml|yarn\.lock|pnpm-lock\.yaml)$'
git ls-files | grep -vE '\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|pdf|zip)$' | grep -vE "$EX" \
  | xargs -d '\n' wc -l 2>/dev/null | grep -v ' total$' | awk '{ print $1 "\t" $2 }' > /tmp/cx-loc.tsv
wc -l < /tmp/cx-loc.tsv
```

The count is your `files_analyzed`.

## Step 2: churn, weighted churn, authors, owner share

One pass over twelve months of history, skipping merges and bulk commits
that touch more than 30 files. Each commit counts once toward `churn` and
`0.5 ^ (age in years)` toward `churn_w`, so last week's commit counts one and
last year's counts a half. The same pass counts distinct authors per file
and the top author's share.

```sh
git log --since="12 months ago" --no-merges --name-only --pretty=format:'@%ct %ae' \
  | awk -v now="$(date +%s)" '
    function flush(  i) { if (n == 0 || n > 30) return; w = 0.5 ^ ((now - t) / 31557600)
      for (i = 1; i <= n; i++) { f = fl[i]; c[f]++; cw[f] += w; au[f, a]++
        if (au[f, a] == 1) na[f]++; if (au[f, a] > mx[f]) mx[f] = au[f, a] } }
    /^@/ { flush(); split(substr($0, 2), h, " "); t = h[1]; a = h[2]; n = 0; delete fl; next }
    /./  { fl[++n] = $0 }
    END  { flush(); for (f in c) printf "%d\t%.2f\t%d\t%.2f\t%s\n", c[f], cw[f], na[f], mx[f] / c[f], f }' \
  > /tmp/cx-churn.tsv
```

Columns: `churn`, `churn_w`, `authors`, `owner_share`, path.

## Step 3: fixes

The subset of those commits whose message says it fixes something. Files
fixed before are where the next fix lands; ranking files by past fixes is
the bug prediction Google chose for being as accurate as anything fancier
and easy to explain. Do not match issue numbers: on a squash-merged repo,
`#123` is in every subject and everything becomes a fix.

```sh
FIXRE='(^|[^a-z])(fix(es|ed|ing)?|bug|bugfix|hotfix|regression)([^a-z]|$)'
git log --since="12 months ago" --no-merges --name-only --pretty=format:'@' -i -E --grep="$FIXRE" \
  | awk '
    function flush(  i) { if (n == 0 || n > 30) return; for (i = 1; i <= n; i++) fx[fl[i]]++ }
    /^@/ { flush(); n = 0; delete fl; next }
    /./  { fl[++n] = $0 }
    END  { flush(); for (f in fx) print fx[f] "\t" f }' > /tmp/cx-fixes.tsv
```

Sanity check the share: `git log --oneline --since="12 months ago" -i -E
--grep="$FIXRE" | wc -l` against the total. A third is typical; if it is
nearly everything, your regex is matching something it should not.

## Step 4: score and pick the hotspots

Join size, fixes and churn, drop anything with fewer than three commits,
score each file as `round(churn_w * loc)`, and keep the top 15:

```sh
awk -F'\t' 'FILENAME == ARGV[1] { loc[$2] = $1; next } FILENAME == ARGV[2] { fx[$2] = $1; next }
  ($5 in loc) && $1 >= 3 { printf "%d\t%s\t%d\t%d\t%.2f\t%d\t%d\t%.2f\n", $2 * loc[$5] + 0.5, $5, loc[$5], $1, $2, fx[$5] + 0, $3, $4 }' \
  /tmp/cx-loc.tsv /tmp/cx-fixes.tsv /tmp/cx-churn.tsv | sort -rn | head -15
```

Columns: `score`, path, `loc`, `churn`, `churn_w`, `fixes`, `authors`,
`owner_share`.

In most repos the result is lopsided; a handful of files carry most of the
score. That lopsidedness is the finding. Look at the `authors` and
`owner_share` columns while you are here: a file with 16 authors and a top
share of 0.18 has nobody who owns it; a file with 3 authors and a share of
0.92 has one head holding it. Both are worth a sentence later. And note
which two or three files have the most fixes; that sentence goes in
"Where the risk lives".

## Step 5: co-change

Pairs of files sharing five or more of those commits, same bulk exclusion,
with manifests, lockfiles, CI and tests dropped because those pairs explain
themselves:

```sh
NOISE='(^|/)(package|package-lock)[.]json$|[.]lock$|(^|/)[.]github/|[.](test|spec|tst)[.][a-z]+$|(^|/)tests?/'
git log --since="12 months ago" --no-merges --name-only --pretty=format:'@%h' \
  | awk '
    function emit(  i, j, x, y, s) { if (n == 0 || n > 30) return
      for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) { x = fl[i]; y = fl[j]
        if (x > y) { s = x; x = y; y = s }; p[x "\t" y]++ } }
    /^@/ { emit(); n = 0; delete fl; next }
    /./  { fl[++n] = $0 }
    END  { emit(); for (k in p) if (p[k] >= 5) print p[k] "\t" k }' \
  | awk -F'\t' -v re="$NOISE" '$2 !~ re && $3 !~ re' | sort -rn | head -10
```

Docs stay in: a module that always moves with its reference page is a real
coupling, and the instruction "update the reference page" is exactly what an
agent forgets.

## Step 6: fan-in and covering tests

Count the tracked files that import each hotspot, documentation excluded.
A plain text search is enough; adapt the keyword to your language:

```sh
git grep -lE "(import|require|from)[^;]*[/'\"]hotspot-basename(\.[a-z.]+)?['\"]" -- . ':!*.md' ':!docs/' | wc -l
```

Split the hits in two: test files are `tests` (covering tests), everything
else is `fan_in`. A test that reaches the file counts as coverage, never as
a dependent.

## Step 7: the front matter

Fill the schema from the [spec](/spec/) with your numbers, verbatim. Set
`tool: by-hand`. The honesty rules are the whole point: no rounding beyond
what the commands printed, no leaving out the embarrassing file, no adding a
file you feel should be risky but the numbers say is not.

The shape below is spec 0.3, exactly what the CLI writes. Every key is
required and every list may be empty. The numbers are a real run on
fastify/fastify at `af6e2e43`, cut to one hotspot row and one pair:

```yaml
---
complex_md: "0.3"
generated: 2026-09-02
commit: af6e2e43
tool: by-hand
window_commits: 2000
files_analyzed: 73
profile:
  files_total: 394
  files_in_scope: 73
  loc_in_scope: 12005
  kinds: "test 231, source 67, docs 52, ci 24, generated 9, config 6, other 2, asset 1, data 1, manifest 1"
  languages: "js 49, ts 17, mjs 1"
  dependency_edges: 372
  commits_total: 4426
  commits_analyzed: 1871
  commits_skipped: 129
  half_life_commits: 500
  window_from: 2021-05-25
  window_to: 2026-09-02
  velocity_30d: 31.1
  authors_total: 591
  concentration_50: 3
  hotspot_cut: 6
  pair_min: 10
  confidence: structure+history
hotspots:
  - path: fastify.js
    kind: source
    loc: 1009
    churn: 234
    churn_w: 75.49
    fixes: 53
    authors: 66
    owner_share: 0.44
    fan_in: 24
    tests: 63
    score: 29220
load_bearing:
co_change:
  - files: [fastify.js, lib/route.js]
    count: 39
    coupling: 45
seams:
blind_spots:
  - 9 generated or lock files excluded
---
```

Where each field comes from, when you did the steps above by hand:

- `window_commits` is the number of non-merge commits you read; the steps
  above take twelve months, so put the count of commits in that span here
  (`git rev-list --count --no-merges --since="12 months ago" HEAD`). The
  spec's `window_months` is gone; time is a fact in `profile`, not a field.
- `profile` is what you measured: `files_total` from `git ls-files | wc -l`,
  `files_in_scope` from step 1, `commits_analyzed` after the bulk skip,
  `authors_total` from `git log --format=%ae | sort -u | wc -l`, the window
  dates, and `confidence`. Set `confidence` to `structure+history` when you
  counted fan-in and have 50 or more commits, `structure-only` below that,
  and append `, single author` when one identity committed. Omit a profile
  key only when you did not measure it; never estimate one.
- Each hotspot row carries `kind` (`source`, `config`, `markup` or `style`,
  from step 1), `loc`, the five history columns from steps 2 to 4, `fan_in`
  from step 6, `tests` (the count of test files that import or name the
  file; search your test directory for its basename, exact stem only) and
  `score`.
- `load_bearing` lists rankable files with zero commits in the window and
  five or more dependents, by `fan_in`. `seams` lists directory pairs that
  move together, the co-change measure one level up. Both are empty on this
  run. Their row shapes:

```yaml
load_bearing:
  - path: lib/symbols.js
    kind: source
    loc: 60
    fan_in: 19
    tests: 4
seams:
  - dirs: [lib, types]
    count: 41
    coupling: 38
```

- `blind_spots` is one sentence per thing the analysis could not see:
  submodules, vendored or generated files excluded, a shallow clone, a
  single committer, a fan-in you approximated by text search. If you did
  step 6 with grep, say so here: `dependency graph approximated by text
  search; covering tests by name`.

## Step 8: the four sections

Open your top five hotspot files and actually read them before writing, and
find the test files that cover each (search your test directory for the
file's basename).

**Where the risk lives.** Three to six sentences naming the concentration,
the two or three files where fixes land with their counts, and, where the
columns show it, the ownership pattern. Write sentences that survive being
quoted alone, because that is how an agent will use them.

**Why these files are hot.** One paragraph per top hotspot: what it does, why
it keeps changing, what an edit there tends to break, which tests cover it.
Then the sentence that matters: "Before editing this file," followed by the concrete thing to do.
The test file to run. The partner file to open. The contract to keep. You
know this; it is the tribal knowledge you carry anyway. Agents skim
descriptions and follow instructions, so the paragraph is not finished until
that sentence is there. If you do not know why a file is hot, say so; that
is a finding too.

**Change coupling.** For each kept pair, say whether the coupling is by
design (a schema and its serializer) or by decay (an interface leaking), then
what to open and check when one side changes. If it is decay, the
instruction is how to break it.

**What to read first.** Three to seven files, ordered, each with a clause on
why. This is the section that saves an agent the most time; write it last,
when you have just done the reading yourself.

Keep the whole prose under six hundred words. Commit the file at the repo
root.

## Step 9: wire it in

A map nobody reads is dead weight, and the research is blunt about how a
secondary file gets read: it is referenced from the primary file, imported
where the tool can import, and scoped to the paths it is about. Append the
[integration block](/integration.md) verbatim to whichever of `AGENTS.md`,
`CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` you have. In
`CLAUDE.md`, add a line `@COMPLEX.md` after it so Claude Code loads the map
at launch. If you use Claude Code, Cursor or OpenHands, also write the
path-scoped rule the [spec](/spec/) describes, listing your hotspot paths,
so the four rules reappear the moment an agent opens a hotspot. Do not
reword the block, and do not add emphasis to it; it carries exactly one
emphasized line on purpose, and identical wording across repositories is
what makes it recognizable.

## Regenerate when it stops being true

Note the `commit` field. After a refactor of a listed hotspot, or monthly on
an active repo, rerun the numbers. Weighted churn does some of this for you:
a file that was hot last spring and quiet since falls off the table on its
own. If step 4 hands you a different top five, the prose is stale. The
[skill](/skill/) automates every step above with any coding agent, using the
same commands and the same format.
