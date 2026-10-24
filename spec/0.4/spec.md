# COMPLEX.md format 0.4 (draft)

Status: draft. This text can change until 0.4 is final. Spec 0.3 at
<https://complex.md/spec> stays the current version until then.

This document defines the COMPLEX.md file format: where the file lives, what
its front matter holds, which prose sections it has, and what a program that
reads the file must do. It does not define how a tool computes the numbers or
how a tool wires the file into an agent. The note
[cli-note.md](cli-note.md) describes what the reference CLI does, and that
note is not normative.

The machine readable part of this document is
[complex-md.schema.json](complex-md.schema.json), a JSON Schema (draft
2020-12) for the front matter. The folder [fixtures/](fixtures/) holds
example files with the result that a conforming reader gives for each.

## 1. Conventions

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD
NOT, RECOMMENDED, NOT RECOMMENDED, MAY and OPTIONAL in this document are to
be interpreted as described in BCP 14 (RFC 2119 and RFC 8174) when, and only
when, they appear in all capitals.

Terms:

- **Map**: a file named `COMPLEX.md` that follows this document.
- **Producer**: a program or a person that writes a map.
- **Reader**: a program that reads a map, for example a hook, a review bot,
  a linter or an agent tool.
- **Repository root**: the top directory of the git working tree.
- **Path**: a file path relative to the repository root.

## 2. Conformance

This document defines three conformance targets.

1. A **conforming map** meets every MUST in sections 3 to 9.
2. A **conforming producer** writes only conforming maps.
3. A **conforming reader** meets every MUST in section 10 and section 11.

A reader is conforming at Level 1 when it gives the expected result for
every fixture in [fixtures/](fixtures/). Later versions add Level 2 (the
history numbers) and Level 3 (the structure numbers). Level 1 tests only the
document and the reader, not the numbers.

## 3. File location

1. A map MUST be a file named `COMPLEX.md`, with this exact case.
2. A repository's main map MUST be at the repository root.
3. A repository MAY hold more maps for workspaces, as section 12 defines.
4. A producer MUST NOT write the map under another name, for example
   `complex.md` or `.complex.md`.

## 4. Encoding and size

1. A map MUST be UTF-8 text.
2. A producer MUST NOT write a byte order mark.
3. A producer SHOULD end lines with LF. A map with CRLF line ends is still a
   conforming map, because a Windows checkout converts LF to CRLF by default.
4. A map MUST NOT be larger than 8,192 bytes, front matter and prose
   together. Agents read the whole file into their context, and a long file
   costs every session that loads it.
5. A producer that cannot fit the map in 8,192 bytes SHOULD cut list rows
   from the end and shorten the prose. It MUST NOT drop a REQUIRED key or a
   REQUIRED section to fit.

## 5. Document structure

A map has two parts, in this order:

1. The front matter: a line `---`, the front matter lines, and a line `---`.
2. The prose: every line after the closing `---`.

The first line of the file MUST be `---`. The front matter ends at the first
later line that is exactly `---`.

## 6. Front matter syntax

The front matter is a restricted form of YAML 1.2. Every front matter that
follows these rules is also valid YAML 1.2, so a reader MAY use a YAML
library. The restriction exists so that a reader without a YAML library can
parse every conforming map.

### 6.1 Lines

Each line between the fences MUST have one of these forms. The indent is
spaces only, never tabs.

| Form | Indent | Example |
| --- | --- | --- |
| Top level key and value | 0 | `commit: "6be919f"` |
| Top level key that opens a block | 0 | `hotspots:` |
| Map entry inside a block | 2 | `  confidence: "structure+history"` |
| List item that is a scalar | 2 | `  - "one committer identity"` |
| List item that is a map, first key | 2 | `  - path: cli/src/signals.js` |
| List item that is a map, next key | 4 | `    churn: 8` |

A block MUST hold at least 1 line. A block holds map entries only, scalar
list items only, or map list items only.

The front matter MUST NOT contain blank lines, comments, tabs, anchors,
aliases, tags, multi line scalars or deeper nesting than the table shows.

### 6.2 Values

1. A value is a scalar or a flow list.
2. A flow list is `[` and `]` around scalars separated by `, `. The empty
   list is `[]`.
