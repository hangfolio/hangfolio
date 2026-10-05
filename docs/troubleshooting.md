# Troubleshooting

Every message from hangfolio has a code, and each code has a section on this page. Links in the
messages jump straight to it.

- [Reading a message](#reading-a-message)
- [Content and settings](#content-and-settings): E101 to N702
- [GitHub Pages and the deploy](#github-pages-and-the-deploy): setup, competing workflows, caching

## Reading a message

A message looks like this:

```
site.yaml:7:1  error E401  tagline is still the example text. Write your own sentence.
```

It names the file, the line and column, the code, and what to do. The first letter of the code says
how serious it is:

- **E (error)** stops the build. Nothing is published, and your live site stays as it was.
- **W (warning)** builds anyway. The message says what was left out or what to improve.
- **N (notice)** is for your information, such as a file that a new version would like updated.

You see the same messages in four places:

- on GitHub, in the summary of the **Deploy site** run (*Actions* tab), in a table with links to the
  exact lines;
- on the lines themselves, in the commit and in pull request diffs;
- in the terminal, from `npm run check`, `npm run dev` and `npm run build`;
- in the browser while `npm run dev` is running.

GitHub emails the person who made the commit when a run fails.

Warnings W402, W403 and W404 are listed apart, as **Hidden on your site because they are still
examples**. They are not mistakes: they tell you which of the template's example content your site
leaves out.

## Content and settings

### E101

**YAML syntax.** The file isn't valid YAML, so it can't be read. The message points at the spot and
shows the line written correctly. The usual causes:

- A value with `: ` in it needs quotes: `tagline: "Tools for coastal data: small, fast and open"`.
- A quote that is opened but never closed, or closed with a curly `”`.
- A value that starts with `@`, `*`, `&`, `!`, `%`, `` ` `` or `|` needs quotes.
- The same key twice in one block. Keep one of them.
- A line indented differently from the lines around it. Items of one list, or keys of one block,
  must start in the same column.
- No space after the colon: write `location: Harbor Point`, not `location:Harbor Point`.
- A `{` or `[` that is never closed.

Putting every text value in straight double quotes, as the template does, avoids most of these.

### E102

**Tabs in indentation.** YAML only allows spaces for indenting. Replace the tabs at the start of the
line with spaces. GitHub's editor does this for you if you set *Indent mode* to *Spaces*.

### E103

**Front matter not closed.** A Markdown file starts with a block between two `---` lines. The second
`---` is missing. Add it on its own line after the last setting, before the text.

### E201

**Unknown field.** The file has a setting the theme doesn't know, usually a typo. The message suggests
the closest known name: `Unknown field 'sumary'. Did you mean 'summary'?` Fix the spelling, or delete
the line. [The site.yaml reference](site-yaml.md) and [Editing your site](editing.md) list every field.

### E202

**Wrong value.** The field exists, but its value isn't one it accepts. The message says what it
expects:

- one of a fixed list: `section must be one of professional, research, teaching, education,
  programs, earlier. You wrote 'industry'.`
- a number, or text: a field that takes text needs quotes around a number, as in `value: "40"`;
- an address with `https://` in front;
- a value at all: `role is empty. Write a value after the colon, or delete the line.`
- `key: value` lines rather than a list, at the top of a file.

### E203

**Missing field.** A required field isn't there. Every site needs `name` and `email` in `site.yaml`;
each project needs `title` and `summary`; each post needs `title`, `date` and `description`. The
message shows the line to add. A Markdown file with no front matter at all gets the whole block to
paste at the top.

### E204

**Bad date.** Dates are written `2026`, `2026-08` or `2026-08-14`. News items need at least the month.
The message suggests the right form when it can tell, for example `Aug 2025` → `2025-08`.

### W205

**Text is long.** A field is longer than reads well, for example a `tagline` over 220 characters. The
site builds anyway. Shorten it, or move the rest elsewhere (`intro` in `content/home.yaml` takes a
longer paragraph).

### E206

**Stray quote.** YAML treats a value as quoted only when it starts with a straight `"` or `'`. A value
like `role: Marine ecologist"` (opening quote deleted) or `role: “Marine ecologist"` would show the
quote marks on your site, so the build stops. Put the whole value in straight quotes:
`role: "Marine ecologist"`. A `"` right after a digit, as in `27"`, is read as inches and left alone.

### W206

**Quotes shown as text.** A value wrapped in curly quotes (`“…”` or `‘…’`), which phones often type, or
with a lone `'` or `’` at one end. YAML keeps them as part of the text, so they show on your site. If
that isn't what you want, use straight quotes: `role: "Marine ecologist"`. To keep curly quotes on
purpose, wrap the value in straight ones: `tagline: "“Measure twice.”"`.

### E301

**BibTeX file unreadable.** Nothing in `content/publications.bib` could be read, so the site would have
no papers. Check that the file is plain text and that each entry starts with `@type{key,`. Paste one
entry at a time from Google Scholar (*Cite → BibTeX*) to find the one at fault.

### W301

**BibTeX entry skipped.** One entry couldn't be read, for example because a comma is missing after a
field or a brace isn't closed. That entry is left out and listed; the rest of the file is fine. The
message gives the entry's first line. See [Publications](publications.md#when-an-entry-is-skipped).

### E302

**Broken reference.** A setting names something that doesn't exist:

- `research.featured` in `content/home.yaml` must be a key from `content/publications.bib`;
- a link with `profile: github` must match the `id` (or label) of a link in `site.yaml`;
- a file in `content/publications/` must be named after a BibTeX key, unless it says
  `status: in-preparation`.

The message lists the names that do exist and suggests the closest one.

### E303

**Used twice.** Two things share something that must be unique: two pages at one path, two BibTeX
entries with one key, two links or project groups with one `id`, or two home sections with one
anchor. Rename one of them.

### E401

**Example value.** A required field in `site.yaml` (`tagline`, `role`, `affiliation` or `email`) still
has the template's example text, after you changed `name` and `email`. The build stops so that the
made-up person's details never appear under your name. Write your own. An email address at
`example.com`, `example.org`, `example.net` or `example.edu` is only allowed in the demo.

### W402

**Example hidden.** An optional `site.yaml` value is still the example: the location, a profile link,
the availability box, the booking link or an `seo` value. Your site leaves it out. Write your own, or
delete the line or block.

### W403

**Example entry hidden.** An entry is still marked as an example, so your site leaves it out:

- `example: true` in a project, post, publication extras file or `content/home.yaml`;
- `example: true` inside an entry of `content/experience.yaml` or `content/news.yaml`;
- `example = {true}` in a BibTeX entry.

The marker alone decides. Editing the rest of the entry isn't enough: when you have, the message says
`You edited this example, but it still says example: true, so it's hidden.` Delete the line it names
(or remove `example: true` from it, when the line holds more) and commit.

### W404

**Example file hidden.** Files in `public/example/` belong to the demo person. Once `site.yaml` is
yours, the folder is left out of your site, and any setting that points into it is ignored: the photo
becomes your initials, and the CV link and preview image are left out. Upload your own files (photo to
`public/images/`, CV to `public/files/`), point `avatar`, `cv` and `ogImage` at them, and delete
`public/example/` when you no longer need it.

### E501

**Missing file.** A path in your settings points at a file that isn't in `public/`. The message lists
the files that are there and suggests the closest name, for example
`cv: /files/cv.pfd doesn't exist. Did you mean /files/cv.pdf?` Paths are written from the site root
without `public`: the file `public/files/cv.pdf` is `/files/cv.pdf`. Names are case-sensitive.

### W601

**Link includes the base.** On a project site such as `https://you.github.io/my-site/`, write links
from the site root, `/projects`, not `/my-site/projects`. The theme adds the base for you, so your
links keep working if you rename the repository or add a custom domain. This one link was left as you
wrote it.

### E602

**Link to a missing page.** After building, `hangfolio verify` found a link to a page or file that the
site doesn't have, such as `/projets`. The message suggests the closest real page. Fix the link, or add
the missing file to `public/`.

### W603

**Large file.** A file is over 50 MB, or the whole site is over 900 MB. GitHub Pages refuses sites over
1 GB and is slow with big files. Compress large PDFs and images, or host videos and datasets elsewhere
and link to them.

### E604

**Accent colour too light or too dark.** From version 0.1.1, `theme.accent` changes the accent colour,
and the build checks that text in that colour stays readable (a contrast of at least 4.5:1) in light
and dark mode. The message suggests the nearest colour that passes.

### W605

**Old result.** A number in `highlights` has an `asOf` date more than 180 days ago. Update the number
and the date, or delete `asOf`.

### N701

**Plumbing file outdated.** One of the files that connect your site to the theme (`astro.config.mjs`,
`src/content.config.ts` or the `scripts` in `package.json`) was edited, or a new version needs a newer
copy. The run summary has a link that opens the file in GitHub's editor, and the full replacement
text. Replace the whole file with it and commit. This is expected about once per major version, if at
all.

### N702

**Renamed field.** A field you use has a new name. The old one keeps working until the next major
version; the message gives the new spelling to switch to when convenient.

## GitHub Pages and the deploy

### One step left: turn on GitHub Pages

The **Deploy site** run has a failing job with this name when GitHub Pages isn't set up to publish
from GitHub Actions yet. Open *Settings → Pages* (the message links straight to it), set **Source** to
**GitHub Actions**, then open the failed run and click **Re-run all jobs**.

The first run of a new copy never fails this way: it ends green and lists the same step in its
summary. During its first 5 runs, a copy also waits up to 5 minutes for you to switch Source.

### A second workflow publishes to GitHub Pages

The run says something like ``.github/workflows/static.yml also publishes to GitHub Pages and will
overwrite your site``. This usually happens when **Configure** was clicked on one of the workflows
GitHub suggests under *Settings → Pages*. Delete the file it names (open it, then *… → Delete file*).
**Deploy site** already builds and publishes your site; it must be the only workflow that does.

### GitHub Pages needs a public repository

GitHub Pages on a free plan only publishes public repositories. Make the repository public in
*Settings → General → Danger Zone → Change visibility*, or use a paid plan.

### The repository name ends in .github.io but isn't yours

Only a repository named exactly `<your-username>.github.io` is served at `https://<your-username>.github.io/`.
Any other name, including someone else's `<name>.github.io`, is served at
`https://<your-username>.github.io/<repository-name>/`. Rename it in *Settings → General* if you
want the root address, then run **Actions → Deploy site → Run workflow**.

### Actions don't run in a fork

A fork has Actions turned off, so nothing builds. Start over with the
[Create your site](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public)
link, which makes a copy that is yours, then delete the fork.

### GitHub Pages had a temporary error

The deploy step failed with a message such as "Deployment failed, try again later". This is on
GitHub's side. Open the run and click **Re-run failed jobs**. Your live site is unchanged meanwhile.

### npm ci failed

The run says `package.json and package-lock.json disagree`. These two files are updated together by
Dependabot; editing `package.json` by hand breaks the pair. Undo your edit to `package.json` (open the
file's *History* and copy back the previous version).

### The site shows "Almost there"

Your `<username>.github.io` repository is still being published by GitHub's older branch mode, which
shows the page that the template keeps at its root for this case. Do
[step 3](quickstart.md#3-turn-on-github-pages): set *Settings → Pages → Source* to **GitHub Actions**,
then run **Actions → Deploy site → Run workflow**. After that, `index.html` and `.nojekyll` at the
repository root do nothing, and you may delete them.

### Changes don't show up

Check the **Actions** tab first: a change is live only when its **Deploy site** run is green, about two
minutes after the commit. If it is green, GitHub may be serving a cached copy for up to 10 minutes;
wait and reload. A run on a branch other than your default branch, or on a pull request, checks and
builds the site but doesn't publish it.

### Custom domain problems

See [Custom domain](custom-domain.md#if-something-goes-wrong).
