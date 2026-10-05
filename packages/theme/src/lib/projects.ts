// The /projects page (SPEC 5.5): which projects it lists, in which groups, and how they are
// numbered. Groups come in content/projects.yaml order, then in the order the projects first use
// them. Numbers (01, 02 …) continue across groups, and each list starts at its first number
// (<ol start>), so consecutive compact projects can share a smaller list.
import type { ProjectsGroups } from '../schema/project.ts';
import { inlineMd } from './inline-md.ts';
import { slug } from './links.ts';
import type { ProjectEntry } from './work.ts';

type GroupSettings = ProjectsGroups['groups'][number];

export type ProjectRun<T> = { compact: boolean; start: number; entries: T[] };

export type ProjectGroup<T> = {
  title: string;
  /** The section's id, which the jump links point at */
  id: string;
  /** The heading's id, which the section's aria-labelledby names */
  headingId: string;
  link?: GroupSettings['link'];
  runs: ProjectRun<T>[];
};

/** The projects /projects lists: `listed` ones, by `order` (those without one after), then file order. */
export function listedProjects<T extends ProjectEntry>(entries: T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.data.listed)
    .sort((a, b) => (a.entry.data.order ?? Infinity) - (b.entry.data.order ?? Infinity) || a.index - b.index)
    .map(({ entry }) => entry);
}

/** A project gets its own page when its file has a body (SPEC 5.5). */
export const hasPage = (entry: { body?: string }) => Boolean(entry.body?.trim());

/** Group names match without regard to case or extra spaces: "developer tools" is "Developer  Tools". */
const groupKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

export function projectGroups<T extends ProjectEntry>(entries: T[], settings: GroupSettings[] = []): ProjectGroup<T>[] {
  const listed = listedProjects(entries);
  const used = new Set(listed.map((entry) => groupKey(entry.data.group)));
  // A projects.yaml group that no listed project uses shows nothing, so it takes no id.
  const shown = settings.filter((group) => used.has(groupKey(group.title)));
  // Each group once: projects.yaml's title for it, else the title its first project uses.
  const titles = new Map<string, string>();
  for (const title of [...shown.map((group) => group.title), ...listed.map((entry) => entry.data.group)]) {
    if (!titles.has(groupKey(title))) titles.set(groupKey(title), title);
  }
  const taken = new Set(shown.map((group) => group.id));
  let n = 1;
  return [...titles].map(([key, title]) => {
    const members = listed.filter((entry) => groupKey(entry.data.group) === key);
    const own = shown.find((group) => groupKey(group.title) === key);
    let id = own?.id;
    if (!id) {
      const base = slug(title) || 'group';
      id = base;
      for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
      taken.add(id);
    }
    const runs: ProjectRun<T>[] = [];
    for (const entry of members) {
      const last = runs.at(-1);
      if (last && last.compact === entry.data.compact) last.entries.push(entry);
      else runs.push({ compact: entry.data.compact, start: n, entries: [entry] });
      n++;
    }
    return { title, id, headingId: own?.headingId ?? `${id}-h`, link: own?.link, runs };
  });
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"' };

/** Inline Markdown as plain text, for a meta description: marks dropped, links reduced to their text. */
export function plainText(md: string): string {
  return inlineMd(md, '/')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot);/g, (_, name: string) => ENTITIES[name]);
}
