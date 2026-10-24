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
#
# Output on 2026-10-24, Ubuntu 24.04, Claude Code 2.1.303 native build:
#
#   routes.js: 61440 bytes, NUL at offset 53248
#
#   $ rg -n /api/widgets          (ripgrep 14.1.0)
#     exit:   0
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
#     exit:   0
#     stdout: (empty)
#     stderr: (empty)
#
# What the run shows:
# - ripgrep, searching a directory, prints nothing for the file: no match
#   and no warning. Claude Code's built in copy does the same.
# - ripgrep names the binary file only when the file is named explicitly,
#   and then prints no line.
# - GNU grep prints no line either. It writes one notice to stderr.
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
  out=$("$@" < /dev/null 2> "$dir/err" | cat)
  code=${PIPESTATUS[0]}
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
fi
