# Custom domain

Your site works at `https://<username>.github.io/…` without any of this. A custom domain such as
`https://yourname.com` is optional. You'll need a domain from a registrar and access to its DNS
settings.

The domain is set in GitHub's settings, not in a file: GitHub ignores `CNAME` files for sites
published by a workflow, and `site.yaml` has no domain field. Canonical links, the sitemap and the
feed switch to the new domain by themselves on the next build.

## Steps

1. **Verify the domain with GitHub first** (recommended): your profile's *Settings → Pages → Add a
   domain*, then add the TXT record GitHub shows you. This stops anyone else from using your domain
   on GitHub Pages.
2. In your site's repository, open *Settings → Pages → Custom domain*, type the domain, and click
   **Save**.
3. Add the DNS records at your registrar (below).
4. Wait until GitHub's DNS check passes, then tick **Enforce HTTPS**. The certificate can take up to
   24 hours to be issued.
5. Run **Actions → Deploy site → Run workflow**, so the site is rebuilt with its new address.

## DNS records

**An apex domain** (`yourname.com`): four `A` records, and optionally four `AAAA` records for IPv6.

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

**`www`** (`www.yourname.com`), whether as your main address or alongside the apex: a `CNAME` record
named `www` pointing to `<username>.github.io` (your username, not the repository name). With both
set up, GitHub redirects one to the other.

**A subdomain** (`site.yourname.com`): a `CNAME` record named `site` pointing to
`<username>.github.io`.

Don't use wildcard records such as `*.yourname.com`: they let others serve pages under your domain.

## Project sites and inherited domains

A custom domain set on your `<username>.github.io` repository also applies to your other
repositories with Pages turned on: a repository named `website` is then served at
`https://yourname.com/website/`. Such a repository hides any page of your main site at the same path,
so avoid repository names like `projects` or `writing` for repositories with Pages on. The deploy
summary always prints the final address.

A project site can have its own custom domain too: set it in that repository's *Settings → Pages*.

## Moving a domain from an old site

Remove the domain from the old repository's *Settings → Pages* first, then add it to the new one. HTTPS
can take up to 24 hours to come back. See [variant B](quickstart.md#variant-b-you-already-have-a-site-at-usernamegithubio).

## Pinning the address

If you host the built site somewhere other than GitHub Pages, set `url: "https://yourname.com"` in
`site.yaml` so canonical links use it. On GitHub Pages you don't need it; if it disagrees with the
address GitHub reports, the build warns you.

## If something goes wrong

- **"DNS check unsuccessful"**: DNS changes can take up to 24 hours to spread. Check the records
  with your registrar, and remove any old `A` records that point elsewhere.
- **"Enforce HTTPS" is greyed out**: the certificate isn't issued yet. Wait, then try again; removing
  and re-adding the domain restarts the request.
- **The site still links to the old address**: run **Actions → Deploy site → Run workflow** after the
  domain is saved.
- **The domain disappeared from the settings**: it's set in *Settings → Pages* only; a `CNAME` file in
  the repository doesn't set it for this kind of site. Add it again there.
