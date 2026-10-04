# Fixtures

Test sites that CI builds against the theme. Each fixture is a folder with its own `package.json` (with a `name`, which changesets requires), so npm treats it as a workspace (`fixtures/*`).

- `minimal`: a small site with a CV, a favicon, footer links and one post. `npm run test:e2e` builds it at base `/` and `/hangfolio`.
- `empty`: only `name` and `email`, the two fields every site needs. It must build green, with an initials monogram for the avatar.
- `broken`: not a site but 30+ small cases, each with one mistake and its exact expected messages (`npm run test:golden`; see `broken/README.md`).

Planned: `kitchen-sink` (every field), `project-site`, `user-site` and `owner-like`.

Each site uses the same plumbing files as `starter/` (`astro.config.mjs` and `src/content.config.ts`). The sites use none of the starter's example values, so example mode (SPEC 5.2) hides nothing in them; only some `broken` cases use them on purpose.

Every person, project and paper in a fixture is fictional.
