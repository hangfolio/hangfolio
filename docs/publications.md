# Publications

Your papers live in one BibTeX file, `content/publications.bib`. Paste entries from Google Scholar or
your reference manager, and the site shows each one as a citation with its links and a copy-ready
BibTeX block. Nothing is fetched from the internet when the site builds.

- [Adding papers](#adding-papers)
- [What the site uses from an entry](#what-the-site-uses-from-an-entry)
- [Your name](#your-name)
- [Featuring a paper on the home page](#featuring-a-paper-on-the-home-page)
- [Extras for a paper](#extras-for-a-paper)
- [Papers in preparation](#papers-in-preparation)
- [When an entry is skipped](#when-an-entry-is-skipped)
- [Everything here is public](#everything-here-is-public)

## Adding papers

1. In Google Scholar, click *Cite* under a paper, then *BibTeX*, and copy the text. Zotero, Mendeley,
   JabRef and most reference managers can export BibTeX too.
2. Open `content/publications.bib` in your repository, click the pencil, and paste the entries
   below the example. Indentation doesn't matter.
3. Commit. The example entry stays hidden as long as it has `example = {true}`; you can also delete it.

al-folio's `_bibliography/papers.bib` works as it is: the field names are the same.

## What the site uses from an entry

```bibtex
@inproceedings{quill2025gauges,
  title     = {Cheap Tide Gauges at Scale},
  author    = {Quill, Mara and Ash, Juniper},
  booktitle = {Proceedings of the Example Conference (EXC '25)},
  year      = {2025},
  doi       = {10.5555/exc25.0042},
  pdf       = {quill2025gauges.pdf},
  code      = {https://github.com/you/gauges},
  abbr      = {EXC ’25},
  selected  = {true}
}
```

- **Shown:** `title`, `author`, the venue (`booktitle` or `journal`, or `school`, `institution`), and
  `year`. LaTeX accents such as `{\'e}` become é, and `@string` macros and `crossref` work.
- **Links**, in this order: `pdf`, `doi` (as `https://doi.org/…`), `arxiv` (as
  `https://arxiv.org/abs/…`), `url`, `code`, `slides`, `poster`, `video`, `website`, `html`, `supp`
  and `blog`. A bare file name such as `pdf = {quill2025gauges.pdf}` means a file you
  uploaded to `public/files/`; a path such as `{/papers/x.pdf}` or a full `https://` address is used
  as it is.
- **`abbr`**: a short venue label, such as "EXC ’25".
- **The BibTeX block** shows your entry exactly as you wrote it, minus `abstract`, `file`, `keywords`,
  `annote` and `example`, with a button that copies it.

Each paper has an anchor named after its key, so you can link to it: `/publications#quill2025gauges`.

## Your name

Your name is underlined wherever it appears in an author list. The theme matches `name` from
`site.yaml`, ignoring accents, initials and the order of first and last names, so "Quill, Mara",
"M. Quill" and "Mara Quill" all match. For other spellings (a maiden name, a middle name), add them to
`site.yaml`:

```yaml
nameVariants: ["M. A. Quill", "Mara Ash-Quill"]
```

## Featuring a paper on the home page

Add `selected = {true}` to the entry, or `featured: true` in its extras file. To show one paper in the
home page's research section, set `research.featured` in `content/home.yaml` to its key.

## Extras for a paper

A Markdown file in `content/publications/`, named after the BibTeX key, adds things BibTeX can't
hold. `content/publications/quill2025gauges.md`:

```markdown
---
equal: [Quill, Ash]
place: "Lisbon, May 20–23, 2025"
links:
  - { label: "Talk", url: "https://example.org/talk" }
data: { text: "Gauge readings from 12 harbours, 2023–2025." }
---
A plain-language summary, shown under the citation.
```

| Field | What it is |
|---|---|
| `featured` | `true` features the paper on the home page, like `selected = {true}`. |
| `links` | More links, after the ones from BibTeX: `{ label, url }` or `{ label, profile }`. |
| `equal` | Surnames of the authors who contributed equally. They get a `*`, explained by `authorNote` (default "*Equal contribution"). |
| `anchor` | The paper's anchor. Default: its key. |
| `bibtexAnchor` | The BibTeX block's anchor. Default: `bibtex-` and the paper's anchor. |
| `venueDetail` | The venue exactly as you want it shown, instead of `booktitle` or `journal`. |
| `place` | Where and when, such as "Lisbon, May 20–23, 2025". |
| `data` | A data line: `{ tag?, text }`, with `tag` defaulting to "Data". |
| `schema` | Fields for the paper's structured data (`ScholarlyArticle`) that replace the generated ones. |

The text under the front matter is a short summary shown with the paper.

## Papers in preparation

A paper with no BibTeX yet is a file in `content/publications/` with `status: in-preparation`, named
anything that isn't a BibTeX key:

```markdown
---
status: in-preparation
order: 1
title: "Tide Gauges That Calibrate Themselves"
margin: "Python · Field data"
chip: "EXC ’27 · in preparation"
text: "We calibrate low-cost gauges against each other, without a reference station."
---
```

They are listed in their own section on `/publications`, by `order`, and shown exactly as written.
The text beside that section can be set with `pages.publications.prepAside` in `site.yaml`.

## When an entry is skipped

If an entry can't be read, usually because of a missing comma between fields or an unclosed `{`, the
build warns with [W301](troubleshooting.md#w301), names the entry's first line, and leaves just that
entry out. Everything else still shows. Two entries with the same key are an error
([E303](troubleshooting.md#e303)).

## Everything here is public

Your repository is public, so everything in it can be read by anyone: papers in preparation and their
wording, comments in `publications.bib`, and files you upload but don't link. Add a paper in
preparation only when you're happy for its title and summary to be public.
