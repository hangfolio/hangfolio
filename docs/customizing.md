# Customizing

hangfolio has one design, on purpose: the typography, layout, light and dark themes and accessibility
come as a set. What you can change is listed here, all of it in your own files, so theme updates keep
applying.

- [Home page sections](#home-page-sections)
- [Pages](#pages)
- [The menu](#the-menu)
- [Accent colour](#accent-colour)
- [Your own CSS](#your-own-css)
- [What you can't change (yet)](#what-you-cant-change-yet)

## Home page sections

In `content/home.yaml`, `sections` sets which sections the home page shows and in what order. Leave a
name out to hide that section:

```yaml
sections: [highlights, work, research, experience, education, news, writing, contact]
```

`counts` sets how many experience entries, news items and posts it shows, and `headings` renames the
section headings. A section with no content hides itself either way. The anchors of the sections
(`#work`, `#research`, `#news`…) can be changed with `advanced.anchors` in `site.yaml`. See
[Editing](editing.md#contenthomeyaml).

## Pages

Besides the home page, the site has a page for each kind of content that exists: `/projects`,
`/publications`, `/experience`, `/writing/`, `/contact`, and `/meet` when you set `booking`. In
`site.yaml`, `pages` turns one off or changes its address and text:

```yaml
pages:
  meet: false                                   # no /meet page
  experience: { path: "/work-experience" }      # a different address
  projects: { title: "Software", heading: "Software", lede: "Things I've built and maintain." }
  publications: { prepAside: "Drafts on request." }
```

Each page takes `path`, `title` (the browser tab), `description` (for search results), `heading` and
`lede` (the sentence under the heading). `false` removes the page, its menu item and its sitemap
entry. Two pages can't share a path ([E303](troubleshooting.md#e303)).

To keep an old address working after a move, add a redirect:

```yaml
redirects:
  - { from: "/about.html", to: "/" }
  - { from: "/cv", to: "/files/cv.pdf" }
```

## The menu

By default the header lists every page that has content, in this order: research, projects,
publications, experience, writing, CV, booking, contact. To choose, list them in `site.yaml`, and add
links of your own with `{ label, href }`:

```yaml
nav: [research, publications, writing, cv, { label: "Lab", href: "https://lab.example.org" }]
```

The footer shows your profile links; add more with `advanced.footer.links`.

## Accent colour

> [!NOTE]
> Changing the accent colour arrives in version 0.1.1. Until then, the setting below is accepted but
> the design's own blue is used.

```yaml
theme: { accent: "#2c5aa0" }
# or one colour for each mode:
theme: { accent: { light: "#2c5aa0", dark: "#8fb2ea" } }
```

From one colour, the theme works out the rest: a darker shade for hover, a lighter one for dark mode
if you don't give it, and white or dark text on buttons, whichever reads better. The build checks
that text in your colour has a contrast of at least 4.5:1 against the background in both modes, and
suggests the nearest colour that passes if it doesn't ([E604](troubleshooting.md#e604)).

## Your own CSS

`content/custom.css` is added after the theme's styles, so its rules win. Keep it small. Hooks you can
rely on across versions:

- every home page section and page has a `data-section` attribute, for example
  `[data-section="news"]`;
- the design's colours are CSS custom properties: `--bg`, `--fg`, `--muted`, `--faint`, `--rule`,
  `--rule-strong`, `--tint`, `--accent`, `--accent-strong`, `--btn-bg`, `--btn-bg-hover`, `--btn-fg`,
  `--well`, `--well-line` and `--line-ink`, plus the font stacks `--serif`, `--sans` and `--mono`.

```css
/* A little more space between news items */
[data-section="news"] li { margin-block: 0.5rem; }
```

Class names are not part of that promise: they may change in any release. Dark mode sets the same
custom properties to other values, so a rule that uses them works in both.

## What you can't change (yet)

- **Fonts.** Newsreader and IBM Plex are part of the design.
- **Layouts and components.** Replacing one of the theme's pages with your own arrives in a later
  version. Until then, changes that need new markup are best suggested in the
  [discussions](https://github.com/hangfolio/hangfolio/discussions).
