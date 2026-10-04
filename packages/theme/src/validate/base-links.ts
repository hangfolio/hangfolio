// W601 (SPEC 5.1, 7.2): a link written with the base path already in it, like /my-site/projects
// on a site served at /my-site/. Links are written site-relative and the theme adds the base, so
// the warning says what to write instead. Text is scanned, so the position is the link itself.
import type { Issue } from './issue.ts';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** W601 for each link in `text` (a YAML or Markdown file) that starts with `base`. */
export function baseLinkIssues(file: string, text: string, base: string): Issue[] {
  const prefix = base.replace(/\/+$/, '');
  if (!prefix) return [];
  const yaml = /\.ya?ml$/.test(file);
  const link = new RegExp(`(\\]\\(\\s*|(?:href|src)=["']|:\\s+["']?|-\\s+["']?)(${escape(prefix)}(?:[/?#][^\\s"')\\]]*)?)(?=[\\s"')\\],}]|$)`, 'g');
  const issues: Issue[] = [];
  text.split('\n').forEach((line, i) => {
    if (yaml && /^\s*#/.test(line)) return;
    for (const match of line.matchAll(link)) {
      const path = match[2];
      const col = [...line.slice(0, match.index + match[1].length)].length + 1;
      const rest = path.slice(prefix.length) || '/';
      issues.push({ code: 'W601', file, line: i + 1, col, endLine: i + 1, endCol: col + [...path].length, message: `${path} already includes your base path. Write ${rest}.` });
    }
  });
  return issues;
}
