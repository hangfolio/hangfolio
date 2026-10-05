# Maintaining hangfolio

For maintainers: what a release is made of, and the exact steps to ship one. Site owners never need
this page.

- [What a release is](#what-a-release-is)
- [One-time setup](#one-time-setup)
- [Every release](#every-release)
- [The first release: 0.1.0 by hand](#the-first-release-010-by-hand)
- [When a release goes wrong](#when-a-release-goes-wrong)

## What a release is

| Part | Where it lives | How it reaches sites |
|---|---|---|
| The npm package `hangfolio` (`packages/theme`) | npm, plus the tag `hangfolio@<version>` here | Dependabot's monthly "Update site theme" pull request in every site |
| The shared workflows (`build.yml`, `deploy.yml`) and the docs | the tag `v1` here | every site's next build; the Help links in the starter |
| The starter (`starter/`) | the template repository `hangfolio/starter` | each new site made with **Create your site** |

Only `hangfolio` is published. The starter and the fixtures are private workspaces that pin its exact
version, and changesets updates them with it. Error messages link to the docs at
`blob/hangfolio@<version>/docs/…`, so every published version needs its tag.

A release always goes in this order: publish the package, sync the starter, run the canary, and only
then move `v1`. The [Release workflow](../.github/workflows/release.yml) does the first part; the
rest is by hand for 0.1.x.

## One-time setup

**npm** (after 0.1.0 exists, because npm can only trust a workflow for a package it has):

1. On npmjs.com, open the `hangfolio` package, then **Settings → Trusted Publisher → GitHub Actions**.
   Enter organization or user `hangfolio`, repository `hangfolio`, workflow filename `release.yml`
   and environment name `npm`, and save.
2. On the same page, under **Publishing access**, choose **Require two-factor authentication and
   disallow tokens**. Trusted publishing keeps working. Never create an npm token for this
   repository: the workflow has none and needs none.

**GitHub, in `hangfolio/hangfolio`:**

- **Settings → Actions → General → Workflow permissions:** tick **Allow GitHub Actions to create
  and approve pull requests** (the organization's Actions settings must allow it too). The
  "Version packages" pull request needs it.
- **Settings → Environments → New environment** named `npm`. Under **Deployment branches and
  tags**, choose **Selected branches and tags** and add `main`. Adding yourself under **Required
  reviewers** makes every publish wait for your approval.
- **Settings → Code security → Private vulnerability reporting:** **Enable** ([SECURITY.md](../SECURITY.md)
  sends reports there).
- **Settings → General → Features:** tick **Discussions**. Keep the default **Q&A** and **Ideas**
  categories; the issue forms link to them.
- **Settings → Rules → Rulesets:** protect `main` (pull requests with CI's checks required) and the
  tags `v*` and `hangfolio@*` (only you may create, move or delete them).

**Your clone:** `git config core.hooksPath .githooks`, so every push is checked against the
denylist.

## Every release

The commands below run in a terminal, in the folder that holds your clone of this repository
(`hangfolio`), and use the [GitHub CLI](https://cli.github.com/). Set these first:

```sh
VERSION=0.1.1                      # the version being released
ENGINE="$PWD/hangfolio"
```

### 1. Changesets

Every pull request that changes what sites get (`packages/theme`, `starter/` or the shared
workflows) adds a changeset for `hangfolio` (`npx changeset`): `patch` for a fix, `minor` for
something new. A release is also what carries a workflow change to `v1`. Its summary becomes the changelog entry and the GitHub release
notes, which Dependabot shows in every site's update pull request. Write it for site owners: what
changes on their site, and whether they need to do anything.

### 2. Merge the "Version packages" pull request

While changesets are waiting on `main`, every push to `main` makes the Release workflow open or
update a pull request named **Version packages** (branch `changeset-release/main`). It bumps
`packages/theme/package.json`, writes `packages/theme/CHANGELOG.md`, moves the exact `hangfolio`
version in `starter/package.json` and every fixture, updates `package-lock.json` (the
`version-packages` script runs `changeset version`, then `npm install --package-lock-only`), and
deletes the changesets it used.

GitHub doesn't start workflows for a pull request that a workflow opened, so CI doesn't run on it by
itself. Click **Close pull request**, then **Reopen pull request**: CI runs. Merge it when it's green.

### 3. Publish (automatic)

The merge is a push to `main`, and the Release workflow runs again:

1. **Version or publish** finds a version that npm doesn't have.
2. **Test and pack** runs `npm ci`, rebuilds the package, checks that nothing changed, runs
   `npm test` and packs the tarball.
3. **Publish to npm** runs in the `npm` environment. It runs `npm publish --provenance` on that
   tarball through trusted publishing, pushes the tag `hangfolio@<version>`, and creates the GitHub
   release from the changelog entry.

Then check it:

```sh
npm view hangfolio version                                       # the new version
npm view "hangfolio@$VERSION" dist.attestations.provenance       # predicateType: https://slsa.dev/provenance/v1
git -C "$ENGINE" fetch origin --tags
SHA=$(git -C "$ENGINE" rev-parse "hangfolio@$VERSION^{commit}")  # the release commit, used below
```

If **Publish to npm** fails, fix the cause and click **Re-run failed jobs**. A version npm already
has is never published twice.

### 4. Sync the starter

`hangfolio/starter` is a copy of `starter/` at the release tag, plus a `package-lock.json` that
pins the published package:

```sh
git clone git@github.com:hangfolio/starter.git    # or, with an existing clone: git -C starter pull
cd starter
git config core.hooksPath "$ENGINE/.githooks"      # the denylist check on push
git config user.email                              # must print your GitHub noreply address

# Replace every tracked file with starter/ at the release commit, keeping the lockfile.
git rm -r -q --ignore-unmatch -- . ':!package-lock.json'
git -C "$ENGINE" archive "$SHA:starter" | tar -xf -
npm install --package-lock-only --ignore-scripts   # moves the lockfile to hangfolio@$VERSION

# The checks a site's build runs, at the template's own address.
npm ci
npx hangfolio check
SITE_PAGES_URL=https://hangfolio.github.io/starter npm run build
SITE_PAGES_URL=https://hangfolio.github.io/starter npx hangfolio verify

git add -A
git status --short       # package.json, package-lock.json and what changed in starter/
git commit -m "hangfolio $VERSION"
git push origin HEAD:main
gh run watch -R hangfolio/starter --exit-status   # choose the Deploy site run for this commit
curl -fsS https://hangfolio.github.io/starter/ | grep -o '<meta name="generator" content="[^"]*"'
cd ..
```

The push runs the template's own **Deploy site** with the current `v1`; it must end green. The
generator tag then names `hangfolio $VERSION`. If it still shows the old version, GitHub is serving a
cached page: try again in a few minutes.

Close any Dependabot pull requests on `hangfolio/starter`: this sync is how the template updates.

### 5. Run the canary

A real copy made from the template, as a new user makes one, whose deploy calls the workflows at the
release commit instead of `v1`:

```sh
CANARY="canary-${VERSION//./-}"                                  # canary-0-1-1
gh repo create "hangfolio/$CANARY" --public --template hangfolio/starter
# Source: GitHub Actions. If it answers Not Found, GitHub is still copying: wait a moment, run it again.
gh api -X POST "repos/hangfolio/$CANARY/pages" -f build_type=workflow
gh repo clone "hangfolio/$CANARY"
cd "$CANARY"
git config core.hooksPath "$ENGINE/.githooks"
perl -pi -e "s/\@v1\$/\@$SHA/" .github/workflows/deploy.yml      # build.yml and deploy.yml at the release commit
perl -pi -e 's/^name: .*/name: "Canary Tester"/; s/^tagline: .*/tagline: "Checks each release before anyone gets it."/; s/^role: .*/role: "Release canary"/; s/^affiliation: .*/affiliation: "hangfolio"/; s/^email: .*/email: "canary\@hangfolio.test"/' site.yaml
git commit -am "Canary for hangfolio $VERSION"
git push
gh run watch --exit-status                                       # choose the run for this commit
```

When it's green, check the live page and its stylesheet:

```sh
curl -fsS "https://hangfolio.github.io/$CANARY/" -o canary.html
grep -c 'Canary Tester' canary.html                              # 1 or more
grep -o '<meta name="generator" content="[^"]*"' canary.html     # hangfolio $VERSION
CSS=$(grep -o 'href="[^"]*\.css"' canary.html | head -n 1 | cut -d '"' -f 2)
curl -fsS -o /dev/null -w '%{http_code} %{content_type}\n' "https://hangfolio.github.io$CSS"   # 200 text/css
cd ..
gh repo delete "hangfolio/$CANARY" --yes                         # needs: gh auth refresh -s delete_repo
```

### 6. Move v1

Only when all three are green for `$SHA`: CI on `main`, the template's **Deploy site**, and the
canary.

```sh
cd "$ENGINE"
git fetch origin --tags
PREVIOUS=$(git rev-parse "v1^{commit}")       # note it down, to move back if needed
git tag -f v1 "$SHA"
git push --force origin refs/tags/v1
gh workflow run "Deploy site" -R hangfolio/starter   # rebuild the demo with the new workflows
cd ..
```

Every site's next build now uses the new workflows, and the starter's Help links show the new docs.
Check the demo once more with the `curl` line from step 4.

## The first release: 0.1.0 by hand

npm can trust a workflow only for a package that already exists, so 0.1.0 is published from your
machine; every later version comes from the Release workflow. There is no `v1` and no
`hangfolio/starter` yet either, so the order differs from the steps above.

**1. Check the release commit.** `main` has the "Version hangfolio 0.1.0" commit and isn't pushed
yet:

```sh
VERSION=0.1.0
ENGINE="$PWD/hangfolio"
cd "$ENGINE"
git status --short                       # nothing
npm ci
npm run build -w packages/theme && git diff --exit-code
npm test && npm run docs:check
```

**2. Publish.**

```sh
cd packages/theme
npm pack --dry-run      # 158 files, about 163 kB: LICENSE, README.md, package.json, bin/, schema/, src/, starter-values.json
npm whoami              # the account that owns hangfolio on npm; otherwise npm login
npm publish             # public through publishConfig; npm asks for your second factor
npm view hangfolio@0.1.0 version
cd "$ENGINE"
```

There's no `--provenance` here: npm can only make a provenance statement on a CI provider. From
0.1.1 on, the Release workflow adds one.

**3. Tag and push.**

```sh
git tag -a hangfolio@0.1.0 -m "hangfolio@0.1.0"
git push origin main hangfolio@0.1.0
gh release create hangfolio@0.1.0 --verify-tag --title hangfolio@0.1.0 --notes "First public release"
SHA=$(git rev-parse "hangfolio@0.1.0^{commit}")
cd ..
```

The Release run this push starts finds 0.1.0 on npm and stops after **Version or publish**. Wait
for CI on this commit to go green, then do the [one-time setup](#one-time-setup).

**4. Run the canary.** With no template yet, push the starter to a new repository yourself. Its first
run is a green welcome run that publishes nothing; the second publishes.

```sh
CANARY=canary-0-1-0
gh repo create "hangfolio/$CANARY" --public
mkdir "$CANARY" && cd "$CANARY" && git init -b main
git config core.hooksPath "$ENGINE/.githooks"
git -C "$ENGINE" archive "$SHA:starter" | tar -xf -
npm install --package-lock-only --ignore-scripts
perl -pi -e "s/\@v1\$/\@$SHA/" .github/workflows/deploy.yml
git add -A && git commit -m "Initial commit"
git remote add origin "git@github.com:hangfolio/$CANARY.git"
git push -u origin main
gh api -X POST "repos/hangfolio/$CANARY/pages" -f build_type=workflow
```

Then make the same `site.yaml` edit as in [step 5](#5-run-the-canary) above, commit, push, watch the
run and check the page and its stylesheet the same way. Before announcing 0.1, also open one pull
request on the canary from a fork in a second account: its **Deploy site** run must go green
without publishing anything ([S6](decisions/S6.md)).

**5. Create v1.**

```sh
git -C "$ENGINE" tag v1 "$SHA"
git -C "$ENGINE" push origin refs/tags/v1
```

**6. Create the template repository and sync it.**

```sh
gh repo create hangfolio/starter --public --disable-issues --disable-wiki \
  --description "Template for a hangfolio site: your personal website on GitHub Pages" \
  --homepage https://hangfolio.github.io/starter/
gh repo edit hangfolio/starter --template
```

Then follow [step 4](#4-sync-the-starter) above (the clone starts empty, and `npm install` creates
the lockfile). The push starts a green welcome run that publishes nothing. Then turn on Pages and
publish the demo:

```sh
gh api -X POST repos/hangfolio/starter/pages -f build_type=workflow
gh workflow run "Deploy site" -R hangfolio/starter
gh run watch -R hangfolio/starter --exit-status
curl -fsS https://hangfolio.github.io/starter/ | grep -o '<meta name="generator" content="[^"]*"'   # hangfolio 0.1.0
```

**7. Try it as a stranger.** From a second GitHub account, follow only the starter's README, from
**Create your site** to a live site with your own name. Then delete the canary repositories.

## When a release goes wrong

- **A bad package.** Release a fixed patch the usual way. Mark the bad version:
  `npm deprecate "hangfolio@<bad version>" "Broken: use <fixed version> or later"`. Don't unpublish
  it: lockfiles and Dependabot pull requests may already point at it.
- **A bad `v1`.** Move it back: `git tag -f v1 "$PREVIOUS" && git push --force origin refs/tags/v1`.
  A broken workflow fails builds; it never takes a live site down, because a failed build publishes
  nothing.
- **A broken template.** Revert the sync commit on `hangfolio/starter` and push. Existing sites
  aren't affected: a copy keeps nothing in common with the template after it's made.
