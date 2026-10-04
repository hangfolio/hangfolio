// Messages about the /card page (SPEC-card-wallet.md 3.9): a long site address makes a dense QR
// code (W801), an avatar that can't go into card.vcf leaves the contact without a photo (W802),
// and in local preview the QR points to localhost (N803, dev only).
import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { Site } from '../schema/site.ts';
import type { Issue } from './issue.ts';
import { locate, type Source } from './source.ts';

/** Version 5 of a level-M QR code holds 84 characters; longer addresses need version 6 or more. */
const QR_LIMIT = 84;
const EMBED_LIMIT = 64 * 1024;

export function qrIssue(home: string, cardPath: string, site: Source | undefined, pinned: boolean): Issue[] {
  if (home.length <= QR_LIMIT) return [];
  const at = pinned && site ? locate(site, ['url']) : null;
  const message =
    `Your site address is ${home.length} characters, so the QR code on ${cardPath} is dense and harder to scan from a distance. ` +
    'A shorter custom domain or repository name gives a simpler code.';
  return [{ code: 'W801', ...(at ? { file: 'site.yaml', line: at.line, col: at.col } : {}), message }];
}

export function localQrNotice(home: string, cardPath: string): Issue {
  const message = `In local preview the QR code on ${cardPath} points to ${home}. Your deployed card points to your real address.`;
  return { code: 'N803', message, page: cardPath };
}

const FORMATS: Record<string, string> = {
  jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', webp: 'WebP', gif: 'GIF', avif: 'AVIF', tif: 'TIFF', tiff: 'TIFF',
  svg: 'SVG', heic: 'HEIC', heif: 'HEIF', bmp: 'BMP', ico: 'ICO',
};
// What sharp can read and crop (SPEC-card-wallet.md 3.5). Its prebuilt binaries can't read HEIC photos.
const SHARP_READS = new Set(['JPEG', 'PNG', 'WebP', 'GIF', 'AVIF', 'TIFF', 'SVG']);

let sharpLoaded: Promise<boolean> | undefined;
/** Whether sharp (an optional dependency of Astro) is installed. */
export function hasSharp(): Promise<boolean> {
  sharpLoaded ??= import('sharp').then(() => true, () => false);
  return sharpLoaded;
}

const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} bytes` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * W802 when card.vcf would have no photo: with sharp, any format it reads is resized; without
 * it, only a JPEG or PNG of 64 KB or less is embedded as it is.
 */
export function photoIssue(root: string, avatar: string, sharp: boolean, site: Source | undefined, written: boolean): Issue[] {
  const file = join(root, 'public', avatar.replace(/^\//, ''));
  const bytes = statSync(file).size;
  const format = FORMATS[avatar.split('.').pop()!.toLowerCase()] ?? (avatar.split('.').pop()!.toUpperCase() || 'unknown');
  const fits = format === 'JPEG' || format === 'PNG' ? bytes <= EMBED_LIMIT : false;
  if (sharp ? SHARP_READS.has(format) : fits) return [];
  const why = !sharp && bytes > EMBED_LIMIT ? 'is too large to embed in card.vcf without resizing' : "can't be embedded in card.vcf in that format";
  const message = `The avatar (${size(bytes)} ${format}) ${why}, so the contact file has no photo. Use a JPEG or PNG under 64 KB if you want one.`;
  const at = written && site ? locate(site, ['avatar']) : null;
  return [{ code: 'W802', ...(at ? { file: 'site.yaml', line: at.line, col: at.col } : { file: `public${avatar}` }), message }];
}

/** The card page's path, or undefined when pages.card is false. */
export const cardPath = (site: Site) => (site.pages.card === false ? undefined : site.pages.card.path);
