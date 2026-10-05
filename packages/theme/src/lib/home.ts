// How the home page is put together (SPEC 5.4): which entries each list shows, and which
// sections appear, in home.yaml `sections` order, each with its id from advanced.anchors.
// A section with nothing to show is left out; the contact section always has the email.
import type { Experience } from '../schema/experience.ts';
import type { Home } from '../schema/home.ts';
import type { News } from '../schema/news.ts';
import type { Post } from '../schema/post.ts';

export type Section = Home['sections'][number];
export type Job = Experience['entries'][number];
export type NewsItem = News['items'][number];

/** The jobs on the home page: entries with a `home` line, in file order across sections, at most `count`. */
export function homeJobs(entries: Job[], count: number): Job[] {
  return entries.filter((entry) => entry.home !== undefined).slice(0, count);
}

/** The home page's Education lines: education and programs entries with a `homeLine`, all of them, in file order. */
export function homeEducation(entries: Job[]): Job[] {
  return entries.filter((entry) => (entry.section === 'education' || entry.section === 'programs') && entry.homeLine);
}

/** The first `count` news items, in file order (the file is newest first). */
export function homeNews(items: NewsItem[], count: number): NewsItem[] {
  return items.slice(0, count);
}

/** The newest `count` posts that are not drafts; posts with the same date keep their file order. */
export function homePosts<T extends { data: Pick<Post, 'date' | 'draft'> }>(posts: T[], count: number): T[] {
  return posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, count);
}

/** True when home.yaml's research block has something to show and its section is listed. */
export function showsResearch(home: Pick<Home, 'research' | 'sections'> | undefined): boolean {
  const research = home?.research;
  if (!research || !home.sections.includes('research')) return false;
  return Boolean(research.problem || research.approach.length > 0 || research.status || research.featured || research.teaching);
}

export type PlannedSection = {
  section: Section;
  /** The section's id (advanced.anchors) */
  id: string;
  /** Experience only: the education lines join it, under its id (anchors.education) */
  education?: string;
};

/**
 * The sections to render, in `sections` order, leaving out those with nothing to show. When
 * education comes right after experience in `sections` and experience shows, the education lines
 * join the experience section (as on the reference design); otherwise they get their own section.
 */
export function planSections(sections: Section[], anchors: Record<Section, string>, shows: Record<Section, boolean>): PlannedSection[] {
  const plan: PlannedSection[] = [];
  sections.forEach((section, i) => {
    if (!shows[section]) return;
    if (section === 'education' && sections[i - 1] === 'experience' && shows.experience) return;
    const joined = section === 'experience' && sections[i + 1] === 'education' && shows.education;
    plan.push({ section, id: anchors[section], ...(joined && { education: anchors.education }) });
  });
  return plan;
}
