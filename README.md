# hangfolio

**A personal website for researchers and engineers, live on GitHub Pages in about 10 minutes, all
in the browser.**

## [**Create your site →**](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public)

**[See the live demo](https://hangfolio.github.io/starter/)** · [Docs](docs/README.md) ·
[Help in Discussions](https://github.com/hangfolio/hangfolio/discussions)

You copy a template, edit one settings file and a `content/` folder in GitHub's own editor, and every
commit is checked, built and published for you. Nothing to install, no URLs to type.

## What you get

- **Results first.** Your name, role and headline results open the page, then projects, papers,
  experience, news and posts. Sections you leave empty disappear.
- **Light and dark.** The site follows each visitor's system setting and has a toggle. Text meets
  WCAG AA contrast in both themes.
- **Publications from a pasted BibTeX.** Paste from Google Scholar or your reference manager. Your
  name is underlined in every author list, and each paper gets its links and its BibTeX.
- **Clear error messages.** A mistake stops the run with the file, the line and the fix, shown on
  the line itself in your commit. Your live site stays as it was until a run succeeds.
- **Works at any GitHub Pages address:** `username.github.io`, `username.github.io/any-name/` or
  your own domain, with nothing to configure.
- **Monthly one-click updates.** Dependabot opens a pull request when there's a new version. It
  builds your site first; if it's green, you click **Merge pull request**.

## Your site in 5 steps

1. **Create your copy.** Click [Create your site](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public).
2. **Name it.** `<username>.github.io` for `https://<username>.github.io/`, or any other name for
   `https://<username>.github.io/<name>/`. Keep it **Public** and click **Create repository**.
3. **Turn on GitHub Pages.** **Settings → Pages**, then set **Source** to **GitHub Actions**.
4. **Make it yours.** Edit `site.yaml` (name, tagline, role, affiliation, email, links) and commit.
5. **Open your site.** About 2 minutes later, the **Deploy site** run links to it.

The [starter's README](starter/README.md#your-site-in-5-steps) has every step with the exact buttons,
and it comes with your copy. It also covers moving from an existing `username.github.io` site.

## How it compares

- [academicpages](https://github.com/academicpages/academicpages.github.io) and
  [al-folio](https://github.com/alshedivat/al-folio) are Jekyll sites you copy whole, theme included.
  hangfolio's theme is an npm package, so your repository holds only your settings, your content and
  a few small connector files.
- Updating academicpages or al-folio means merging the upstream repository's changes into your
  copy. hangfolio's updates arrive as a Dependabot pull request that builds your own site before
  you merge it.
- Both have years of use and large communities, and al-folio has many more features (Jupyter and
  distill posts, a CV page and more). hangfolio is new and does less: a results-first design, BibTeX
  publications, and checks that explain themselves to people who don't build websites.

## Docs

- [Quickstart](docs/quickstart.md): the 5 steps in detail
- [Editing your site](docs/editing.md) and the [site.yaml reference](docs/site-yaml.md)
- [Publications](docs/publications.md): BibTeX, Google Scholar, extras
- [Custom domain](docs/custom-domain.md), [Updating](docs/updating.md), [Customizing](docs/customizing.md)
- [Moving an existing site](docs/existing-site.md) from academicpages or al-folio
- [Troubleshooting](docs/troubleshooting.md): every message code, and GitHub Pages problems
- [FAQ](docs/faq.md)

## Contributing

This repository is the engine: the `hangfolio` npm package (`packages/theme`), the starter template
(`starter/`), the shared deploy workflows every site calls, test fixtures and the docs.

Questions about your own site go to [Discussions](https://github.com/hangfolio/hangfolio/discussions);
bugs go to [issues](https://github.com/hangfolio/hangfolio/issues/new/choose). Code changes are
welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Please report security problems privately, as
[SECURITY.md](SECURITY.md) describes.

## License

MIT; see [LICENSE](LICENSE). The starter's example content is public domain (CC0 1.0), and the
content of your own site belongs to you.

Built by Harris Ahmad.
