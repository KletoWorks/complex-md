# Fixtures for the COMPLEX.md 0.4 draft

Each folder is the root of a repository. It holds a `COMPLEX.md`, or no map,
and an `expected.json` that states what the draft says about the folder. A
reader conforms at Level 1 when it gives the `reader` result for every
folder.

Keep the bytes of these files exact. The folder `crlf` has CRLF line ends,
`bom` starts with a byte order mark, and `oversize` is above the size cap.
The `.gitattributes` file here stops git from changing line ends.

## expected.json

| Key | Meaning |
| --- | --- |
| `description` | What the case tests, in 1 or 2 sentences. |
| `document` | Present when the folder holds a file. `valid` is true when the file is a conforming 0.4 map. `errors` lists the rules the file breaks, as codes. |
| `data` | The front matter as the data that a YAML 1.2 parser returns, with dates as strings. It is null when the file has no front matter. A linter checks this data against `complex-md.schema.json`. |
| `reader` | The result that a conforming reader gives. |

The error codes:

| Code | Rule |
| --- | --- |
| `bom` | The file starts with a byte order mark (section 4). |
| `size` | The file is larger than 8,192 bytes (section 4). |
| `no-front-matter` | The file has no front matter, or the front matter has no closing line (section 5). |
| `no-version` | The front matter has no `complex_md` key (section 10.2). |
| `version` | The front matter is of a version other than 0.4 (section 11). |
| `schema` | The front matter data fails the JSON Schema (section 7). |
| `sections` | A required section is missing, or the sections are out of order (section 8.1). |
| `directive` | A paragraph in "Why these files are hot" has no `Before editing this file,` sentence (section 8.2). |

The keys of `reader`:

| Key | Meaning |
| --- | --- |
| `result` | `map` when the reader reads a map, `invalid` when the file is not a valid map, `absent` when there is no map. |
| `front` | Values the reader returns for the front matter. The reader can return more keys than the list shows. Lists match item by item, and each item can also hold more keys. |
| `sections` | The required sections that the reader finds. |
| `rows` | For each path, true when the reader finds a front matter row for that exact path. |
| `directives` | For each path, the directive that the reader returns, or null when the path has no paragraph. |
