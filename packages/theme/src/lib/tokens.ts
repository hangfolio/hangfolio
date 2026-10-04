// Reads the design tokens out of tokens.css for the places that need them outside CSS: the
// theme-color meta today, and the manifest and Cal.com colours later (SPEC 6.1).

export type TokenBlock = { selector: string; values: Record<string, string> };

/** Every innermost `selector { --name: value; … }` block, in file order. */
export function tokenBlocks(css: string): TokenBlock[] {
  return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    values: Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])),
  }));
}

/** The light (`:root`) and dark (`html[data-theme="dark"]`) values, keyed without the leading `--`. */
export function parseTokens(css: string): { light: Record<string, string>; dark: Record<string, string> } {
  const blocks = tokenBlocks(css);
  const light = blocks.find((b) => b.selector === ':root')?.values ?? {};
  const dark = blocks.find((b) => b.selector === 'html[data-theme="dark"]')?.values ?? {};
  return { light, dark };
}
