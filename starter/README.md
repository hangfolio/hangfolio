## [**Create your site →**](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public)

# Your personal site, live on GitHub Pages in 5 steps

A personal website for researchers and engineers: your name and work up front, projects, papers
straight from BibTeX, experience, news and posts, in light and dark. You edit text files in the
browser; GitHub builds and publishes the site every time you save. No installs, no typed URLs.

**See the demo:** [hangfolio.github.io/starter](https://hangfolio.github.io/starter/). Rowan Vale is
a made-up person; everything about them is example content.

> Reading this in your own copy? You've done step 2 already. Carry on from [step 3](#3-turn-on-github-pages).

## Your site in 5 steps

You need a GitHub account with a verified email address. That's all.

### 1. Create your copy

Click **[Create your site →](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public)**.
GitHub opens its "Create a new repository" form with the template at the top already set to
**hangfolio/starter**. Leave **Include all branches** off.

### 2. Name it and create it

Check that **Owner** shows your account. Type a name in **Repository name** and leave the
visibility at **Public** (GitHub Pages needs a public repository on a free plan):

- `<your-username>.github.io` gives you `https://<your-username>.github.io/`.
- Any other name, such as `website`, gives you `https://<your-username>.github.io/website/`.

Already have a `<your-username>.github.io` site? Use another name for now; see
[I already have a site at username.github.io](#i-already-have-a-site-at-usernamegithubio).

Leave everything else as it is and click **Create repository** at the bottom of the form. GitHub
copies the files, opens your new repository and runs **Deploy site** once. It ends green, and its
summary says what's left. You don't need to wait for it.

### 3. Turn on GitHub Pages

In your new repository, click the **Settings** tab at the top (in a narrow window it's in the **⋯**
menu), then **Pages** in the left sidebar, under *Code and automation*. Under *Build and
deployment*, open the **Source** menu, which says **Deploy from a branch**, and choose
**GitHub Actions**. Nothing visible happens yet; that's expected.

> [!IMPORTANT]
> **Don't click "Configure" on any of the workflows GitHub suggests on that page.** Your site already
> has its own (**Deploy site**). A suggested one would publish a second, broken copy over it. If you
> clicked one by mistake, delete the file it added under `.github/workflows/`.

### 4. Make it yours

On the **Code** tab, click `site.yaml` in the list of files, then the pencil icon
(**Edit this file**) at the top right of the file. Replace the example `name`, `tagline`, `role`,
`affiliation` and `email` with yours, and the `links` with your profiles. Keep the quotes. Every
other line marked `# example` is optional: change it or delete it.

Click **Commit changes…** at the top right. In the box that opens, keep **Commit directly to the
`main` branch** and click **Commit changes**.

**Deploy site** runs again. It checks your files first. If something is wrong, the run fails with
the file, the line and the fix, GitHub emails you, and nothing on the web changes. Everything that
is still example content (the demo projects, paper, post and so on) is hidden from your site and
listed in the run summary.

### 5. Open your site

After about 2 minutes, open the **Actions** tab and click the newest **Deploy site** run. When it
has a green tick, scroll down to its summary and follow the **Live at https://…** link. The same
link is in **Settings → Pages** and under **Deployments** on the right of your repository's front
page.

Your site shows your name, tagline, role, links and email, with your initials in place of a photo
until you add one. If it still shows the old page, wait a few minutes and reload: GitHub caches pages
for up to 10 minutes.

## Next steps (any order)

Each change goes live about 2 minutes after you commit it.

- **Photo and CV.** Open `public/images/`, choose **Add file → Upload files**, and upload a photo.
  Name it `avatar.jpg` (or `.png`, `.webp`) and it's used automatically; otherwise set
  `avatar: "/images/<file>"` in `site.yaml`. Put your CV in `public/files/` and set
  `cv: "/files/<file>.pdf"`.
- **Papers.** Open `content/publications.bib`, click the pencil, and paste your BibTeX from Google
  Scholar (**Cite → BibTeX**) or your reference manager. Your name is underlined automatically.
- **Projects, experience, news and posts.** Edit an example file and delete its `example: true`
  line, or copy an example and change it. Sections with nothing in them disappear by themselves.
- **Custom domain.** See [Custom domain](https://github.com/hangfolio/hangfolio/blob/v1/docs/custom-domain.md).
- **Preview before publishing.** **Code → Codespaces → Create codespace** opens a live preview with
  nothing to install. See [Local preview](https://github.com/hangfolio/hangfolio/blob/v1/docs/local-preview.md).

## What to edit

| File | What it controls |
|---|---|
| `site.yaml` | **Start here.** Your name, tagline, role, affiliation, email, photo, CV, profile links, availability box, booking link, and which pages exist. |
| `content/home.yaml` | The home page's intro paragraph, "Now:" line, results at a glance, research summary, and the order of its sections. |
| `content/projects/*.md` | One file per project: title, summary, facts, links, and whether it's featured on the home page. |
| `content/projects.yaml` | Optional: the order and titles of the project groups on `/projects`. |
| `content/publications.bib` | Your papers, as BibTeX. |
| `content/publications/*.md` | Optional extras for a paper (named after its BibTeX key), and papers in preparation. |
| `content/experience.yaml` | Jobs, research positions, teaching and education. |
| `content/news.yaml` | Short dated news items. |
| `content/writing/*.md` | Blog posts, one Markdown file each. |
| `content/custom.css` | Optional CSS of your own. |
| `public/` | Files published as they are: your photo in `public/images/`, CV and papers in `public/files/`. |

Leave the rest alone: `package.json`, `package-lock.json`, `astro.config.mjs`, `src/`, `.github/`
and `.devcontainer/` connect your site to the theme. Theme updates come as pull requests (see
[How do I get updates?](#how-do-i-get-updates)), and if one of these files ever needs a change, the
run summary says what to write. `index.html` and `.nojekyll` only matter until step 3; you can
delete them after that. Every setting is described in the [docs](https://github.com/hangfolio/hangfolio/tree/v1/docs).

## FAQ

### My entry doesn't show up

It is probably still marked as an example. Example entries stay hidden on your site, even after you
edit them, until you delete their marker line:

- `example: true   # ← delete this line …` in a project, post, paper extras or `content/home.yaml`;
- `example: true` inside an entry of `content/experience.yaml` or `content/news.yaml`;
- `example = {true},` in a BibTeX entry.

Delete that one line and commit. The **Deploy site** run summary lists every entry it hid and the
line to delete. More in [troubleshooting](https://github.com/hangfolio/hangfolio/blob/v1/docs/troubleshooting.md#w403).

### My changes don't show

Check the **Actions** tab: a commit goes live only when its **Deploy site** run is green, about 2
minutes later. If the run is green and the page still looks old, GitHub is serving a cached copy for
up to 10 minutes; reload then.

### The run failed (red ✗)

Click it. The summary names the file, the line and what to write instead, and the same notes appear
on the line itself in the commit. Fix that line and commit again; your live site stays as it was
until a run succeeds. If it says **One step left: turn on GitHub Pages**, do [step 3](#3-turn-on-github-pages)
and click **Re-run all jobs**. Every message is explained in
[troubleshooting](https://github.com/hangfolio/hangfolio/blob/v1/docs/troubleshooting.md).

### Why does my site say "This is an example site"?

`name` and `email` in `site.yaml` are both still the demo person's. Change both and the banner goes
away, and search engines may index your site.

### I already have a site at username.github.io

Keep it running while you build the new one:

1. Do steps 1 to 5 with a temporary name, such as `new-site`. It goes live at
   `https://<username>.github.io/new-site/` with nothing to configure, and your old site keeps
   serving `https://<username>.github.io/`.
2. Copy your old site's file folders into `public/`, keeping their names: from academicpages,
   `files/` and `images/` become `public/files/` and `public/images/`. Open `public/`, choose
   **Add file → Upload files**, and drag a whole folder in. The addresses of your PDFs stay the same,
   so links from Google Scholar keep working. Coming from al-folio, see
   [where its `assets/` folders go](https://github.com/hangfolio/hangfolio/blob/v1/docs/existing-site.md#keep-your-files-at-the-same-addresses).
3. When you're ready, swap the names in **Settings → General → Repository name**: rename the **old**
   repository to something like `old-site` first, then rename the **new** one to
   `<username>.github.io`. Then open **Actions → Deploy site → Run workflow**, because renaming
   doesn't start a build.
4. If the old repository had a custom domain, remove it from the old repository's **Settings → Pages**
   and add it to the new one's. HTTPS can take up to 24 hours to come back.
5. Optional: once the old repository is renamed, turn off its Pages (**Settings → Pages**), so its
   copy at `/old-site/` goes away. GitHub doesn't let a repository named `<username>.github.io` turn
   Pages off, so do this only after the rename.

More in [Moving an existing site](https://github.com/hangfolio/hangfolio/blob/v1/docs/existing-site.md).

### Is everything in this repository public?

Yes. Anyone can read every file in a public repository, including posts marked `draft: true`, papers
in preparation, comments in your files and your commit history. Only put here what you're happy to
publish.

### How do I get updates?

About once a month, Dependabot opens a pull request named "Update site theme…". Its checks build
your site with the new version. If they're green, click **Merge pull request**. If you ignore it,
your site keeps working as it is. See [Updating](https://github.com/hangfolio/hangfolio/blob/v1/docs/updating.md).

### Where do I ask for help?

In the [hangfolio discussions](https://github.com/hangfolio/hangfolio/discussions), with a link to
your repository. Please don't open issues or pull requests about your own site on
`hangfolio/starter`: your copy is yours, so changes to your site belong in your own repository. If
hangfolio itself does something wrong, open an [issue](https://github.com/hangfolio/hangfolio/issues/new/choose)
with the bug form.

## License

The files that connect your site to the theme are MIT licensed (see [LICENSE](LICENSE)). Your
content, in `site.yaml`, `content/` and `public/`, belongs to you. The example content is public
domain (CC0 1.0), so you can delete it or reuse it freely.
