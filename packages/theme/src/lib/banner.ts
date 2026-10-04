// The ExampleBanner's words and link in demo mode (SPEC 4.2, 5.2). On GitHub the link opens the
// site's own site.yaml; the template repository's demo links to "Create your own" instead.

export const TEMPLATE_REPO = 'hangfolio/starter';
export const CREATE_URL = 'https://github.com/new?template_owner=hangfolio&template_name=starter';

export type Banner = { text: string; link?: { href: string; label: string } };

export function exampleBanner(env: Record<string, string | undefined>): Banner {
  const repo = env.GITHUB_ACTIONS === 'true' ? env.GITHUB_REPOSITORY : undefined;
  if (repo?.toLowerCase() === TEMPLATE_REPO) {
    return { text: 'This is the demo of hangfolio (a fictional person).', link: { href: CREATE_URL, label: 'Create your own →' } };
  }
  if (repo) {
    const href = `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/blob/HEAD/site.yaml`;
    return { text: 'This is an example site.', link: { href, label: 'Edit site.yaml to make it yours →' } };
  }
  return { text: 'This is an example site. Edit site.yaml to make it yours.' };
}
