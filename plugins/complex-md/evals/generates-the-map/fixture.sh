#!/usr/bin/env bash
# A small Node repository with 7 commits, 3 of them fixes, so the map has a
# hotspot (src/parse.js) and a co-change pair (src/parse.js, test/parse.test.js).
set -euo pipefail
git init -q
git config user.email eval@example.com
git config user.name eval
mkdir -p src test
printf '{\n  "name": "fixture",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
printf 'export function parse(s) {\n  return s.split(",");\n}\n' > src/parse.js
printf 'import { parse } from "./parse.js";\nexport const run = (s) => parse(s).length;\n' > src/index.js
printf 'import { test } from "node:test";\nimport assert from "node:assert";\nimport { parse } from "../src/parse.js";\ntest("parse", () => assert.deepEqual(parse("a,b"), ["a", "b"]));\n' > test/parse.test.js
git add -A && git commit -q -m "feat: parse a comma list"
for i in 1 2 3; do
  printf 'export function parse(s) {\n  // fix %s\n  return s.split(",").map((x) => x.trim()).filter(Boolean);\n}\n' "$i" > src/parse.js
  printf '// case %s\n' "$i" >> test/parse.test.js
  git add -A && git commit -q -m "fix: parse edge case $i"
done
for i in 1 2; do
  printf '// note %s\n' "$i" >> src/index.js
  git add -A && git commit -q -m "chore: index note $i"
done
printf '# fixture\n' > README.md
git add -A && git commit -q -m "docs: readme"
