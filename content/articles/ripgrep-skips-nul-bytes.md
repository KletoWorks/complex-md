<!-- meta
title: ripgrep skips a file with one NUL byte, and says nothing
description: One NUL byte makes ripgrep skip a source file in a directory search, with no line and no warning. Claude Code, Codex CLI and Cursor's agent all search with a copy of ripgrep.
date: 2026-10-24
draft: true
-->

# ripgrep skips a file with one NUL byte, and says nothing

Put one NUL byte anywhere in a source file. Search the folder with ripgrep.
The file does not appear in the output, and ripgrep does not say why. It
exits 1, the code for "no match". Claude Code, OpenAI's Codex CLI and
Cursor's agent CLI each ship a copy of ripgrep, and each copy does the same.

## Three commands

Run these in an empty folder:

```sh
printf 'export const route = "/api/widgets";\n\0' > routes.js
rg /api/widgets; echo "exit $?"
grep -r /api/widgets .; echo "exit $?"
```

The output on Ubuntu 24.04, with ripgrep 14.1.0 and GNU grep 3.11:

```text
exit 1
grep: ./routes.js: binary file matches
exit 0
```

ripgrep prints nothing. The file has the string on line 1, and the NUL
byte is the last of its 38 bytes. GNU grep prints no line either, but it
writes one notice to stderr and exits 0, so a reader knows that a file
matched.

Name the file, and ripgrep admits that it found something:

```text
$ rg /api/widgets routes.js
binary file matches (found "\0" byte around offset 37)
$ rg --text /api/widgets
routes.js:export const route = "/api/widgets";
```

ripgrep decides that a file with a NUL byte is binary. When it finds a file
by walking a folder, it reads the file in blocks. It stops at the first
block that holds a NUL byte and prints nothing from that block or after it.
It prints a match from an earlier block, with a warning. In our runs of
ripgrep 14.1.0 a block was 64 KiB, so a source file smaller than that
vanishes whole. When you name the file, ripgrep prints a notice and no
line. `--text` searches the file as text and prints the line.

## What each agent's search runs

A person who sees an empty result may try again. An agent takes the empty
result as the answer. So the question is which search each agent runs. We
looked at three on 2026-10-24.

| agent | version | what searches | ripgrep copy | result for the file |
|---|---|---|---|---|
| Claude Code | 2.1.303 | the Grep tool | ripgrep 14.1.1 inside `claude.exe` | nothing, exit 1 |
| Claude Code | 2.1.303 | `grep` in the Bash tool | ugrep 7.8.4 inside `claude.exe`, run with `-I` | nothing, exit 1 |
| Codex CLI | 0.164.0 | `rg` in its shell | ripgrep 15.2.0, first on its PATH | nothing, exit 1 |
| Cursor agent CLI | 2026.10.22-27dcf5f | the Grep tool | ripgrep 15.1.0-cursor5, next to its entry point | nothing, exit 1 |

**Claude Code.** The Grep tool runs the ripgrep that is built into the
`claude.exe` binary. In the Bash tool, `grep` is not GNU grep. It is a
shell function, and `type grep` prints it. The function starts the same
binary as ugrep with `-I`, a flag that skips binary files. So in Claude
Code, both `grep -r` and the Grep tool print nothing for the file.

**Codex CLI.** Codex searches with shell commands that its model writes.
Its instructions say: "When searching for text or files, prefer using `rg`
or `rg --files` respectively because `rg` is much faster than alternatives
like `grep`." The npm package carries ripgrep 15.2.0 in a folder named
`codex-path`. `codex sandbox -- sh -c 'command -v rg'` prints that copy,
because Codex puts its folder first on PATH.

**Cursor.** The agent CLI looks for `rg` next to its own entry point first,
then in `/usr/bin` and the other usual places. The package carries ripgrep
15.1.0-cursor5 there. Its Grep tool builds the ripgrep arguments in
`index.js`: line numbers, file names, a column cap, `--hidden`,
`--follow`, a sort by modification time and the pattern. No argument tells
ripgrep to search binary files. We ran that copy with those arguments.

We did not run the agents themselves, because each one needs a login. We
ran each agent's own copy of the search, with the arguments that agent
passes. A Codex model can also choose `grep` or `git grep`. Its
instructions point it to `rg`.

## How a NUL byte gets into source code

Nobody types a NUL byte. It arrives as a separator or a placeholder that
someone meant to write as the escape `\0` or `\u0000`, and an editor or a
generator wrote the raw byte instead. The code still runs, because the byte
sits inside a string literal.

The case that started this was a module of about 60 kB with one NUL byte
at offset 53248, a map key separator. An agent was asked whether an HTTP
route existed in that package. It searched for the route, the handler and
the feature name, and nothing matched. It reported the endpoint as missing
and proposed to build it. The endpoint existed, in the one file that every
search had skipped.

complex-md's own repository had one too. In release 0.10.0,
`cli/src/resolve.js` turned `**` in a glob into a placeholder, a raw NUL,
before it built a regular expression. `rg -n '^export' cli/src/` printed 89
lines from 19 of the 20 files in the folder. The 8 exports in
`cli/src/resolve.js` were missing. `git grep -n -I --text '^export' --
cli/src/` printed all 97. The fix writes the placeholder as an escape.

## What it means for coding agents

An empty search result looks the same whether the code is absent or
unreadable. ripgrep gives the agent no notice and exit code 1, which is
also what it gives when the code is absent. An agent that greps before it
edits can then:

- report that a function, route or setting does not exist;
- write a second copy of code that already exists;
- rename a symbol and miss the uses in that file;
- change a function and miss the caller in that file, which then breaks.

The transcript shows a search, an empty result and a sound conclusion from
it. Nothing in it says that one file was not read.

## How COMPLEX.md lists these files

COMPLEX.md is a computed map of where edits are risky in a repository. It
also lists what the analysis could not see, under `blind_spots`. The
generator reads each source file up to 1 MB in full, not only its first
block. When a file holds a NUL byte, the map names the file in one
sentence. This is the sentence it wrote for complex-md's own repository at
release 0.10.0:

```yaml
blind_spots:
  - "1 source file contains a NUL byte, so ripgrep, which Claude Code's Grep tool runs, skips it with no match and no warning, and GNU grep prints a binary file notice and no line: cli/src/resolve.js. Search with git grep -I --text, and fix the byte: it is almost always a separator that should have been written as an escape."
```

In that map, the prose under "Where the risk lives" said it again. An
agent that reads the map before it searches learns which file its search
cannot reach, and how to reach it: `git grep -I --text`, or `rg --text`.

To check your repository, run `npx complex-md` and read `blind_spots`. To
find the files by hand, list the tracked source files that hold a NUL
byte:

```sh
git grep -l -P '\x00' -- '*.js' '*.ts' '*.py' '*.go' '*.rb' '*.rs' '*.java' '*.php'
```

On complex-md at release 0.10.0, it printed one path:
`cli/src/resolve.js`.

## Run it yourself

[bench/repro/nul-byte.sh](https://github.com/KletoWorks/complex-md/blob/main/bench/repro/nul-byte.sh)
builds a 60 kB file with the NUL byte at offset 53248 and runs ripgrep,
GNU grep and git grep on it. Point it at an agent to run that agent's copy:

```sh
CLAUDE_BIN=/path/to/claude.exe \
CODEX_BIN=/path/to/codex \
CURSOR_AGENT_BIN=/path/to/cursor-agent \
  bash bench/repro/nul-byte.sh
```

The script writes into a temporary folder and deletes it at exit. It needs
no login and makes no network request.