3. A flow list MAY appear as a top level value, as a map entry value and as
   the value of a key inside a list item. It MUST NOT appear as a scalar list
   item.
4. A scalar is plain or double quoted. A double quoted scalar uses the
   escapes of a JSON string.
5. A plain scalar MUST NOT be empty, and MUST NOT start or end with a space.
6. A plain scalar MUST NOT start with any of these characters:
   `[` `]` `{` `}` `,` `#` `&` `*` `!` `|` `>` `'` `"` `%` `@` and the
   backtick. It MUST NOT start with `- `, `? ` or `: `.
7. A plain scalar MUST NOT contain `: ` or ` #`, and MUST NOT end with `:`.
8. Inside a flow list, a plain scalar MUST NOT contain `,`, `[`, `]`, `{`
   or `}`.
9. A string that YAML 1.2 would read as a number, a boolean or null in plain
   form MUST be double quoted. Examples: `"1234567"`, `"1e5"`, `"true"`,
   `"null"`. A producer SHOULD also double quote `yes`, `no`, `on` and
   `off`, because YAML 1.1 libraries read them as booleans.
10. A number is an integer `-?[0-9]+` or a decimal `-?[0-9]+\.[0-9]+`, with
    no leading zero before another digit. A producer MUST NOT write an
    exponent.
11. A date is `YYYY-MM-DD`, plain or double quoted.

### 6.3 Keys

1. A key defined by this document is lower case letters, digits and
   underscores, and starts with a letter.
2. An extension key starts with `x-`. Section 9 defines extension keys.
3. In a list item map, the first key MUST be the item's identity key:
   `path` for `hotspots`, `load_bearing` and `workspaces`, `files` for
   `co_change` and `dirs` for `seams`.
4. A key MUST NOT appear twice in the same map.

## 7. Front matter keys

### 7.1 Top level keys

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `complex_md` | string | yes | The spec version the map follows. For this version the value is `"0.4"`, double quoted. |
| `generated` | date | yes | The date of the newest analyzed commit. |
| `commit` | string | yes | The abbreviated or full sha of the analyzed commit: 7 to 64 lower case hex characters, double quoted. |
| `generator` | map | yes | The producer. Section 7.2. |
| `window_commits` | integer | yes | The number of most recent non merge commits analyzed, before bulk commits are left out. |
| `files_analyzed` | integer | yes | The number of rankable files. |
| `profile` | map | yes | The shape of the repository. Section 7.3. |
| `hotspots` | list of maps | yes | At most 15 rows. Section 7.4. |
| `load_bearing` | list of maps | yes | At most 5 rows. Section 7.5. |
| `co_change` | list of maps | yes | At most 10 rows. Section 7.6. |
| `seams` | list of maps | yes | At most 6 rows. Section 7.6. |
| `blind_spots` | list of strings | yes | One sentence per thing the analysis could not see. |
| `stale_after` | date | no | The date after which a reader SHOULD treat the map as stale. |
| `verified` | date | no | The date a person or a tool last checked the prose against the front matter and the code. |
| `prose` | map | no | Who wrote the prose. Section 7.7. |
| `workspaces` | list of maps | no | The workspace maps. Section 12. |

Rules:

1. A conforming map MUST hold every REQUIRED key.
2. An empty list MUST be written `[]`. A producer MUST NOT write a list key
   with no value, because YAML reads that as null.
3. The `commit` value MUST be double quoted. About 4 percent of 7 character
   shas are all digits, and YAML reads an unquoted all digit sha as a
   number.
4. A producer that changes the prose after the date in `verified` MUST
   remove `verified` or set it to the new check date.
5. A producer SHOULD write the top level keys in the order of the table.

### 7.2 `generator`

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | The producer's name, for example `complex-md`. A map written by hand uses `by-hand`. |
| `version` | string | no | The producer's version, for example `0.10.0`. A program SHOULD write it. |
| `url` | string | no | A URL where a reader can learn about the producer. |

### 7.3 `profile`

`confidence` is REQUIRED. Every other key is OPTIONAL. A producer SHOULD
write every key it computed.

