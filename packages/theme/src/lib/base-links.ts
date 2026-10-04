// A Sätteri hast plugin (Astro 7's Markdown and MDX processor; S1): root-relative href and src
// values written in content go through url(). A value that already starts with the base is left
// alone, so nothing is prefixed twice (SPEC 7.2). TODO(M2): warn W601 when that happens.
import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { url } from './url.ts';

// A plugin definition object (an entry may also be a factory function, a nested list or false).
type HastPlugin = Exclude<Extract<NonNullable<SatteriProcessorOptions['hastPlugins']>[number], { name: string }>, Function>;
type ElementVisitor = Exclude<HastPlugin['element'], readonly unknown[] | undefined>;

export function baseLinks(base: string): HastPlugin & { element: ElementVisitor } {
  const prefix = base.replace(/\/+$/, '');
  // '/hangfolio', '/hangfolio/x', '/hangfolio?q' and '/hangfolio#x' carry the base; '/hangfolios' does not.
  const hasBase = (value: string) =>
    prefix !== '' && value.startsWith(prefix) && /^(?:$|[/?#])/.test(value.slice(prefix.length));
  return {
    name: 'hangfolio-base-links',
    element: {
      filter: ['a', 'img'],
      visit(node, ctx) {
        for (const key of ['href', 'src']) {
          const value = node.properties?.[key];
          if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || hasBase(value)) continue;
          ctx.setProperty(node, key, url(value, base));
        }
      },
    },
  };
}
