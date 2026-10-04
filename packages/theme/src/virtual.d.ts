// Types for the module that the integration builds from site.yaml (src/integration.ts).
declare module 'virtual:hangfolio/site' {
  export const site: import('./lib/site.ts').SiteYaml;
  export const build: {
    urlFormat: 'preserve' | 'directory';
    icons: { file: string; rel: string; type?: string; sizes?: string }[];
  };
}
