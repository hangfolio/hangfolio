// The experience page's sections (SPEC 5.7): each `section` value has its place, heading and id;
// `programs` entries join education, whose heading then becomes "Education & programs".
// Entries keep their file order within each section; a section with no entries is left out.
import type { Job } from './home.ts';

export type ExperienceSection = { id: string; heading: string; entries: Job[] };

const SECTIONS = [
  { id: 'professional', heading: 'Professional experience', takes: ['professional'] },
  { id: 'research-experience', heading: 'Research experience', takes: ['research'] },
  { id: 'teaching', heading: 'Teaching experience', takes: ['teaching'] },
  { id: 'education', heading: 'Education', takes: ['education', 'programs'] },
  { id: 'earlier', heading: 'Earlier experience', takes: ['earlier'] },
];

export function experienceSections(entries: Job[]): ExperienceSection[] {
  return SECTIONS.flatMap(({ id, heading, takes }) => {
    const mine = entries.filter((entry) => takes.includes(entry.section));
    if (mine.length === 0) return [];
    const programs = mine.some((entry) => entry.section === 'programs');
    return [{ id, heading: programs ? 'Education & programs' : heading, entries: mine }];
  });
}
