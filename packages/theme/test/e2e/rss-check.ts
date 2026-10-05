// An RSS 2.0 checker (PLAN M6 verify: the feed validates against an RSS schema checker). It
// applies the RSS 2.0 specification's rules, as the W3C feed validator does, without a network:
// - well-formed XML with one <rss version="2.0"> holding one <channel>;
// - the channel has a title, an absolute http(s) link and a description, and only RSS 2.0
//   elements (or namespaced ones);
// - every item has a title or a description and only RSS 2.0 elements; links are absolute; a
//   guid that is a permalink is an absolute URL, and no two items share a guid;
// - dates are RFC 822 with the right weekday; language is a language tag; categories aren't empty.
// Run it alone with: node packages/theme/test/e2e/rss-check.ts <feed.xml>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const CHANNEL = new Set(['title', 'link', 'description', 'language', 'copyright', 'managingEditor', 'webMaster', 'pubDate', 'lastBuildDate', 'category', 'generator', 'docs', 'cloud', 'ttl', 'image', 'rating', 'textInput', 'skipHours', 'skipDays', 'item']);
const ITEM = new Set(['title', 'link', 'description', 'author', 'category', 'comments', 'enclosure', 'guid', 'pubDate', 'source']);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RFC822 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (GMT|UT|[+-]\d{4})$/;

type Element = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'object' && value !== null ? String((value as Element)['#text'] ?? '') : String(value ?? ''));
const isAbsolute = (value: string) => /^https?:\/\/[^/\s]+/.test(value) && URL.canParse(value);

function dateProblem(value: string): string | undefined {
  const match = RFC822.exec(value);
  if (!match) return `${value} is not an RFC 822 date like "Thu, 20 Aug 2026 00:00:00 GMT"`;
  const [, day, date, month, year] = match;
  const weekday = DAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(date))).getUTCDay()];
  return weekday === day ? undefined : `${value}: ${date} ${month} ${year} is a ${weekday}, not a ${day}`;
}

export function rssProblems(xml: string): string[] {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) return [`not well-formed XML: ${valid.err.msg} (line ${valid.err.line})`];
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, isArray: (name) => name === 'item' || name === 'category' || name === 'channel' });
  const doc = parser.parse(xml) as Element;
  const rss = doc.rss as Element | undefined;
  if (!rss) return ['the root element is not <rss>'];
  const problems: string[] = [];
  if (rss['@_version'] !== '2.0') problems.push(`<rss version="${rss['@_version']}">, not 2.0`);
  const channels = (rss.channel as Element[] | undefined) ?? [];
  if (channels.length !== 1) return [...problems, `<rss> has ${channels.length} <channel> elements, not 1`];
  const channel = channels[0];

  for (const key of ['title', 'link', 'description']) {
    if (!text(channel[key]).trim()) problems.push(`the channel has no <${key}>`);
  }
  if (channel.link && !isAbsolute(text(channel.link))) problems.push(`the channel <link> ${text(channel.link)} is not an absolute http(s) URL`);
  for (const key of Object.keys(channel)) {
    if (!key.startsWith('@_') && !key.includes(':') && !CHANNEL.has(key)) problems.push(`<${key}> is not an RSS 2.0 channel element`);
  }
  if (channel.language && !/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(text(channel.language))) problems.push(`<language>${text(channel.language)}</language> is not a language tag`);
  for (const key of ['pubDate', 'lastBuildDate']) {
    const problem = channel[key] === undefined ? undefined : dateProblem(text(channel[key]));
    if (problem) problems.push(`channel <${key}>: ${problem}`);
  }

  const guids = new Set<string>();
  ((channel.item as Element[] | undefined) ?? []).forEach((item, i) => {
    const where = `item ${i + 1}`;
    if (!text(item.title).trim() && !text(item.description).trim()) problems.push(`${where} has neither a <title> nor a <description>`);
    for (const key of Object.keys(item)) {
      if (!key.includes(':') && !ITEM.has(key)) problems.push(`${where}: <${key}> is not an RSS 2.0 item element`);
    }
    if (item.link !== undefined && !isAbsolute(text(item.link))) problems.push(`${where}: <link> ${text(item.link)} is not an absolute http(s) URL`);
    if (item.guid !== undefined) {
      const guid = text(item.guid);
      const permalink = (item.guid as Element)['@_isPermaLink'] !== 'false';
      if (permalink && !isAbsolute(guid)) problems.push(`${where}: the permalink <guid> ${guid} is not an absolute URL`);
      if (guids.has(guid)) problems.push(`${where}: <guid> ${guid} is used twice`);
      guids.add(guid);
    }
    if (item.pubDate !== undefined) {
      const problem = dateProblem(text(item.pubDate));
      if (problem) problems.push(`${where} <pubDate>: ${problem}`);
    }
    for (const category of (item.category as unknown[] | undefined) ?? []) {
      if (!text(category).trim()) problems.push(`${where}: an empty <category>`);
    }
    if (item.author !== undefined && !/^\S+@\S+/.test(text(item.author))) problems.push(`${where}: <author> must start with an email address`);
  });
  return problems;
}

if (import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node rss-check.ts <feed.xml>');
    process.exit(2);
  }
  const problems = rssProblems(readFileSync(file, 'utf8'));
  for (const problem of problems) console.log(problem);
  console.log(problems.length === 0 ? `rss-check: ${file} is valid RSS 2.0` : `rss-check: ${problems.length} problems`);
  process.exit(problems.length === 0 ? 0 : 1);
}
