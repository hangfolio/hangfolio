// The RSS feed at advanced.feed.path (lib/feed.ts). Injected only while the writing page is on,
// there is a post, and public/ has no file at that path (lib/endpoints.ts).
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from 'virtual:hangfolio/site';
import { feedOptions } from '../lib/feed.ts';

export const GET: APIRoute = async () => rss(feedOptions(site, await getCollection('writing')));
