# Notes for coding agents

This is the hangfolio engine: the theme package, the starter template, test fixtures and docs. The owner, Harris Ahmad, reviews and commits all work.

If `internal/` exists (it is local only and never committed), read `internal/SPEC.md`, `internal/PLAN.md` and `internal/DECISIONS-owner.md` before starting. The decisions file wins where they disagree.

## Hard rules

1. **Never push, publish or touch accounts.** Do not run `git push`, `gh repo create`, `npm publish`, or anything else that creates or changes something on GitHub or npm. Do not commit either: leave changes in the working tree for the owner.
2. **Keep the denylist out of what we publish.** The owner keeps a private list of distinctive terms in `~/.config/hangfolio/denylist`. None of them may appear in tracked files, commit messages or commit metadata (except under `internal/`, which is gitignored). Untracked files such as `node_modules` and build output don't count, so normal dependencies are fine. Never copy, quote or summarise the list. The pre-push hook (below) checks every pushed commit and is a safety net, not permission to be careless.
3. **Only fictional people.** The design comes from the owner's own website, but never copy his personal content here: his name (outside `LICENSE` and this file), bio, projects, research, papers, email, photos or résumé. The demo person and every fixture person are invented.
4. **The owner's site is read-only.** You may read his site repository (`harris-ahmad/harris-ahmad.github.io`, checked out next to this repo at `../portfolio/harris-ahmad.github.io`) for code, design tokens and structure. Never modify it. If you need to build it, copy it to a scratch directory outside both repositories first.
5. **Node 22 and npm.** Node 22.12 or later; use npm, not pnpm, yarn or bun.
6. **No browser downloads.** For browser tests use `playwright-core` (or `puppeteer-core`) with the installed Google Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS). Never run `playwright install` or let a package fetch its own browser.
7. **Small, readable files.** Add comments only where the code is not obvious.

## GitHub Pages naming rule

Any repository under the owner's personal account, `harris-ahmad`, that has Pages turned on is served at `harrisahmad.dev/<repo>/`. A repository named after a path the site already serves (`projects`, `writing`, `contact`, `about` and so on) would shadow that page. So never create, rename or enable Pages on a repository under `harris-ahmad` whose name matches any path `harrisahmad.dev` serves. Check the live site's top-level paths before suggesting a name.

hangfolio itself lives in its own GitHub organization, `hangfolio`, which avoids the problem: the engine is `hangfolio/hangfolio`, the template is `hangfolio/starter`, and the demo is served at `hangfolio.github.io`. Creating anything there is still the owner's job (rule 1).

## Layout

| Path | What it is |
|---|---|
| `packages/theme` | the npm package `hangfolio`, which also provides the `hangfolio` command |
| `starter` | the files every new site starts from; synced to the template repository on release |
| `fixtures/*` | test sites, each its own npm workspace |
| `docs` | public documentation; `docs/decisions` holds spike notes |
| `.changeset` | pending release notes ([changesets](https://changesets.dev)) |
| `.githooks/pre-push` | blocks pushes that contain a denylist term |

## Commands

- `npm install`: install the workspace.
- `npm run build`: runs `npm run -ws --if-present build`; must exit 0.
- `npm test`: the theme's unit and render tests (`packages/theme/test/*.test.ts`, run by `node --test`). Render tests turn components into HTML through Astro's container API (`test/render.ts`).
- `npm run schema -w packages/theme`: rewrites the JSON Schemas in `packages/theme/schema/` from the zod schemas in `packages/theme/src/schema/` (the build does this too). They are committed, and `npm test` fails while they are stale.
- `npm run starter-values -w packages/theme`: rewrites `packages/theme/starter-values.json` (the example values and entry hashes that example mode compares against) from `starter/`. The build does this too; it is committed, and `npm test` fails while it is stale. Run it after any change to `starter/`.
- `npm run test:golden`: the golden messages for every case in `fixtures/broken` (also part of `npm test`). `UPDATE_GOLDEN=1 npm run test:golden` rewrites them; review the diff.
- `npm run test:starter-scenario`: copies the starter into `.tmp/`, changes `site.yaml` in steps and checks example mode (also part of `npm run test:e2e`). End-to-end tests put their site copies in `.tmp/` (gitignored) so they resolve `hangfolio` from the workspace.
- `npx hangfolio check` (inside a fixture or the starter): the same checks the build runs, with file:line messages; `--github` adds annotations and a job summary.
- `npm run test:e2e`: builds `fixtures/minimal`, `fixtures/empty` and `fixtures/kitchen-sink` at base `/` and `/hangfolio`, checks the output, runs the starter scenario, and runs the theme-toggle, dev-overlay and home-page tests (layout, reduced motion, text contrast in both themes) in the installed Chrome (set `CHROME_PATH` if it is not at the macOS default).
- `npm run test:a11y`: runs axe-core in the installed Chrome on every page of `fixtures/kitchen-sink`, `fixtures/owner-like` (once it exists) and the starter in demo mode, in light and dark at 375 and 1280 px; any violation fails.
- `npm run test:screenshots`: screenshots the kitchen-sink home page at 375, 768, 1280 and 1440 px in light and dark and compares them with the committed PNGs in `packages/theme/test/screenshots/baseline/`. A failure writes the new screenshot and a diff to `.tmp/screenshots/`. After a reviewed design change, `UPDATE_SCREENSHOTS=1 npm run test:screenshots` rewrites the baselines. They match exactly only on the Chrome version and OS in `baseline/taken-with.json`; elsewhere up to 0.1% of pixels may differ.
- `npx hangfolio dev --ignore-lock` (inside a fixture): a foreground dev server. Without `--ignore-lock`, Astro moves `dev` and `preview` into the background when it detects a coding agent; stop those with `npx hangfolio dev stop` or `npx hangfolio preview stop`.
- `npx changeset`: record a change to the published package.
- `git config core.hooksPath .githooks`: turn on the pre-push hook in a fresh clone.
