# Fixtures

Test sites that CI builds against the theme. Each fixture is a folder with its own `package.json` (with a `name`, which changesets requires), so npm treats it as a workspace (`fixtures/*`).

- `minimal`: a small site with a CV, a favicon, footer links and one post. `npm run test:e2e` builds it at base `/` and `/hangfolio`.
- `empty`: only `name` and `email`, the two fields every site needs. It must build green, with an initials monogram for the avatar.
- `kitchen-sink`: every field filled in, so every component renders: the hero with a photo, availability and booking, four results, a featured project for each exhibit (terminal, metrics, bars, install), the research section with a featured paper from `content/publications.bib` and its extras file, experience (dates, `when` terms, a count that cuts the list) with the education lines, news, posts (one a draft) and the contact section. `npm run test:e2e` builds it at both bases and checks the home page in Chrome, including text contrast in both themes.
- `owner-like`: a fictional site with the same home page shape as the reference design the theme comes from: the same sections in the same order, the same item counts (four results, four featured projects with a terminal, metrics and bars, a research block with three approach steps and a featured paper, five jobs, three education lines, four news items, two posts) and about the same text lengths. It also sets the generic options that site needs (pinned anchors, the publication's anchors, a `/work-experience` path, a redirect, a time zone, a title suffix, a Google verification file, `booking.keepPageWhenOff`, a `minutes` pin, and its own `robots.txt` and `images/manifest.json`). `npm run test:e2e` checks it and builds it at both bases, and `npm run test:a11y` runs axe on it. The owner's local fidelity check compares its home page with the reference design.
- `broken`: not a site but 30+ small cases, each with one mistake and its exact expected messages (`npm run test:golden`; see `broken/README.md`).

Planned: `project-site` and `user-site`.

Each site uses the same plumbing files as `starter/` (`astro.config.mjs` and `src/content.config.ts`). The sites use none of the starter's example values, so example mode (SPEC 5.2) hides nothing in them; only some `broken` cases use them on purpose.

Every person, project and paper in a fixture is fictional.
