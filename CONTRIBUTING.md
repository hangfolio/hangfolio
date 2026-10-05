# Contributing

Thanks for helping. hangfolio has one maintainer, so this page is short and the process is light.

## Help with your own site

Ask in [Discussions](https://github.com/hangfolio/hangfolio/discussions), with a link to your
repository and to the failing **Deploy site** run if there is one. Every message code is explained
in [troubleshooting](docs/troubleshooting.md), so that is worth a search first.

Please don't open issues or pull requests about your own site's content, here or on
`hangfolio/starter`: your copy is yours, and changes to it belong in your repository.

## Bugs

If the theme, the checks or the deploy did something wrong, open an
[issue](https://github.com/hangfolio/hangfolio/issues/new/choose) with the bug form. It asks for your
site's address, your repository and the failing Actions run, which is usually all it takes to
reproduce the problem.

Security problems go through the private route in [SECURITY.md](SECURITY.md), not an issue.

## Changing the code

For anything bigger than a small fix, open an issue or a discussion first, so we can agree on the
shape before you write it. Then:

1. Install with Node 22.12 or later and npm: `npm install`.
2. Make the change, with a test. [AGENTS.md](AGENTS.md#commands) lists every command; at least
   `npm test`, `npm run build` and `npm run docs:check` must pass. CI also runs the browser,
   accessibility, screenshot and build-matrix tests on your pull request.
3. If the change reaches sites (anything in `packages/theme`, `starter/` or the shared
   `.github/workflows/build.yml` and `deploy.yml`), add a changeset for `hangfolio`: `npx changeset`.
   Write its summary for the people who run a site: what changes on their site, and whether they
   need to do anything. It becomes the release notes that Dependabot shows them.
4. Use only made-up people in fixtures, examples and tests.

Contributions are accepted under the [MIT license](LICENSE), the same license the project uses.
Releases are described in [docs/maintaining.md](docs/maintaining.md).