| Key | Type | Meaning |
| --- | --- | --- |
| `files_total` | integer | Tracked files. |
| `files_in_scope` | integer | Rankable files. |
| `loc_in_scope` | integer | Lines in the rankable files. |
| `kinds` | string | File counts per kind, for example `"source 39, test 29"`. |
| `languages` | string | File counts per extension, for example `"js 22, mjs 13"`. |
| `dependency_edges` | integer | Dependency edges the producer resolved. |
| `commits_total` | integer | Non merge commits in the history. |
| `commits_analyzed` | integer | Commits in the window that the analysis used. |
| `commits_skipped` | integer | Commits in the window that the analysis left out. |
| `half_life_commits` | integer | The half life of the recency weight, in commits. |
| `window_from` | date | The date of the oldest commit in the window. |
| `window_to` | date | The date of the newest commit in the window. |
| `velocity_30d` | number | Commits per 30 days across the window. |
| `authors_total` | integer | Distinct committer identities in the window. |
| `concentration_50` | integer | How many files hold half of the total score. |
| `hotspot_cut` | integer | How many hotspot rows the producer kept. |
| `pair_min` | integer | The fewest shared commits a co-change pair needs. |
| `confidence` | string | One of `structure+history`, `structure-only`, `history-only` or `size-only`, with `, single author` appended when one committer identity made every commit. |

### 7.4 `hotspots` rows

The rows MUST be in descending order of `score`.

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `path` | string | yes | The file. |
| `kind` | string | yes | `source`, `config`, `markup` or `style`. Only these kinds rank. |
| `loc` | integer | yes | Lines in the file. |
| `churn` | integer | yes | Analyzed commits that touched the file. |
| `churn_w` | number | yes | Churn with each commit weighted by its recency. A producer SHOULD write 2 decimals. |
| `fixes` | integer | yes | Commits that touched the file and whose message says they fix a bug. |
| `authors` | integer | yes | Distinct committer identities on the file. |
| `owner_share` | number | yes | The busiest committer's share of the file's commits, from 0 to 1. |
| `fan_in` | integer | yes | Files that depend on the file. |
| `tests` | integer | yes | Test files that reach the file. |
| `score` | integer | yes | The sort key. |
| `test_files` | list of strings | no | The paths of the test files that `tests` counts, as a flow list. |

### 7.5 `load_bearing` rows

The rows MUST be in descending order of `fan_in`.

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `path` | string | yes | The file. |
| `kind` | string | yes | As for hotspots. |
| `loc` | integer | yes | Lines in the file. |
| `fan_in` | integer | yes | Files that depend on the file. |
| `tests` | integer | yes | Test files that reach the file. |
| `test_files` | list of strings | no | As for hotspots. |

### 7.6 `co_change` and `seams` rows

The rows MUST be in descending order of `count`.

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `files` (co_change) or `dirs` (seams) | list of 2 strings | yes | The 2 paths, as a flow list. The 2 values MUST differ. A `dirs` value is a directory path with no trailing slash. |
| `count` | integer | yes | Analyzed commits that touched both. |
| `coupling` | integer | yes | The percentage of the quieter side's commits that also touched the other side, from 0 to 100. |

### 7.7 `prose`

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `by` | string | yes | `template` when a program filled fixed sentences, `model` when a language model wrote the prose, `human` when a person wrote or rewrote it. |

### 7.8 Path values

Every path value in the front matter MUST meet these rules:

1. It is relative to the repository root, also in a workspace map.
2. It uses `/` between segments.
3. It does not start with `/` or `./`, and has no `..` segment.
4. It does not end with `/`.
5. Its case is the case that git records for the file.
6. A path appears at most once across `hotspots` and `load_bearing`.

### 7.9 The numbers

Spec 0.3 defines how the reference method computes each number. Spec 0.4
does not change those definitions. A producer that computes a number by
another method MUST say so in `blind_spots`. Level 1 conformance checks the
types of the numbers, not their values.

## 8. Prose sections

### 8.1 Required sections

The prose MUST hold these 4 level 2 headings, each on its own line, with
this exact text, in this order:

1. `## Where the risk lives`
2. `## Why these files are hot`
3. `## Change coupling`
4. `## What to read first`

Rules:

1. A section runs from its heading to the next line that starts with `## `,
   or to the end of the file.
