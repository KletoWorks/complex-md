#!/usr/bin/env bash
# One NUL byte in a source file: what rg, GNU grep -r and git grep report.
#
# The script builds a temporary git repository with one 60 kB JavaScript
# file. Line 2 holds the string "/api/widgets". Offset 53248 holds one NUL
# byte. Each tool searches the repository for that string, with its output
# piped, as an agent's shell runs it. The script prints the exit code,
# stdout and stderr of each search.
#
# Run: bash bench/repro/nul-byte.sh
#      CLAUDE_BIN=/path/to/claude bash bench/repro/nul-byte.sh
#      CODEX_BIN=/path/to/codex bash bench/repro/nul-byte.sh
#      CURSOR_AGENT_BIN=/path/to/cursor-agent bash bench/repro/nul-byte.sh
#
# Output on 2026-10-24, Ubuntu 24.04, Claude Code 2.1.303 native build,
# Codex CLI 0.164.0 from npm, Cursor agent CLI 2026.10.22-27dcf5f:
#
#   routes.js: 61440 bytes, NUL at offset 53248
#
#   $ rg -n /api/widgets          (ripgrep 14.1.0)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
#   $ rg -n /api/widgets routes.js (the file named on the command line)
#     exit:   0
#     stdout: binary file matches (found "\0" byte around offset 53248)
#     stderr: (empty)
#
#   $ grep -rn /api/widgets .     (grep (GNU grep) 3.11)
#     exit:   0
#     stdout: (empty)
#     stderr: grep: ./routes.js: binary file matches
#
#   $ git grep -n /api/widgets    (git version 2.43.0)
#     exit:   0
#     stdout: routes.js:2:  "/api/widgets": listWidgets,
#     stderr: (empty)
#
#   $ git grep -n -I --text /api/widgets
#     exit:   0
#     stdout: routes.js:2:  "/api/widgets": listWidgets,
#     stderr: (empty)
#
#   $ rg -n /api/widgets          (ripgrep 14.1.1 (rev 0049fd75eb), inside claude.exe)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
#   $ grep -rn /api/widgets .     (ugrep 7.8.4, as Claude Code's shell runs grep)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
#   $ rg -n /api/widgets          (ripgrep 15.2.0 (rev e89fff89ac), the rg on Codex's PATH)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
#   $ Grep tool, content mode       (ripgrep 15.1.0-cursor5 (rev c3e3c2f7ec), next to cursor-agent)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
#   $ Grep tool, files mode         (the same rg with -l)
#     exit:   1
#     stdout: (empty)
#     stderr: (empty)
#
# What the run shows:
# - ripgrep, searching a directory, prints nothing for the file and exits
#   1, the code for "no match". Claude Code's built in copy does the same,
#   and so do the copies that Codex CLI and Cursor's agent CLI ship. The Cursor
#   lines use the arguments its Grep tool builds. Codex runs the rg command
#   its model writes, so the Codex line runs a plain rg -n. The script does
#   not run the agents themselves, because each one needs a login.
# - ripgrep names the binary file only when the file is named explicitly,
#   and then prints no line.
# - GNU grep prints no line either. It writes one notice to stderr.
# - grep in Claude Code's Bash tool is a shell function that runs the
#   ugrep built into claude.exe with -I. It prints nothing and exits 1.
# - git grep prints the line, with and without -I --text. Git looks for a NUL
#   in the first 8000 bytes only, and this NUL sits at offset 53248.
set -u

dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
cd "$dir" || exit 1
mkdir repo
cd repo || exit 1

# Line 2 carries the string. Pad to offset 53248, write one NUL, pad to 60 kB.
printf 'export const routes = {\n  "/api/widgets": listWidgets,\n};\n//' > routes.js
size=$(wc -c < routes.js)
head -c $((53248 - size)) /dev/zero | tr '\0' '/' >> routes.js
printf '\0' >> routes.js
head -c $((61440 - 53249 - 1)) /dev/zero | tr '\0' '/' >> routes.js
printf '\n' >> routes.js

git init -q .
git add routes.js
git -c user.name=repro -c user.email=repro@example.invalid commit -q -m init

echo "routes.js: $(wc -c < routes.js) bytes, NUL at offset" \
  "$(od -An -tx1 -v routes.js | tr -s ' \n' '\n\n' | command grep -n '^00$' | cut -d: -f1 | head -n 1 | awk '{print $1 - 2}')"
echo

