// The writing pages (SPEC 5.9): which posts are built, their reading time and the byline under
// each post.
import type { Post } from '../schema/post.ts';
import type { SiteYaml } from './site.ts';

/** Every post that is not a draft, newest first; posts with the same date keep their file order. */
export function publishedPosts<T extends { data: Pick<Post, 'date' | 'draft'> }>(posts: T[]): T[] {
  return posts.filter((post) => !post.data.draft).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Minutes to read the raw body at 200 words a minute, at least 1 (as the reference design counts). */
export function readingMinutes(body = ''): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
}

/** The post's "N min read" figure: its `minutes` pin, else the reading time of its body. */
export const postMinutes = (post: { body?: string; data: Pick<Post, 'minutes'> }) => post.data.minutes ?? readingMinutes(post.body);

/**
 * Who wrote the posts, from site.yaml: "Rowan Vale, PhD student in Computer Science at Example
 * University". Role and affiliation are each left out when not set.
 */
export function byline(site: SiteYaml): string {
  const { role } = site;
  const affiliation = site.affiliation?.name;
  const what = role && affiliation ? `${role} at ${affiliation}` : (role ?? affiliation);
  return what ? `${site.name}, ${what}` : site.name;
}
