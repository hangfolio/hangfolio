// The content the pages are built from, read through the content collections (src/content.ts).
// Pages, the header and the home page all ask here, so a page and the links to it always agree
// on whether it exists.
import { getCollection, getEntry } from 'astro:content';
import { showsResearch } from './home.ts';
import type { PageContent } from './nav.ts';
import { listedProjects } from './projects.ts';
import { publishedPosts } from './writing.ts';

export const projectEntries = () => getCollection('projects');
export const experienceEntries = async () => (await getEntry('experience', 'experience'))?.data.entries ?? [];
export const posts = async () => publishedPosts(await getCollection('writing'));

/** Which content-backed pages have something to show (lib/nav.ts availablePages). */
export async function pageContent(): Promise<PageContent> {
  const home = (await getEntry('home', 'home'))?.data;
  return {
    research: showsResearch(home),
    projects: listedProjects(await projectEntries()).length > 0,
    experience: (await experienceEntries()).length > 0,
    writing: (await posts()).length > 0,
  };
}