search() {
  label=$1
  shift
  # The search writes into a pipe, as in an agent's shell. Its exit code is
  # saved inside the pipe; PIPESTATUS after the assignment would read 0.
  out=$( { "$@" < /dev/null 2> "$dir/err"; echo $? > "$dir/code"; } | cat)
  code=$(cat "$dir/code")
  err=$(cat "$dir/err")
  echo "\$ $label"
  echo "  exit:   $code"
  echo "  stdout: ${out:-(empty)}"
  echo "  stderr: ${err:-(empty)}"
  echo
}

search "rg -n /api/widgets          ($(rg --version | head -n 1))" \
  rg -n /api/widgets
search "rg -n /api/widgets routes.js (the file named on the command line)" \
  rg -n /api/widgets routes.js
search "grep -rn /api/widgets .     ($(command grep --version | head -n 1))" \
  command grep -rn /api/widgets .
search "git grep -n /api/widgets    ($(git --version))" \
  git grep -n /api/widgets
search "git grep -n -I --text /api/widgets" \
  git grep -n -I --text /api/widgets

# Claude Code's native build carries its own ripgrep and runs it for the
# Grep tool by starting its own binary under the name rg. Set CLAUDE_BIN to
# that binary to search with the same copy.
if [ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN" ]; then
  version=$( (exec -a rg "$CLAUDE_BIN" --version) 2>/dev/null | head -n 1)
  case "$version" in
    ripgrep*)
      search "rg -n /api/widgets          ($version, inside $(basename "$CLAUDE_BIN"))" \
        bash -c 'exec -a rg "$0" --no-config -n /api/widgets' "$CLAUDE_BIN"
      ;;
    *) echo "CLAUDE_BIN does not answer as ripgrep; skipped" ;;
  esac
  # In Claude Code's Bash tool, grep is a shell function. It starts the same
  # binary under the name ugrep, with -I among its flags, so binary files
  # are skipped. `type grep` in that shell prints the function.
  version=$( (exec -a ugrep "$CLAUDE_BIN" --version) 2>/dev/null | head -n 1 | cut -d ' ' -f 1-2)
  case "$version" in
    ugrep*)
      search "grep -rn /api/widgets .     ($version, as Claude Code's shell runs grep)" \
        bash -c 'exec -a ugrep "$0" -G --ignore-files --hidden -I --exclude-dir=.git -rn /api/widgets .' "$CLAUDE_BIN"
      ;;
    *) echo "CLAUDE_BIN does not answer as ugrep; grep line skipped" ;;
  esac
fi

# Codex CLI runs its searches as shell commands, and its instructions tell
# the model to prefer rg. It puts a directory with its own ripgrep first on
# the PATH of every command it runs. Set CODEX_BIN to the codex command to
# ask it which rg its commands get, then search with that copy. CODEX_HOME
# points at the temporary directory, so nothing is written to ~/.codex.
if [ -n "${CODEX_BIN:-}" ] && [ -x "$CODEX_BIN" ]; then
  rg_path=$(CODEX_HOME="$dir" "$CODEX_BIN" sandbox -- sh -c 'command -v rg' 2>/dev/null)
  case "$rg_path" in
    */codex-path/rg)
      version=$("$rg_path" --version | head -n 1)
      search "rg -n /api/widgets          ($version, the rg on Codex's PATH)" \
        "$rg_path" -n /api/widgets
      ;;
    *) echo "CODEX_BIN gave no bundled rg (got: ${rg_path:-nothing}); skipped" ;;
  esac
fi

# Cursor's agent CLI ships ripgrep next to its entry point and uses it for
# its Grep tool before any rg on the system. The arguments below are the
# ones the tool builds for a content search with no path, from the CLI's
# index.js (2026.10.22-27dcf5f), less the --cursor-ignore files. Set
# CURSOR_AGENT_BIN to the cursor-agent command.
if [ -n "${CURSOR_AGENT_BIN:-}" ] && [ -x "$CURSOR_AGENT_BIN" ]; then
  rg_path="$(dirname "$(readlink -f "$CURSOR_AGENT_BIN")")/rg"
  if [ -x "$rg_path" ]; then
    version=$("$rg_path" --version | head -n 1)
    search "Grep tool, content mode       ($version, next to cursor-agent)" \
      "$rg_path" --line-number --with-filename --no-heading -0 \
      --max-columns 1000 --max-columns-preview --case-sensitive \
      --sortr modified --no-config --color=never --hidden --follow \
      --regexp /api/widgets -- .
    search "Grep tool, files mode         (the same rg with -l)" \
      "$rg_path" -l --case-sensitive --sortr modified --no-config \
      --color=never --hidden --follow --regexp /api/widgets -- .
  else
    echo "no rg next to $CURSOR_AGENT_BIN; skipped"
  fi
fi
