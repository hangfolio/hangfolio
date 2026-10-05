# Notes for coding agents

This repository is its owner's personal website, built with [hangfolio](https://github.com/hangfolio/hangfolio).
It is not the hangfolio project. Work only on this site, for its owner.

## Rules

- **Edit `site.yaml`, `content/` and `public/` only.** Everything else (`package.json`,
  `package-lock.json`, `astro.config.mjs`, `src/content.config.ts`, `.github/`, `.devcontainer/`,
  `index.html`, `.nojekyll`) is plumbing that connects the site to the theme. Files marked
  `hangfolio-plumbing: 1` must stay exactly as they are; `npm run check` reports any that drifted
  and gives the replacement text.
- **Never open issues or pull requests against `hangfolio/*`** (the template or the engine) for
  changes to this site. Questions go to https://github.com/hangfolio/hangfolio/discussions.
- **Validate with `npm run check`** before you finish. It reports every problem at once as
  `file:line:col CODE message`; each code is explained at
  https://github.com/hangfolio/hangfolio/blob/v1/docs/troubleshooting.md.
- **Everything here is public**, including drafts (`draft: true`), papers in preparation, comments
  and git history. Don't add anything the owner hasn't decided to publish.
- **Don't invent facts about the owner.** Write only what they gave you, and keep their wording.
- **Don't add dependencies, components or build steps.** Pages, layout and styles come from the
  theme; `content/custom.css` takes small CSS additions.

## How the content works

- `site.yaml` holds the identity and settings. Only `name` and `email` are required; the template
  also marks `tagline`, `role` and `affiliation` as required because visitors read them first.
- Text values are written in double quotes, so a `: ` inside the text is safe.
- Internal links and file paths are written from the site root (`/projects`, `/files/cv.pdf`); the
  theme adds the base path. Never write the repository name into a link.
- Lines marked `# example` and entries with `example: true` (or `example = {true}` in BibTeX) are the
  starter's demo content. While `name` and `email` are both still the demo person's, the whole demo
  shows with a banner. After that, example entries are hidden until their marker line is deleted,
  and `tagline`, `role`, `affiliation` or `email` still holding example values fail the check (E401).
- Papers are BibTeX in `content/publications.bib`; optional extras go in
  `content/publications/<key>.md`.
- Posts are `content/writing/<slug>.md`, published at `/writing/<slug>/`. Use `.md`, not `.mdx`,
  unless a component is needed.
- The build makes no network requests. Don't add anything that fetches data at build time.

## Commands

Node 22.12 or later.

- `npm install`, then `npm run dev`: a local preview at http://localhost:4321 that reloads on edits.
- `npm run check`: the same checks the deploy runs.
- `npm run build`: builds the site into `dist/` (not committed).

Every push runs **Deploy site** on GitHub, which checks, builds and publishes the default branch.
Docs: https://github.com/hangfolio/hangfolio/tree/v1/docs
