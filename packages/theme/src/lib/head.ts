// What every page's <head> links to besides the page itself: icons found in public/, the web
// manifest, the feed and sitemap, Google verification, and the generator line. The integration
// works these out once per build (src/lib/endpoints.ts) and Base.astro renders them.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { SiteYaml } from './site.ts';

export type HeadIcon = { rel: string; href: string; type?: string; sizes?: string; mask?: boolean };

// Icon files the head links to when public/ has them, at its root or in images/ (the reference
// design keeps them in images/). `mask` marks Safari's pinned-tab icon, coloured with the accent.
const ICON_FILES: { file: string; rel: string; type?: string; sizes?: string; mask?: boolean }[] = [
  { file: 'favicon.ico', rel: 'icon', sizes: 'any' },
  { file: 'favicon.svg', rel: 'icon', type: 'image/svg+xml' },
  { file: 'favicon-32.png', rel: 'icon', type: 'image/png', sizes: '32x32' },
  { file: 'favicon-32x32.png', rel: 'icon', type: 'image/png', sizes: '32x32' },
  { file: 'apple-touch-icon.png', rel: 'apple-touch-icon' },
  { file: 'safari-pinned-tab.svg', rel: 'mask-icon', mask: true },
];

const FOLDERS = ['', 'images/'];

/** A file in public/, given relative to it ("images/x.png"). */
export type PublicCheck = (file: string) => boolean;

export const publicFileCheck =
  (publicDir: URL): PublicCheck =>
  (file) =>
    existsSync(new URL(file.replace(/^\/+/, ''), publicDir));

/** The icons public/ has, as site-relative hrefs ("/images/apple-touch-icon.png"). */
export function findIcons(has: PublicCheck): HeadIcon[] {
  return ICON_FILES.flatMap(({ file, ...icon }) => {
    const folder = FOLDERS.find((dir) => has(dir + file));
    return folder === undefined ? [] : [{ ...icon, href: `/${folder}${file}` }];
  });
}

// A manifest someone keeps in public/ wins over the generated one, wherever these names put it.
const MANIFEST_FILES = ['manifest.webmanifest', 'site.webmanifest', 'manifest.json'];

/** The site-relative path of a web manifest in public/, if there is one. */
export function findPublicManifest(has: PublicCheck): string | undefined {
  for (const folder of FOLDERS) {
    const file = MANIFEST_FILES.find((name) => has(folder + name));
    if (file) return `/${folder}${file}`;
  }
  return undefined;
}

/** Given and family name for profile:first_name and last_name: advanced.nameParts, else the last word is the family name. */
export function nameParts(site: SiteYaml): { given: string; family?: string } {
  if (site.advanced.nameParts) return site.advanced.nameParts;
  const words = site.name.trim().split(/\s+/);
  if (words.length < 2) return { given: words[0] };
  return { given: words.slice(0, -1).join(' '), family: words.at(-1) };
}

/** A Google verification token as a file name: the token Google shows, with or without ".html". */
export const verificationFile = (token: string) => `/${token.replace(/\.html$/i, '')}.html`;

/**
 * The commit being built: GITHUB_SHA on GitHub Actions, else the site repository's HEAD, else
 * nothing (a folder that is not a git repository).
 */
export function buildSha(root: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const fromEnv = env.GITHUB_SHA?.trim();
  if (fromEnv) return fromEnv;
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const sha = git.status === 0 ? git.stdout.trim() : '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
}

/** The generator meta: "hangfolio 0.1.0 (Astro v7.3.5, build <sha>)"; the deploy smoke check looks for the SHA. */
export function generatorContent(version: string, astro: string, sha?: string): string {
  return `hangfolio ${version} (${astro}${sha ? `, build ${sha}` : ''})`;
}
