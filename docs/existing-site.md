# Moving an existing site

Already have an academic site, for example from academicpages or al-folio? You can move it to
hangfolio by hand in an afternoon, and keep your old site live until the new one is ready. An
automatic importer is planned for a later version.

## The plan

1. Make your new site under a temporary name, as in
   [variant B of the quickstart](quickstart.md#variant-b-you-already-have-a-site-at-usernamegithubio).
   It goes live at `https://<username>.github.io/new-site/` while the old one keeps the main address.
2. Move your files and content, using the tables below.
3. Add redirects for old addresses that changed.
4. Swap the repository names, and move the custom domain if you have one.

## Keep your files at the same addresses

Copy your old site's file folders into `public/` without renaming anything. *Add file → Upload
files* accepts a whole folder dragged in.

- academicpages: `files/` → `public/files/`, `images/` → `public/images/`.
- al-folio: `assets/pdf/` → `public/assets/pdf/`, `assets/img/` → `public/assets/img/`.

Google Scholar and other sites that link to your PDFs then keep working.

## From academicpages

| Old file | New place |
|---|---|
| `_config.yml` (`author:` block) | `site.yaml`: `name`, `email`, `location`, `avatar`, and the profile URLs as `links` |
| `_pages/about.md` | `site.yaml` `tagline`, and `intro` in `content/home.yaml` |
| `_publications/*.md` | `content/publications.bib`: easiest is to paste the BibTeX from Google Scholar for each paper. A per-paper summary goes in `content/publications/<key>.md`. |
| `_teaching/*.md` | `content/experience.yaml` entries with `section: teaching` |
| `_portfolio/*.md` | `content/projects/*.md` |
| `_posts/*.md` | `content/writing/*.md`: keep `title` and `date`, add `description`, remove Jekyll-only fields |
| `_talks/*.md` | Not supported yet. A news item per talk works meanwhile. |
| `files/`, `images/` | `public/files/`, `public/images/` |

## From al-folio

| Old file | New place |
|---|---|
| `_config.yml`, `_data/socials.yml` | `site.yaml` |
| `_bibliography/papers.bib` | `content/publications.bib`, as it is. The field names (`pdf`, `code`, `abbr`, `selected`…) are the same. |
| `_news/*.md` | items in `content/news.yaml` |
| `_projects/*.md` | `content/projects/*.md`, which keeps the `/projects/<name>/` addresses |
| `_posts/*.md` | `content/writing/*.md`, with redirects from the old dated addresses |
| `_data/cv.yml` or `assets/json/resume.json` | `content/experience.yaml` |
| `assets/img/`, `assets/pdf/` | `public/assets/img/`, `public/assets/pdf/` |

Liquid tags (`{% … %}`), jekyll-scholar macros and distill or Jupyter posts don't carry over. Rewrite
those parts in plain Markdown.

## Redirects for changed addresses

Posts and pages whose address changes can forward to the new one. In `site.yaml`:

```yaml
redirects:
  - { from: "/about/", to: "/" }
  - { from: "/2023/05/14/my-first-post.html", to: "/writing/my-first-post/" }
  - { from: "/publications/2024-paper-one", to: "/publications#quill2024paper" }
```

Each redirect writes a small page at the exact old address that sends visitors on and tells search
engines where the page went.

## Swapping

When the new site has everything, follow steps 3 to 5 of
[variant B](quickstart.md#variant-b-you-already-have-a-site-at-usernamegithubio): rename the old
repository, rename the new one to `<username>.github.io`, run the deploy, and move the custom domain.
The old repository keeps your old site's history; archive it rather than deleting it.