2. Inside a section, a producer MUST NOT start a line with `## `, also
   inside a code block.
3. A producer MAY add more sections after the 4 required sections. A reader
   ignores them.
4. A producer SHOULD NOT write text between the closing `---` and the first
   heading.
5. A section with nothing to say MUST still be present. It SHOULD say so in
   1 sentence.
6. The prose SHOULD stay under 600 words in total.

### 8.2 Section content

1. **Where the risk lives** SHOULD hold 3 to 6 sentences that each stand
   alone when quoted: the kind of code where risk concentrates, the files
   with the most `fixes` and their counts, and the load bearing files if
   there are any.
2. **Why these files are hot** holds 1 paragraph per hotspot, for at most 5
   hotspots, in the order of the `hotspots` list. A paragraph is a block of
   lines with a blank line before and after it.
   - Each paragraph SHOULD name its file by the full path in its first
     sentence.
   - Each paragraph MUST contain a sentence that starts with
     `Before editing this file,`. That sentence and the text after it in the
     paragraph are the directive. The directive MUST name a concrete action:
     a test file or a command to run, a file to open, or a contract to keep.
3. **Change coupling** SHOULD hold 1 paragraph per cluster of coupled files.
   Each paragraph SHOULD end with an imperative sentence that says what to
   open or check when one side changes.
4. **What to read first** SHOULD be an ordered list of 3 to 7 items, each a
   path and a reason.

### 8.3 Prose and the profile

1. When `confidence` starts with `structure-only` or `size-only`, the first
   sentence of "Where the risk lives" SHOULD say that the ranking rests on
   size and dependents.
2. When `confidence` ends with `single author`, the prose SHOULD NOT discuss
   ownership.
3. When a hotspot has `tests: 0`, its paragraph SHOULD say that no test
   reaches it, and its directive SHOULD say how to verify a change.

## 9. Extension keys

1. A producer MAY add keys that start with `x-` in any map of the front
   matter: at the top level, in `profile`, `generator` and `prose`, and in
   any list item map.
2. An extension key SHOULD name its producer, for example `x-acme-owner`.
3. An extension key at the top level MAY hold a block. Inside a block, an
   extension key holds a scalar or a flow list, as section 6 requires.
4. No version of this specification will define a key that starts with
   `x-`.
5. Any other key that this document does not define is reserved for later
   versions. A producer MUST NOT write one.

## 10. Reader requirements

### 10.1 Finding the file

1. A reader MUST look for the file `COMPLEX.md` with this exact name at the
   repository root.
2. When the file is absent, the reader MUST report that there is no map and
   MUST NOT fail the operation it is part of. A hook, for example, lets the
   edit through.
3. A reader SHOULD report "no map" and "not a valid map" as 2 different
   results.

### 10.2 Reading the text

1. A reader MUST ignore a byte order mark at the start of the file.
2. A reader MUST accept LF and CRLF line ends.
3. A reader MUST read a file larger than 8,192 bytes. A linter SHOULD
   report the size.
4. When the first line is not `---`, or no closing `---` line follows, the
   file is not a valid map.
5. When the front matter has no `complex_md` key, the file is not a valid
   map.
6. A reader that finds a file that is not a valid map MUST NOT fail the
   operation it is part of.

### 10.3 Reading the front matter

1. A reader MUST ignore every key that it does not know, at every level.
   This includes extension keys and keys from a later version.
2. A reader MUST treat a list key with a null value, or a missing list key,
   as the empty list.
3. A reader MUST read the value of a string field as a string, also when the
   value has the form of a number. A plain `commit: 1234567` is the string
   `"1234567"`.
4. A reader MUST read a date as the string `YYYY-MM-DD`. A reader that uses a
   YAML 1.1 library MUST turn a date object back into that string.
5. A reader MUST decode the JSON escapes in a double quoted scalar.
6. A reader MUST NOT fail on a value of the wrong type. It SHOULD skip a list
   row whose identity key is not a string.

### 10.4 Matching paths

1. A reader MUST compare a path from the front matter with a file path as an
   exact string, with case.
2. Before the comparison, the reader MUST turn the file path into a path as
   section 7.8 defines: relative to the repository root, `/` between
   segments, and no leading `./`.
