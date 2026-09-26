---
alwaysApply: false
paths: prompts/generate.md
---
# prompts/generate.md

Not ranked in COMPLEX.md. It is here because it moves with a file that is.

cli/src/generate.js writes the front matter, builds the prompt bundle, makes the model call and validates the reply before anything touches COMPLEX.md. Six commits, two of them fixes, because each provider or output edge case lands here. The bin and bench/run.mjs depend on it, and frontMatter's key order is the contract that parseFrontMatter in cli/src/complexmd.js reads back. cli/test/basic.test.js, cli/test/generate.test.js and cli/test/mcp.test.js cover it. Before editing this file, keep frontMatter and REQUIRED_SECTIONS aligned with cli/src/complexmd.js and prompts/generate.md, and run cli/test/generate.test.js.

Moves with:
- skill/SKILL.tmpl.md (100% of this file's commits, 4 together)

Open the partner and say in the change description whether it needed a change too.

**Before editing this file, keep frontMatter and REQUIRED_SECTIONS aligned with cli/src/complexmd.js and prompts/generate.md, and run cli/test/generate.test.js.**
