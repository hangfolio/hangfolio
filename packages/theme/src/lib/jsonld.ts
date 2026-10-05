// The JSON-LD graph every page carries (SPEC 7.2): WebSite and Person, plus the page's own nodes
// (BlogPosting on a post, ContactPage on the contact page, ScholarlyArticle for each paper).
// Every URL goes through absUrl(), and @ids are stable, in the reference design's shape:
//   <home>#website, <home>#person, <post URL>#article, <contact URL>#webpage, <page URL>#<anchor>
import { absUrl } from './url.ts';
import { localeTag, siteDescription, type SiteYaml } from './site.ts';

export type Node = Record<string, unknown>;
type Abs = (path: string) => string;

// Drops undefined values and empty arrays, so optional settings leave no empty keys.
const compact = (node: Node) =>
  Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

/** The stable @ids. */
export const ids = {
  website: (abs: Abs = absUrl) => `${abs('/')}#website`,
  person: (abs: Abs = absUrl) => `${abs('/')}#person`,
  article: (path: string, abs: Abs = absUrl) => `${abs(path)}#article`,
  webpage: (path: string, abs: Abs = absUrl) => `${abs(path)}#webpage`,
  /** A paper's node: the page it is listed on plus its anchor, e.g. /publications#vale2024bounded */
  paper: (path: string, anchor: string, abs: Abs = absUrl) => `${abs(path)}#${anchor}`,
};

/** A calendar day ("2026-08-14") from a date; front matter dates are days, so in UTC. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function siteGraph(site: SiteYaml, image: string | undefined, extra: Node[] = [], abs: Abs = absUrl) {
  const home = abs('/');
  const affiliation = site.affiliation;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      compact({
        '@type': 'WebSite',
        '@id': ids.website(abs),
        url: home,
        name: site.name,
        description: siteDescription(site),
        publisher: { '@id': ids.person(abs) },
        inLanguage: localeTag(site),
      }),
      compact({
        '@type': 'Person',
        '@id': ids.person(abs),
        name: site.name,
        url: home,
        image,
        jobTitle: site.seo?.jobTitle ?? site.role,
        email: `mailto:${site.email}`,
        worksFor: affiliation && compact({ '@type': 'Organization', name: affiliation.name, url: affiliation.url }),
        alumniOf: site.seo?.alumniOf?.map((name) => ({ '@type': 'Organization', name })),
        sameAs: site.links.map((link) => link.url).filter((href) => /^https?:/.test(href)),
        knowsAbout: site.seo?.knowsAbout,
      }),
      ...extra,
    ],
  };
}

export type PostInfo = { path: string; headline: string; description?: string; published: Date; modified?: Date; tags?: readonly string[] };

/** A post's BlogPosting, written by and published by the site's Person. */
export function blogPosting(site: SiteYaml, post: PostInfo, abs: Abs = absUrl): Node {
  return compact({
    '@type': 'BlogPosting',
    '@id': ids.article(post.path, abs),
    headline: post.headline,
    description: post.description,
    datePublished: isoDay(post.published),
    dateModified: post.modified && isoDay(post.modified),
    author: { '@id': ids.person(abs) },
    publisher: { '@id': ids.person(abs) },
    mainEntityOfPage: abs(post.path),
    keywords: post.tags && post.tags.length > 0 ? post.tags.join(', ') : undefined,
    inLanguage: localeTag(site),
  });
}

/** The contact page's ContactPage, part of the WebSite and about the Person. */
export function contactPage(path: string, name: string, abs: Abs = absUrl): Node {
  return {
    '@type': 'ContactPage',
    '@id': ids.webpage(path, abs),
    url: abs(path),
    name,
    isPartOf: { '@id': ids.website(abs) },
    about: { '@id': ids.person(abs) },
  };
}

/**
 * What a ScholarlyArticle is made from. The publications page fills this from a BibTeX entry
 * (lib/bib-page.ts); `schema` from the paper's extras file is merged over the result.
 */
export type PaperInfo = {
  /** The page that lists the paper, site-relative ("/publications") */
  path: string;
  /** The paper's id on that page */
  anchor: string;
  title?: string;
  /** In order; `self` marks the site's owner, who becomes a reference to the Person */
  authors: { name: string; self?: boolean }[];
  /** "2024", "2024-05" or "2024-05-13" */
  date?: string;
  publisher?: string;
  /** BibTeX pages, "1138--1148" */
  pages?: string;
  doi?: string;
  /** A web address for the paper, used as sameAs when there is no DOI */
  url?: string;
  schema?: Node;
};

export function scholarlyArticle(paper: PaperInfo, abs: Abs = absUrl): Node {
  const doi = paper.doi?.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:)/i, '');
  const node = compact({
    '@type': 'ScholarlyArticle',
    '@id': ids.paper(paper.path, paper.anchor, abs),
    headline: paper.title,
    name: paper.title,
    author: paper.authors.map((author) => (author.self ? { '@id': ids.person(abs) } : { '@type': 'Person', name: author.name })),
    datePublished: paper.date,
    publisher: paper.publisher ? { '@type': 'Organization', name: paper.publisher } : undefined,
    pagination: paper.pages?.replace(/\s*[-–—]+\s*/g, '-'),
    identifier: doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } : undefined,
    sameAs: doi ? `https://doi.org/${doi}` : paper.url && /^https?:/i.test(paper.url) ? paper.url : undefined,
    url: abs(paper.path),
  });
  return { ...node, ...paper.schema };
}

/**
 * A page's nodes: the ones it passes, plus each derived node (a post's BlogPosting, the contact
 * page's ContactPage) unless the page already passes a node with that @id.
 */
export function pageNodes(given: Node[], derived: (Node | undefined)[]): Node[] {
  const taken = new Set(given.map((node) => node['@id']));
  return [...given, ...derived.filter((node): node is Node => node !== undefined && !taken.has(node['@id']))];
}
