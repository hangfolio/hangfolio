# Editing your site

Your site is a handful of text files. This page has one section per file. Every file except
`site.yaml` is optional: a section, page or menu item with nothing in it disappears by itself.

- [How editing works](#how-editing-works)
- [`site.yaml`](#siteyaml)
- [`content/home.yaml`](#contenthomeyaml)
- [`content/projects/*.md`](#contentprojectsmd)
- [`content/projects.yaml`](#contentprojectsyaml)
- [`content/publications.bib` and `content/publications/`](#contentpublicationsbib-and-contentpublications)
- [`content/experience.yaml`](#contentexperienceyaml)
- [`content/news.yaml`](#contentnewsyaml)
- [`content/writing/*.md`](#contentwritingmd)
- [`content/custom.css`](#contentcustomcss)
- [`public/`](#public)

## How editing works

**On GitHub.** Open a file and click the pencil icon. When you're done, click **Commit changes…**
and commit to your main branch. About 2 minutes later the change is live. To add a file, open the
folder and choose *Add file → Create new file*; to upload photos or PDFs, *Add file → Upload files*.
To try a bigger change first, choose *Create a new branch and start a pull request* when committing:
the pull request is checked and built, and nothing is published until you merge it.

**Every change is checked.** If something is wrong, the run fails with the file, the line and the
fix, and your live site stays as it was. See [Troubleshooting](troubleshooting.md).

**Rules that apply everywhere:**

- **Quotes.** Put text in straight double quotes: `role: "Marine ecologist"`. Then a `: ` or `#`
  inside the text is safe. Inside double quotes, write a `"` as `\"`.
- **Indentation.** Use spaces, never tabs. Lines of one list or block start in the same column.
- **Links and paths** inside your site are written from the site root: `/projects`, `/files/cv.pdf`,
  `/publications#vale2024bounded`. Don't include the repository name; the theme adds it, so links
  keep working on any address. Addresses starting `https://`, `mailto:` or `tel:` are left as they are.
- **Formatting.** Fields described as *Markdown* accept `[text](url)`, `**bold**`, `*italic*` and
  `` `code` ``. HTML is not allowed in them.
- **Dates** are `2026`, `2026-08` or `2026-08-14`.
- **Text is shown exactly as you write it.** The theme never shortens or rewrites your words.

**Example content.** The template comes with a made-up person, Rowan Vale. While `name` and `email`
in `site.yaml` are both still theirs, the whole demo shows with an "example site" banner, and search
engines are asked not to index it. Once you change them, every entry still marked as an example is
hidden until you delete its marker line:

- `example: true   # ← delete this line …` at the top of a file;
- `example: true` inside an entry of `content/experience.yaml` or `content/news.yaml`;
- `example = {true},` in a BibTeX entry.

The run summary lists everything hidden and the line to delete. Editing an entry is not enough; the
marker alone decides ([W403](troubleshooting.md#w403)).

## `site.yaml`

Who you are and how the site is set up: name, tagline, role, affiliation, email, location, photo, CV,
profile links, the availability box, the booking link, and which pages exist. Only `name` and `email`
are required; `tagline`, `role` and `affiliation` are what visitors read first. Every field is described in
[The site.yaml reference](site-yaml.md).

## `content/home.yaml`

The text of the home page around your other content. Without this file, the home page is built from
the rest: your name, tagline, featured projects, experience, news and posts.

```yaml
intro: "PhD student at [Harbor University](https://harbor.example), advised by Dr. Lee."
now: "a tide-gauge paper and a field season."
highlights:
  items:
    - { value: "up to 40%", what: "lower p99 latency", source: "[The paper](/publications#mypaper)" }
research:
  problem: "Tide gauges are expensive, so coastlines are measured in too few places."
  approach:
    - { title: "Cheap gauges", chip: "EXC ’24", text: "Gauges built from off-the-shelf parts." }
  status: "One paper published; one in preparation."
  featured: mypaper2024
  teaching: "TA, Oceanography 101 (Fall 2025)"
```

| Field | What it is |
|---|---|
| `intro` | *Markdown.* The paragraph under your tagline. Without it, your role and affiliation are shown. |
| `now` | *Markdown.* The "Now:" line. |
| `highlights` | "Results at a glance": `heading` (optional) and 1 to 4 `items`, each `{ value, what, source?, asOf? }`. In `value`, a leading `up to ` is set smaller and ` → ` gets an arrow style. With `asOf`, you're reminded after 180 days ([W605](troubleshooting.md#w605)). |
| `research` | The research section: `heading`, `problem`, `approach` (a list of `{ title, chip?, text }`), `status`, `featured` (a BibTeX key, shown in full), `teaching` and `link` (`{ label, href }`). |
| `sections` | Which home sections show, in order: `highlights, work, research, experience, education, news, writing, contact`. Leave one out to hide it. |
| `counts` | How many items the home page shows: `{ experience: 5, news: 4, writing: 2 }`. |
| `headings` | Section headings: `work`, `experience`, `education`, `news`, `writing`, `contact`. |

## `content/projects/*.md`

One Markdown file per project. The file name is its id: `tidepool.md` is `/projects/tidepool/`.

```markdown
---
title: "Tidepool"
kicker: "CLI · Rust"
group: "Developer tools"
start: 2025-03
end: present
summary: "Replays crash points to find lost writes in key-value stores."
facts:
  - { label: "Problem", text: "Crash bugs hide between fsync calls." }
  - { label: "Result", lines: ["12/12 seeded bugs found", "0 false positives"] }
  - { label: "Install", code: "cargo install tidepool" }
links:
  - { label: "GitHub", url: "https://github.com/you/tidepool" }
home:
  order: 1
---
Optional longer text. When it is there, the project gets its own page.
```

| Field | What it is |
|---|---|
| `title` | Required. |
| `summary` | Required. *Markdown.* One or two sentences. |
| `kicker` | A short line next to the title, such as "CLI · Rust". |
| `group` | The heading it's listed under on `/projects`. Default: "Projects". |
| `order` | Its position on `/projects`. Default: file name order. Numbering continues across groups. |
| `start`, `end` | Dates in the margin; `end` may be `present`. |
| `margin` | Margin text instead of dates, such as "EXC ’24". |
| `facts` | Labelled lines, in order. Each has a `label` and one of `text` (*Markdown*), `lines` (a list), `code` (shown in mono) or `note`; any of them can add a `terminal`. Problem, Built, Result, Install and Data are common labels, but any label works. |
| `links` | A list of `{ label, url }`, `{ code: "npm i x" }`, or `{ label, profile: github }` to reuse a link from `site.yaml`. |
| `result` | A result line: text, or `{ tag, parts, muted }`. |
| `compact` | `true` for a one-line entry. |
| `listed` | `false` to show the project on the home page only. |
| `home` | Features the project in "Selected work" on the home page: `order` (required), and optional `title`, `summary`, `result`, `links`, `footnote` (a list of short notes shown instead of links, such as "Under submission") and `exhibit`. |

**Exhibits** sit beside a featured project. Use exactly one:

- `terminal: { label, lines }`: a terminal window. A line starting `$ ` is a command, `# ` a comment,
  and `[CRITICAL] `, `[HIGH] `, `[MEDIUM] ` or `[LOW] ` get a coloured badge.
- `metrics: { title, rows: [{ label, before, after, highlight? }], footer?, footerMuted? }`: a before
  and after table.
- `bars: { label, rows: [{ label, value, unit?, tone: accent | faint }], caption }`: horizontal bars
  scaled to the largest value.
- `install: { command }`: a one-line install command.

**The text below the front matter** is optional. When there is some, the project gets a page at
`/projects/<id>/` written in ordinary Markdown.

## `content/projects.yaml`

Optional. The order, titles and ids of the groups on `/projects`. Without it, groups appear in the
order your projects first use them.

```yaml
groups:
  - { title: "Research artifacts" }
  - { title: "Developer tools", headingId: "tools" }
  - { title: "Libraries", link: { label: "All on GitHub", href: "https://github.com/you" } }
```

Each group has a `title` (matching the projects' `group`), and optionally an `id`, a `headingId` for
the heading's anchor, and a `link` shown beside the heading.

## `content/publications.bib` and `content/publications/`

Your papers, as BibTeX, plus optional extras per paper and papers in preparation. See
[Publications](publications.md).

## `content/experience.yaml`

Jobs, research positions, teaching and education, shown on `/experience` and, for entries you pick,
on the home page.

```yaml
entries:
  - section: professional
    role: "Software Engineering Intern"
    org: "Harbor Labs"
    location: "Lisbon"
    start: 2024-06
    end: 2024-08
    bullets: ["Cut API latency from 3s to 300ms with a read-through cache."]
    home: "Cache layer for the orders API."
```

| Field | What it is |
|---|---|
| `section` | Required: `professional`, `research`, `teaching`, `education`, `programs` or `earlier`. |
| `role`, `org` | Required. |
| `short` | A shorter organisation name for the home page. |
| `location` | Shown with the entry. |
| `start`, `end` | Dates; `end` may be `present`. Within one year the first year is dropped: "Jun – Aug 2024". |
| `expected` | `true` adds "(expected)". |
| `when` | Text instead of dates, such as `["Spring 2025", "Fall 2025"]`. |
| `bullets` | *Markdown.* A list of points. |
| `desc` | *Markdown.* A paragraph instead of bullets, usual for `earlier`. |
| `home` | A one-line summary. When it's there, the entry is listed on the home page. |
| `homeLine` | For education and programs: `{ text, years }`, the line on the home page. |
| `gallery` | Photos: `{ caption?, images: [{ thumb, full, alt, width, height }] }`, with files in `public/`. |

Entries keep the file's order within each section. On `/experience` the sections are Professional,
Research, Teaching, Education (with programs) and Earlier.

## `content/news.yaml`

Short dated items, newest first. The home page shows the first four (`counts.news` in
`content/home.yaml`).

```yaml
items:
  - date: 2026-08
    text: "Released [Tidepool](/projects/tidepool/) 1.0."
```

`date` needs at least the month. `text` is *Markdown*.

## `content/writing/*.md`

One Markdown file per post. `content/writing/what-fsync-promises.md` is published at
`/writing/what-fsync-promises/`.

```markdown
---
title: "What fsync actually promises"
date: 2026-09-14
description: "Durability guarantees, in one page."
tags: [storage]
---
The post, in Markdown.

## A heading with a fixed anchor {#checklist}
```

| Field | What it is |
|---|---|
| `title`, `date`, `description` | Required. The description is used in search results and the feed. |
| `updated` | The date of the last real change. |
| `excerpt` | The teaser in post lists. Default: the description. |
| `tags` | A list of words. |
| `minutes` | Fixes the "N min read" label; otherwise it is worked out from the text. |
| `draft` | `true` leaves the post out of the site. The file is still public in your repository. |

**Anchors.** Headings get anchors from their text. End a heading with `{#name}` to fix its anchor, so
links to it survive rewording.

**MDX.** Write posts as `.md`. A `.mdx` file also accepts the `<Note>` and `<Terminal>` components, but
in MDX a stray `{` or `<` in your text breaks the build, so use it only when you need them.

## `content/custom.css`

Optional CSS of your own, added after the theme's styles. See
[Customizing](customizing.md#your-own-css).

## `public/`

Everything in `public/` is published as it is, at the same path: `public/files/cv.pdf` is at
`/files/cv.pdf`.

- `public/images/`: your photo. Named `avatar.jpg`, `avatar.png` or `avatar.webp`, it's used without
  any setting; otherwise set `avatar` in `site.yaml`.
- `public/files/`: your CV and papers. In BibTeX, `pdf = {paper.pdf}` links to `/files/paper.pdf`.
- `public/favicon.svg`: the browser tab icon. Replace it to use your own; `favicon.ico` and
  `apple-touch-icon.png` in `public/` are picked up too.
- `public/example/`: the demo person's files. Left out of your site once `site.yaml` is yours; delete
  it when you no longer need it.

A file you put in `public/` wins over one the theme would generate at the same path, such as
`robots.txt`.
