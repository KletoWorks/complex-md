# Contributing

Issues and pull requests are welcome. The spec changes by evidence: a new signal or rule needs a citation or a benchmark run in `bench/`, and a line in `CHANGELOG.md` saying why. Plain prose, no emphasis words, numbers over adjectives; read the spec for the register.

## Ways to contribute

Outside code costs review time, so each kind of contribution has a form
and a test as its bar. Start at the top of the list.

1. [A wrong map](https://github.com/KletoWorks/complex-md/issues/new?template=map-wrong.yml):
   a public repository, the commit, the line of COMPLEX.md that is wrong
   and why. The bar is a fixture or a test that shows the wrong output.
2. [A language module](https://github.com/KletoWorks/complex-md/issues/new?template=new-language.yml):
   the language, 3 public repositories to test on and the import forms to
   resolve. The bar is an edge fixture like the ones in
   `cli/test/resolve.test.js`.
3. [A conformance case](https://github.com/KletoWorks/complex-md/issues/new?template=conformance-case.yml):
   a spec 0.4 fixture in `spec/0.4/fixtures/` with its expected result.
   The bar is the fixture and its entry in `cli/test/spec-fixtures.test.js`.
4. [A spec proposal](https://github.com/KletoWorks/complex-md/issues/new?template=spec-proposal.yml):
   the problem, the proposed text and a benchmark run or a source that
   supports it. The bar is that citation, as `AGENTS.md` says.

A real fix commit for the benchmark has its own
[form](https://github.com/KletoWorks/complex-md/issues/new?template=benchmark-task.yml).
Ask a question in
[Discussions](https://github.com/KletoWorks/complex-md/discussions/categories/q-a).

## AI assistance

You may use AI tools to write a contribution. Three rules apply.

1. Disclose it. When an AI tool helped, say so in the pull request
   description: name the tool and the part it wrote. Tick the box in the
   pull request template.
2. Mark the commits. Add an `Assisted-by:` or a `Co-Authored-By:` trailer
   to each commit the tool helped write. Either form is accepted, for
   example `Assisted-by: <tool and model>`.
3. A person stands behind it. A person reads the whole diff before the pull
   request opens, and the same person answers the review comments. A pull
   request that no person has read is closed.

The same rules hold for a coding agent. `AGENTS.md` sends agents here.

## Releasing

Three things carry a version. The spec version (`complex_md` in every
front matter) changes only when the file format changes. The prompt version
(`prompts/generate.md`) changes when the generation instructions change.
The CLI version (`cli/package.json`) is semver for the package: a fix is a
patch, a new signal or wiring target is a minor, a breaking flag or output
change is a major. A test fails if the spec version disagrees between the
engine, the prompt and the spec page.

To release: add the dated entry to `CHANGELOG.md`, bump `cli/package.json`,
commit, then tag `vX.Y.Z` and push the tag. The release workflow verifies
the tag matches the package, runs the tests and the build, and publishes to
npm with provenance through trusted publishing. Create the GitHub release
from the changelog entry afterward.
