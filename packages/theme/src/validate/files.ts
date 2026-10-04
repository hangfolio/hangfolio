// Files in public/ that settings and content point to (E501), and files too big for GitHub Pages
// (W603). Names are compared exactly, because GitHub Pages is case-sensitive even when the
// computer you preview on is not.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Loaded } from './content-files.ts';
import type { Issue } from './issue.ts';
import { locate } from './source.ts';
import { didYouMean, listOf } from './suggest.ts';

/** Keys whose values are files: always checked, and links when they point to a file with an extension. */
const FILE_KEYS = new Set(['avatar', 'ogImage', 'cv', 'thumb', 'full']);
const LINK_KEYS = new Set(['url', 'href']);
const MB = 1024 * 1024;

type Found = { exists: true } | { exists: false; hint: string };

/** Looks for /images/me.jpg (or images/me.jpg) in public/, one exact name at a time. */
export function findPublicFile(root: string, path: string): Found {
  const parts = decoded(path.replace(/[?#].*$/, '')).split('/').filter(Boolean);
  let dir = join(root, 'public');
  let shown = 'public';
  for (const [i, part] of parts.entries()) {
    const names = existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : [];
    if (names.includes(part)) {
      dir = join(dir, part);
      shown += `/${part}`;
      continue;
    }
    const last = i === parts.length - 1;
    const close = names.find((n) => n.toLowerCase() === part.toLowerCase()) ?? didYouMean(part, names);
    if (close) {
      const fixed = `/${[...parts.slice(0, i), close, ...parts.slice(i + 1)].join('/')}`;
      const caseNote = close.toLowerCase() === part.toLowerCase() ? ' File names are case-sensitive on GitHub Pages.' : '';
      return { exists: false, hint: `Did you mean ${fixed}?${caseNote}` };
    }
    if (!last) return { exists: false, hint: `There is no ${shown}/${part} folder.` };
    const files = names.filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isFile());
    return { exists: false, hint: files.length > 0 ? `Files in ${shown}: ${listOf(files)}` : `${shown} has no files.` };
  }
  return existsSync(dir) && statSync(dir).isFile() ? { exists: true } : { exists: false, hint: `${shown} is a folder, not a file.` };
}

function decoded(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

// http//… is a web address missing its colon; the schema reports that (E202).
const isLocal = (value: string) => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#|https?\/\/)/i.test(value);
const isFileLink = (value: string) => /\.[a-z\d]{1,5}$/i.test(value.replace(/[?#].*$/, '')) && !/\.html?$/i.test(value.replace(/[?#].*$/, ''));

/** E501 for every file path in the given files' data (site.yaml and content). */
export function missingFiles(root: string, files: { loaded: Loaded; data: unknown }[], base: string): Issue[] {
  const issues: Issue[] = [];
  const prefix = base.replace(/\/+$/, '');
  for (const { loaded, data } of files) {
    for (const { path, key, value } of strings(data)) {
      const wanted = FILE_KEYS.has(key) || (LINK_KEYS.has(key) && isFileLink(value));
      if (!wanted || !isLocal(value)) continue;
      const found = findPublicFile(root, value);
      if (found.exists) continue;
      let hint = found.hint;
      const rest = prefix && value.startsWith(`${prefix}/`) ? value.slice(prefix.length) : undefined;
      if (rest && findPublicFile(root, rest).exists) hint = `It starts with your base path (${prefix}); write ${rest}.`;
      // Paths start inside public/, so public/images/me.jpg is written /images/me.jpg.
      const inside = value.replace(/^\/?public\//, '/');
      if (inside !== value) {
        const again = findPublicFile(root, inside);
        hint = `Leave out public/ (paths start inside it)${again.exists ? `: ${inside}` : `. ${again.hint}`}`;
      }
      const where = locate(loaded.source, path);
      const position = where ? { line: where.line, col: where.col, endLine: where.endLine, endCol: where.endCol } : {};
      issues.push({ code: 'E501', file: loaded.file, ...position, message: `${key}: ${value} doesn't exist. ${hint}` });
    }
  }
  return issues;
}

/** Every string in parsed data with its key and path. */
function strings(data: unknown, path: PropertyKey[] = [], key = ''): { path: PropertyKey[]; key: string; value: string }[] {
  if (typeof data === 'string') return [{ path, key, value: data }];
  if (Array.isArray(data)) return data.flatMap((item, i) => strings(item, [...path, i], key));
  if (data && typeof data === 'object') return Object.entries(data).flatMap(([k, v]) => strings(v, [...path, k], k));
  return [];
}

/** W603: a file over 50 MB, or more than 900 MB in all (GitHub Pages allows 1 GB). */
export function largeFiles(root: string): Issue[] {
  const dir = join(root, 'public');
  if (!existsSync(dir)) return [];
  const issues: Issue[] = [];
  let total = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath, entry.name);
    const size = statSync(full).size;
    total += size;
    const file = full.slice(root.length + 1).split('\\').join('/');
    if (size > 50 * MB) {
      issues.push({ code: 'W603', file, message: `This file is ${Math.round(size / MB)} MB. GitHub Pages works best with files under 50 MB; put it somewhere else and link to it.` });
    }
  }
  if (total > 900 * MB) {
    issues.push({ code: 'W603', file: 'public', message: `public/ holds ${Math.round(total / MB)} MB. A GitHub Pages site can be at most 1 GB, so move large files elsewhere.` });
  }
  return issues;
}
