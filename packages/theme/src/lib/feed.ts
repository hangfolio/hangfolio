// The RSS feed (SPEC 5.9, 7.2): the published posts, newest first, each with its description
// (description is for search results and RSS; excerpt is the list teaser). Item links and guids
// are absolute through absUrl(), so they carry the base; the channel title and description come
// from advanced.feed. @astrojs/rss writes the XML, in the same shape as the reference design's.
import type { RSSOptions } from '@astrojs/rss';
import type { Post } from '../schema/post.ts';
import { feedTitle } from './endpoints.ts';
import { homePosts } from './home.ts';
import { postPath, siteDescription, type SiteYaml } from './site.ts';
import { absUrl } from './url.ts';

type Entry = { id: string; data: Post };

export function feedOptions(site: SiteYaml, posts: Entry[], abs: (path: string) => string = absUrl): RSSOptions {
  return {
    title: feedTitle(site),
    description: site.advanced.feed.description ?? siteDescription(site),
    site: abs('/'),
    items: homePosts(posts, posts.length).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: abs(postPath(site, post.id)),
      categories: post.data.tags,
    })),
    customData: `<language>${site.advanced.locale.replace('_', '-').toLowerCase()}</language>`,
  };
}
