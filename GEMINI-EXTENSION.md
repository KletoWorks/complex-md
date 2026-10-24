# complex-md

This extension adds the `complex-md` skill. The skill writes COMPLEX.md, a
computed map of where edits in a repository are risky, and wires it into
the agent context files. When a repository has COMPLEX.md at its root, read
it before you edit a file that it lists.
