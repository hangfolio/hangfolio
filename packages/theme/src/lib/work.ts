// What a project shows as a WorkItem (components/WorkItem.astro), from its front matter (SPEC 5.5):
// - featured: the home page's "Selected work", with the `home` block's overrides and the exhibit;
// - full: the /projects entry, with its facts;
// - compact: the one-line /projects entry (title, summary, links).
import type { Project } from '../schema/project.ts';
import { dateRange } from './dates.ts';
import type { Exhibit } from './exhibits.ts';
import type { SiteYaml } from './site.ts';

export type ProjectEntry = { id: string; data: Project };
export type WorkVariant = 'featured' | 'full' | 'compact';
export type WorkLink = { label: string; href: string } | { code: string };
export type Result = NonNullable<Project['result']>;
export type Fact = Project['facts'][number];

export type WorkView = {
  id: string;
  variant: WorkVariant;
  /** "01": the item's place in its list */
  number: string;
  /** The margin under the number: the `margin` text, else the DateRange parts (maybe none) */
  margin: { text: string } | { range: string[] };
  title: string;
  kicker?: string;
  /** Inline Markdown */
  summary: string;
  result?: Result;
  exhibit?: Exhibit;
  facts: Fact[];
  links: WorkLink[];
  /** Shown in mono instead of the links ("Under submission", "No public link yet") */
  footnote?: string[];
};

/** The projects featured on the home page (those with a `home` block), by home.order, then file order. */
export function featuredProjects<T extends ProjectEntry>(entries: T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.data.home)
    .sort((a, b) => a.entry.data.home!.order - b.entry.data.home!.order || a.index - b.index)
    .map(({ entry }) => entry);
}

/**
 * A project's links as label and href. A {profile} link takes the url of site.yaml's link with
 * that id, and its label unless one is given; one whose link is gone (hidden as an example) is left out.
 */
export function resolveLinks(links: Project['links'], site: SiteYaml): WorkLink[] {
  return links.flatMap((link): WorkLink[] => {
    if ('code' in link) return [{ code: link.code }];
    if ('url' in link) return [{ label: link.label, href: link.url }];
    const profile = site.links.find((entry) => entry.id === link.profile);
    return profile ? [{ label: link.label ?? profile.label, href: profile.url }] : [];
  });
}

export function workView(entry: ProjectEntry, variant: WorkVariant, options: { n: number; site: SiteYaml; locale?: string }): WorkView {
  const { data } = entry;
  const home = variant === 'featured' ? data.home : undefined;
  return {
    id: entry.id,
    variant,
    number: String(options.n).padStart(2, '0'),
    margin: data.margin ? { text: data.margin } : { range: dateRange(data.start, data.end, { locale: options.locale }) },
    title: home?.title ?? data.title,
    kicker: data.kicker,
    summary: home?.summary ?? data.summary,
    result: variant === 'compact' ? undefined : (home?.result ?? data.result),
    exhibit: home?.exhibit,
    facts: variant === 'full' ? data.facts : [],
    links: resolveLinks(home?.links ?? data.links, options.site),
    footnote: home?.footnote,
  };
}
