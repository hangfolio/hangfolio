// A Sätteri hast plugin (Astro 7's Markdown and MDX processor; S1): root-relative href and src
// values written in content go through url(). A value that already starts with the base is left
// alone, so nothing is prefixed twice (SPEC 7.2); the checks warn W601 with its file and line.
import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { hasBase, url } from './url.ts';

// A plugin definition object (an entry may also be a factory function, a nested list or false).
type HastPlugin = Exclude<Extract<NonNullable<SatteriProcessorOptions['hastPlugins']>[number], { name: string }>, Function>;
type ElementVisitor = Exclude<HastPlugin['element'], readonly unknown[] | undefined>;

export function baseLinks(base: string): HastPlugin & { element: ElementVisitor } {
  return {
    name: 'hangfolio-base-links',
    element: {
      filter: ['a', 'img'],
      visit(node, ctx) {
        for (const key of ['href', 'src']) {
          const value = node.properties?.[key];
          if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || hasBase(value, base)) continue;
          ctx.setProperty(node, key, url(value, base));
        }
      },
    },
  };
}
