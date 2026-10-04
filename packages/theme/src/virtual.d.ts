// Types for the module that the integration builds from site.yaml (src/integration.ts).
declare module 'virtual:hangfolio/site' {
  /** site.yaml as pages show it: example values hidden outside demo mode, the avatar found */
  export const site: import('./lib/site.ts').SiteYaml;
  export const build: {
    urlFormat: 'preserve' | 'directory';
    icons: { file: string; rel: string; type?: string; sizes?: string }[];
  };
  /** name and email are still the starter's: the example banner and noindex (SPEC 5.2) */
  export const demo: boolean;
  export const banner: import('./lib/banner.ts').Banner;
  /** The troubleshooting page for this version, for the dev overlay */
  export const help: string;
}
