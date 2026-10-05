# Quickstart

From "found it on GitHub" to your own site, live, in 5 steps and about 10 minutes, all in the
browser. You need a GitHub account with a verified email address.

- [The 5 steps](#1-create-your-copy)
- [Variant B: you already have a site at username.github.io](#variant-b-you-already-have-a-site-at-usernamegithubio)
- [Variant C: with a terminal](#variant-c-with-a-terminal)

## 1. Create your copy

Open [Create your site](https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public).
GitHub's "Create a new repository" form opens with the `hangfolio/starter` template chosen. This
makes a copy that is entirely yours. Don't fork the template instead: forks can't run the deploy.

<!-- SCREENSHOT step-1: images/step-1.png
     alt: GitHub's "Create a new repository" form, with hangfolio/starter selected as the template. -->

## 2. Name it and create it

Type the repository name and leave it **Public**. GitHub Pages needs a public repository on a free
plan, and the site is public anyway.

| Repository name | Your site's address |
|---|---|
| `<your-username>.github.io` | `https://<your-username>.github.io/` |
| anything else, e.g. `website` | `https://<your-username>.github.io/website/` |

Click **Create repository**. The copy starts a **Deploy site** run, which checks and builds the example
site. It ends green, and its summary lists the steps that are left, with direct links.

A repository named `<your-username>.github.io` is also published straight away by GitHub's older
"branch" mode, which shows a short "Almost there" page until you finish step 3.

<!-- SCREENSHOT step-2: images/step-2.png
     alt: The repository name field filled in with a username followed by .github.io, Public selected, and the Create repository button. -->

## 3. Turn on GitHub Pages

Open **Settings → Pages**. Under *Build and deployment*, set **Source** to **GitHub Actions**. Nothing
visible happens yet.

> [!IMPORTANT]
> **Don't click "Configure" on any workflow GitHub suggests on that page.** Your copy already has its
> own, **Deploy site**. A suggested workflow would add a second deploy that overwrites your site. If
> you clicked one, delete the file it created under `.github/workflows/`
> ([details](troubleshooting.md#a-second-workflow-publishes-to-github-pages)).

GitHub doesn't let a workflow change this setting, so it is the one click you have to make yourself.

<!-- SCREENSHOT step-3: images/step-3.png
     alt: Settings, Pages, with Source set to GitHub Actions. The suggested workflow cards below it are crossed out. -->

## 4. Make it yours

Open `site.yaml` and click the pencil icon. Replace the five values marked `required` (`name`,
`tagline`, `role`, `affiliation`, `email`) and the `links`. Every other line marked `# example` is optional:
change it or delete it. Keep the quotes and the spacing.

Click **Commit changes…**, choose **Commit directly to the main branch**, and click **Commit changes**.

<!-- SCREENSHOT step-4: images/step-4.png
     alt: site.yaml open in GitHub's editor, with the name and email lines changed and the Commit changes button. -->

**Deploy site** runs again:

- If you commit before finishing step 3, it waits up to 5 minutes for it (during a copy's first 5
  runs).
- It checks every file first. A mistake fails the run with the file, the line and the fix, GitHub
  emails you, and nothing on the web changes. See [Troubleshooting](troubleshooting.md).
- Example content you haven't replaced (projects, the paper, the post, the availability box and the
  booking link) is hidden from your site and listed in the run summary.

## 5. Open your site

About 2 minutes later, the run's summary says **Live at https://…**. The same link is in
*Settings → Pages* and in the **Deployments** box on your repository's front page.

<!-- SCREENSHOT step-5: images/step-5.png
     alt: A finished Deploy site run whose summary says Live at, followed by the site's address. -->

You'll see your name, tagline, role, links and email, and your initials in place of a photo. Search
engines may index it from now on. If the page still looks old, reload in a few minutes: GitHub caches
pages for up to 10 minutes.

Next: [Editing your site](editing.md) covers your photo and CV, papers, projects, experience, news and
posts.

## Variant B: you already have a site at username.github.io

Most people who already have an academic site have it at `https://<username>.github.io/`, for example
from academicpages or al-folio. You can build the new site next to it and swap when you're ready:

1. Do steps 1 to 5 with a temporary repository name, such as `new-site`. It goes live at
   `https://<username>.github.io/new-site/` without any configuration, while the old site keeps
   serving the root. If your old site has a custom domain, the new one appears under it too, at
   `https://<your-domain>/new-site/`.
2. Copy over your old `files/` and `images/` folders into `public/` (*Add file → Upload files*, then
   drag a whole folder). Their addresses stay the same, so PDF links indexed by Google Scholar keep
   working. [Moving an existing site](existing-site.md) covers the rest of the content.
3. When you're ready, swap the names in *Settings → General → Repository name*. Rename the **old**
   repository first (to `old-site`, say), then the **new** one to `<username>.github.io`. Then run
   **Actions → Deploy site → Run workflow**, because a rename doesn't start a build.
4. If the old repository had a custom domain, remove it from the old repository's *Settings → Pages*
   and add it to the new one's. HTTPS can take up to 24 hours to be issued again.
5. Optional: turn off Pages for the renamed old repository (*Settings → Pages*), so its copy at
   `/old-site/` disappears. GitHub never lets a repository named `<username>.github.io` turn Pages
   off, so this works only after the rename, when the old repository has become an ordinary project
   site.

## Variant C: with a terminal

Create your copy as in steps 1 to 3, then clone it and work locally with Node 22.12 or later:

```sh
git clone https://github.com/<you>/<repository>.git
cd <repository>
npm install
npm run dev       # a preview at http://localhost:4321 that reloads as you edit
npm run check     # the same checks the deploy runs
```

Edit the same files, then commit and push. Every push to your default branch publishes the site.
See [Local preview](local-preview.md).