3. A reader MUST NOT match a front matter path by a prefix, a suffix or a
   case insensitive comparison.

### 10.5 Reading the prose

1. A reader MUST find a section by its exact heading text. It MAY ignore
   spaces at the end of the heading line.
2. A missing section reads as empty. A reader MUST NOT fail on it.
3. A reader splits a section into paragraphs at blank lines, and reads each
   line break inside a paragraph as 1 space.
4. A paragraph names a path when the path occurs in it with no path
   character directly before or after it. Path characters are letters,
   digits and `_ @ . / + ~ $ -`. A `./` directly before the path is allowed.
   A `.` directly after the path ends a sentence, and so does not count as a
   path character, when no letter or digit follows it.
5. The paragraph of a path is the paragraph in "Why these files are hot"
   that names the path closest to the paragraph's start. On a tie, the
   earlier paragraph wins. A reader MAY also match a suffix of the path that
   no other path in the map shares, but a paragraph that names the full path
   MUST win over one that names only a suffix.
6. The directive of a path is the text of its paragraph from
   `Before editing this file,` to the end of the paragraph. When the
   paragraph has no such sentence, the directive is the paragraph's last
   sentence.

## 11. Versioning and compatibility

1. The value of `complex_md` is `MAJOR.MINOR`, as a string.
2. The spec version changes only when the file format changes. A new
   release of a producer does not change it.
3. Before 1.0, a new minor version MAY make a breaking change.
4. From 1.0, a new minor version only adds OPTIONAL keys, OPTIONAL sections
   or looser rules. Any other change needs a new major version.
5. A breaking change is a change that makes a conforming map of the earlier
   version nonconforming, changes the meaning of a key, or makes a conforming
   reader of the earlier version misread a map of the new version.
6. A producer MUST write the version whose rules it follows.
7. A reader MUST read a map of its own major version with any minor version.
   Before 1.0, a reader MUST read maps of 0.3 and every later 0.x version.
8. A reader that finds a map of a newer version MUST read the keys it knows
   and ignore the rest, as section 10.3 requires. It MAY report the version.
9. A reader that finds a map of a later major version SHOULD read the keys it
   knows. It MAY refuse the map, and then MUST treat it as not a valid map.

### 11.1 Reading a 0.3 map

A 0.4 reader MUST read a 0.3 map with these changes:

1. When `generator` is absent and `tool` is present, the reader MUST read
   `tool` as `generator`. The text before the first `/` is `name`, and the
   text after it is `version`. `tool: by-hand` gives the name `by-hand` and
   no version.
2. A list key with no value is the empty list, as section 10.3 requires.

## 12. Workspaces

A monorepo MAY hold 1 map for each workspace in addition to the root map.

1. A workspace is a directory below the repository root that holds its own
   `COMPLEX.md`.
2. The root map MUST list every workspace map in `workspaces`. Each item has
   1 key, `path`: the workspace directory as section 7.8 defines.
3. Every path in a workspace map is relative to the repository root, not to
   the workspace. A reader then matches paths the same way in every map.
4. A workspace map MUST NOT hold `workspaces`.
5. To find the map for a file, a reader that supports workspaces MUST take
   the listed workspace with the longest `path` that is a directory prefix of
   the file's path. When no workspace matches, it MUST take the root map.
6. A reader MUST NOT look for workspace maps that the root map does not
   list.
7. A reader that does not support workspaces reads the root map only.

## 13. Changes from 0.3

1. RFC 2119 key words. The CLI behaviour moved to a separate note.
2. `generator`, a map, replaces `tool`.
3. An empty list is `[]`, never a key with no value.
4. `commit` is double quoted. Strings in the form of a number are double
   quoted.
5. The front matter is a defined YAML subset (section 6).
6. A size cap of 8,192 bytes.
7. Extension keys with the `x-` prefix. Other unknown keys are reserved.
8. OPTIONAL keys: `stale_after`, `verified`, `prose`, `test_files` and
   `workspaces`.
9. In `profile`, only `confidence` is REQUIRED. `size-only` is a defined
   `confidence` value.
10. Each paragraph in "Why these files are hot" MUST hold the directive
    sentence.
11. Reader requirements, versioning rules and workspaces are new.
