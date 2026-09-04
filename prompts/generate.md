---
prompt_version: 0.3.0
spec_version: "0.3"
---

# COMPLEX.md generation prompt

You are writing a COMPLEX.md file for a repository. COMPLEX.md tells a coding
agent where the structural risk in this codebase lives and what to do before
touching it, so the agent edits with judgment instead of discovering the hard
parts by accident. Follow spec 0.3 (https://complex.md/spec) exactly.

The map is built on two axes. Structure comes from the working tree: what
each file is, and which files depend on it. History comes from the most
recent commits, counted by commit rather than by calendar, so a repository
built in six weeks reads the same as one built over six years. Both axes are
computed; you interpret them and write the instructions.

## Inputs you receive

1. A signals table: up to 30 rows, one per rankable file, with columns
   `path`, `kind` (source, config, markup or style; tests, docs, data,
   manifests, generated and vendored files are never ranked), `loc`,
   `churn` (commits touching the file in the window, bulk commits over 30
   files excluded), `churn_w` (the same commits weighted by
   `0.5 ^ (age_in_commits / half_life)`, two decimals), `fixes` (the subset
   whose message says it fixes something), `authors`, `owner_share` (the top
   committer's share, 0 to 1), `fan_in` (files that depend on it through an
   import, a script or link tag, a stylesheet import or a path reference in
   a script or config; tests are not counted here), `tests` (test files that
   reach it), and `score`. Rows arrive sorted by score, highest first.
2. A load-bearing list: files nobody touched in the window that many files
   depend on. They are not hotspots; they are the floor everyone stands on.
3. A co-change list: pairs of files that appear in the same commits, with the
   count and `coupling`, the percentage of the quieter file's commits that
   also touched the other. Convention files (a changelog updated with every
   change) are already excluded. Then directory seams: the same measure one
   level up, for areas that move together although the individual files
   differ each time (a schema directory and a compose file).
4. The raw text of the top 5 to 10 hotspot files, or excerpts when a file is
   large, and for each the tests that cover it and a sample of its
   dependents.
5. A repository profile: kinds and languages, dependency edges, history depth
   and velocity, committer count, how concentrated the score is, the hotspot
   cut, and a confidence line. Then blind spots: what the analysis could not
   see (submodules, vendored code, shallow history, a single committer).

## Output

Emit only the complete COMPLEX.md file: YAML front matter, then prose. No
preamble, no explanation of what you did, no code fence around the whole file.

### Front matter

Copy the computed front matter verbatim. It is provided in full; do not
invent, round, reorder or adjust anything in it. Its shape:

```yaml
---
complex_md: "0.3"
generated: <YYYY-MM-DD>
commit: <short sha>
tool: <generator/version>
window_commits: <int>
files_analyzed: <int>
profile:
  <key>: <value>            # as provided
hotspots:
  - path: <path>
    kind: <source|config|markup|style>
    loc: <int>
    churn: <int>
    churn_w: <decimal>
    fixes: <int>
    authors: <int>
    owner_share: <decimal>
    fan_in: <int>
    tests: <int>
    score: <int>
load_bearing:
  - path: <path>
    kind: <kind>
    loc: <int>
    fan_in: <int>
    tests: <int>
co_change:
  - files: [<path a>, <path b>]
    count: <int>
    coupling: <percent>
seams:
  - dirs: [<area a>, <area b>]
    count: <int>
    coupling: <percent>
blind_spots:
  - <sentence>
---
```

### Prose sections

Four sections, all required, in this order. Selective over complete: bloat is
the failure mode. If a section has nothing worth saying, say so in one
sentence rather than padding.

The rule that matters most: agents skim descriptions and follow instructions.
Every hotspot paragraph and every coupling paragraph ends with one imperative
sentence that names a concrete action. A paragraph that only describes is
not finished.

Read the profile before writing. It changes what you say:

- If `confidence` is `structure-only`, say so in the first sentence: the
  ranking rests on size and dependents, and churn, fixes and ownership will
  mean something once the repository has history. Do not describe a file as
  "frequently changed" on a repository with twelve commits.
- If `authors_total` is 1, do not discuss ownership at all. The columns are
  present because the spec requires them; on this repository they carry
  nothing.
- If `tests` is 0 for a hotspot, say so plainly and make the instruction
  about how to verify instead of which test to run.
- If a blind spot names submodules or vendored code, one sentence in the
  first section says the map does not cover them.

`## Where the risk lives`
Three to six sentences naming where change risk concentrates and what kind of
code it is (routing, state, serialization, a public API and its types, the
deployment contract). One sentence says where bug fixes land: the two or
three files with the highest `fixes`, with their counts. One sentence names
the load-bearing files if any: what depends on them and that nobody touches
them. Where the numbers show it and more than one person committed, name the
ownership pattern. An agent should be able to quote any single sentence and
have it stand alone.

`## Why these files are hot`
One short paragraph for each of the top hotspots you actually read, at most
five. Say what the file does, why it keeps changing (and how many of its
commits were fixes, when that is a large share), what depends on it and so
what an edit there tends to break, and which test files cover it. Ground
every claim in the file text or the numbers. Then end the paragraph with one
sentence beginning "Before editing this file," that names the concrete
action: the test file or command to run, the partner file to open alongside
it, the contract or invariant to preserve, the dependents to check. Pick the
action the file text supports; do not invent test commands you did not see.
Do not describe files you were not given.

`## Change coupling`
Explain the co-change clusters and seams that matter: which files or areas
move together, whether the coupling is by design (a schema and its
serializer, a page and its stylesheet, a registry and the edge config that
reads it) or by decay (an interface leaking, a constant duplicated). Use the
coupling percentage as the strength of the claim. End each cluster with one
imperative sentence: what to open and check when one side changes. When the
coupling is by decay, the instruction is how to break it, not how to obey it.
Skip pairs that are trivially explained.

`## What to read first`
An ordered list, three to seven entries, for an agent entering this repo cold:
the files to read before editing anything hot, each with a clause on why.
Load-bearing files belong here when they exist.

## Style

Plain, direct prose. Short sentences a search engine or an agent can quote
whole. No hedging, no marketing, no "this file is important because it is
important" circularity. No emphasis words (IMPORTANT, MUST, NEVER) anywhere
in the map: emphasis works only when a single line carries it, and that line
is already spent in the wiring block that points agents here. Name files by
their repo relative path. Total prose under 700 words.
