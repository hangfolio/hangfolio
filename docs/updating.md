# Updating

Your site has three moving parts, and each one updates in exactly one way:

| Part | What it is | How it updates |
|---|---|---|
| Your content | `site.yaml`, `content/`, `public/` | Only when you edit it. Updates never touch it. |
| The theme | The `hangfolio` package in `package.json`: design, pages, checks | A Dependabot pull request about once a month. You merge it. |
| The deploy | The shared workflows your `.github/workflows/deploy.yml` calls | Automatically. Nothing to do. |

## Theme updates

About once a month, when there is a new version, Dependabot opens a pull request named
**Update site theme: bump hangfolio from 0.1.0 to 0.1.1**. Its description has the release notes,
including a "What changes on your site" section and whether you need to do anything.

The pull request runs **Deploy site** against your own content. It builds the site but publishes
nothing.

- **Green:** click **Merge pull request**. The site is live with the new version about 2 minutes later.
- **Red:** the check names the file and line that need a change. Make it on the pull request's branch,
  or ask in the discussions. Your live site is unchanged until you merge.

Nothing merges by itself, and nothing breaks if you ignore the pull request. Dependabot keeps it up
to date with the newest version, so merging months later is still one click.

A new theme version reaches Dependabot at its first scheduled run at least 3 days after the release.
To update sooner, use a terminal: `npm install hangfolio@<version> --save-exact`, then commit both
`package.json` and `package-lock.json`. Don't change the version in `package.json` in the browser:
the lockfile has to change with it ([npm ci failed](troubleshooting.md#npm-ci-failed)).

### Versions

- **Patch** releases (0.1.0 → 0.1.1) fix bugs. Your site looks the same, apart from the fix.
- **Minor** releases (0.1 → 0.2) add features. Your files keep working unchanged.
- **Major** releases (1.x → 2.0) are rare. If they need you to change a file, the red check on the
  Dependabot pull request lists every line, and this page gets a section for the release.

Within a major version, a renamed field keeps working under its old name, with a notice
([N702](troubleshooting.md#n702)) giving the new one.

## Deploy updates

Your `.github/workflows/deploy.yml` calls two shared workflows at `@v1`. Fixes to them (new action
versions, runner changes, GitHub Pages changes) reach your site on its next build with no action from
you. A breaking change would come as `@v2`, which Dependabot proposes as a pull request, grouped so
both lines change together.

If you'd rather pin an exact version, replace `@v1` in both `uses:` lines with a full commit SHA from
the hangfolio repository. You then update by hand, or through Dependabot's pull requests.

## Plumbing files

`astro.config.mjs`, `src/content.config.ts`, the `scripts` in `package.json`, `.github/`,
`.devcontainer/` and the root `index.html` connect your site to the theme. They are meant to stay the
same for a whole major version. If one ever needs changing, `npm run check` and the run summary show a
notice ([N701](troubleshooting.md#n701)) with a link to edit the file and its full new text.

## If you change nothing

Your site keeps deploying with the theme version it has. Nothing runs on a schedule in your
repository except Dependabot.
