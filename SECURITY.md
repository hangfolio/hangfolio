# Security policy

Every hangfolio site runs this repository's code: the `hangfolio` npm package when it builds, and
the shared `build.yml` and `deploy.yml` workflows, which publish to GitHub Pages. A flaw in either
could reach many sites at once, so reports are very welcome.

## Supported versions

| Part | Supported |
|---|---|
| The `hangfolio` npm package | The newest 0.1.x release |
| The shared workflows | The `v1` tag |
| The starter template | The current `hangfolio/starter` |

## Reporting a vulnerability

Please report it privately: on this repository's **Security** tab, click **Report a vulnerability**
([direct link](https://github.com/hangfolio/hangfolio/security/advisories/new)). Don't open a
public issue or discussion.

Say what an attacker can do, and how: the affected version or tag, the steps or a small example
site, and what you expected instead. You'll get a reply within a week. Fixes are released as a
patch and, for the workflows, by moving `v1`, so sites pick them up on their next build; the
advisory is published once a fix is out, crediting you unless you'd rather not be named.

## Out of scope

- A site owner's own content, such as HTML in their Markdown or their own `custom.css`: each site
  publishes what its owner writes.
- What GitHub Pages, GitHub Actions or npm themselves do.
