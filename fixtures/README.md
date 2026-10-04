# Fixtures

Test sites that CI builds against the theme. Each fixture is a folder with its own `package.json` (with a `name`, which changesets requires), so npm treats it as a workspace (`fixtures/*`).

- `minimal`: a small site with a CV, a favicon, footer links and one post. `npm run test:e2e` builds it at base `/` and `/hangfolio`.

Planned: `empty` (name and email only), `kitchen-sink` (every field), `project-site`, `user-site`, `broken` (bad inputs with golden error messages) and `owner-like`.

Each fixture uses the same plumbing files as `starter/` (`astro.config.mjs` and `src/content.config.ts`).

Every person, project and paper in a fixture is fictional.
