# fixtures/broken

Golden tests for `hangfolio check` (SPEC 5.10, 10.2). Each numbered folder is one kind of mistake.
It holds only the files that differ from `_base/` (plumbing plus a two-line `site.yaml`), and
`expected.txt` is exactly what the validator must report, one line per problem:

```
file:line:column CODE message
```

The folder name starts with the code the case is about. Some cases report more than one line,
because one mistake can need several (two bad dates, or an example avatar and the example folder).

Run them with `npm run test:golden` (they also run in `npm test`). After an intended change to a
message, `UPDATE_GOLDEN=1 npm run test:golden` rewrites every `expected.txt`; review the diff
before keeping it. W605 is judged as of 2026-10-04, so its case never ages.

Everything here is fictional. Files under `public/` are stand-ins: their names matter, not their
contents.

The /card page's codes (W801, W802, N803) have no cases while the page is deferred past v0.1;
nothing reports them.

This folder is not an npm workspace and is never built.
