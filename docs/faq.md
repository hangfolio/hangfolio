# FAQ

## Is everything in my repository public?

Yes. In a public repository anyone can read every file and every past version of it, including:

- posts marked `draft: true` (they're left off the site, not hidden from the repository);
- papers in preparation, and comments in `publications.bib`;
- files in `public/` that no page links to;
- your commit history, even after you delete a file.

Only commit what you're happy to publish. Don't put private notes, reviews, grades, or anything you
were given in confidence in the repository.

## Can I make the repository private?

On GitHub's free plan, Pages only publishes public repositories; the deploy says so if yours is
private. Paid plans can publish from a private repository, but the published site is still public.

## Can I fork the template instead?

Please don't. Forks have GitHub Actions turned off, so the site never builds, and they stay linked to
the template. Use [Create your site](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public),
which makes an independent copy that's yours.

## What does it cost?

Nothing, for a public repository: GitHub Pages and the Actions minutes the deploy uses are free. A
custom domain costs whatever your registrar charges.

## Why does my site say "This is an example site"?

`name` and `email` in `site.yaml` are both still the demo person's. Change both: the banner goes away,
the example content is hidden, and search engines may index your site.

## My entry doesn't show up

It is probably still marked as an example; delete its `example: true` line (or `example = {true},` in
BibTeX). See [W403](troubleshooting.md#w403).

## Can I delete the example files?

Yes, whenever you like: example entries you don't want, `public/example/`, and the comments. Keep
`site.yaml` and the plumbing files (`package.json`, `astro.config.mjs`, `src/`, `.github/`).

## How do I add a page that isn't in the list?

Not yet. Writing your own pages arrives in a later version. Meanwhile, a post under `content/writing/`
or a link to another site in the menu (`nav` in `site.yaml`) covers most needs.

## Does the build fetch anything from the internet?

No. Your site is built from the files in your repository only: no Google Scholar lookups, no citation
counts. That keeps every build reproducible and fast.

## Does the site track visitors?

No. The theme adds no analytics, cookies or third-party scripts. The only exception is the booking
page, which loads Cal.com's scheduler when you set `booking.calcom`; use `booking.link` to link out
instead.

## Can I use a host other than GitHub Pages?

The site is plain files in `dist/`, so it can be hosted anywhere. Set `url` in `site.yaml` to its
address. Only GitHub Pages is tested and documented.

## Where do I get help?

Search [troubleshooting](troubleshooting.md) for the code in your message first. Then ask in the
[hangfolio discussions](https://github.com/hangfolio/hangfolio/discussions), with a link to your
repository and to the failing run. Please don't open issues or pull requests about your own site on
`hangfolio/starter`.
