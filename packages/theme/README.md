# hangfolio

A personal website for researchers and engineers, published on GitHub Pages. This package is the
theme: the design, the pages, the checks behind every error message, and the `hangfolio` command.
You don't install it by hand.

**[Create your site →](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public)**
copies the starter template, which depends on this package. Its README walks you through 5 steps,
all in the browser. Updates to this package then reach your site as a monthly Dependabot pull
request.

- Demo: [hangfolio.github.io/starter](https://hangfolio.github.io/starter/)
- Docs: [github.com/hangfolio/hangfolio/docs](https://github.com/hangfolio/hangfolio/tree/main/docs)
- Help: [discussions](https://github.com/hangfolio/hangfolio/discussions)
- Release notes: [CHANGELOG.md](https://github.com/hangfolio/hangfolio/blob/main/packages/theme/CHANGELOG.md)

## Commands

A site's `package.json` scripts call these; you rarely type them yourself.

| Command | What it does |
|---|---|
| `hangfolio dev` | Previews the site locally and reloads on every edit |
| `hangfolio build` | Checks the site, then builds it into `dist/` |
| `hangfolio preview` | Serves the built `dist/` folder |
| `hangfolio check` | Checks `site.yaml` and `content/`, with the file and line of every problem (`--github` adds annotations and a job summary) |
| `hangfolio verify` | Checks the links, files and addresses in `dist/` |

Needs Node 22.12 or later (22 or 24). MIT licensed.
