// The plumbing check (SPEC 9, layer 4; N701). Plumbing files wire a site to the theme and stay
// fixed for a whole major. Each carries a `hangfolio-plumbing: <n>` marker; when one is missing,
// unmarked or at another version, `hangfolio check` shows a notice with the replacement text.
// The package.json scripts are plumbing too, but JSON has no comments, so they are compared.
// The starter's index.html ("Almost there", SPEC 8.4) is plumbing too, but it is inert once Pages
// builds from GitHub Actions and may be deleted, so it is not checked here.

export const PLUMBING_VERSION = 1;

const MARKER = /hangfolio-plumbing:\s*(\d+)/;

/** Each plumbing file's path in the site and its exact text (the starter's copy must match). */
export const PLUMBING_FILES: { file: string; text: string; optional?: boolean }[] = [
  {
    file: 'astro.config.mjs',
    text:
      '// Site plumbing. Do not edit.  hangfolio-plumbing: 1\n' +
      "import { defineSiteConfig } from 'hangfolio/config';\n" +
      'export default defineSiteConfig();\n',
  },
  {
    file: 'src/content.config.ts',
    text: '// Do not edit.  hangfolio-plumbing: 1\n' + "export { collections } from 'hangfolio/content';\n",
  },
  // A missing copy of the files below is fine (a site may deploy another way, or do without
  // Dependabot or Codespaces); a copy that is there must carry the marker.
  {
    file: '.github/workflows/deploy.yml',
    optional: true,
    text: [
      '# Builds and publishes your site. You should not need to edit this file.',
      '# hangfolio-plumbing: 1',
      'name: Deploy site',
      'on:',
      '  push:',
      '  pull_request:',
      '  workflow_dispatch:',
      'permissions: {}',
      'jobs:',
      '  build:',
      '    uses: hangfolio/hangfolio/.github/workflows/build.yml@v1',
      '    permissions:',
      '      contents: read',
      '      pages: read',
      '    secrets:',
      '      GOOGLE_WALLET_KEY: ${{ secrets.GOOGLE_WALLET_KEY }}   # optional and unused for now; leave this line as it is',
      '    # with:',
      '    #   site-url: https://example.com     # only to pin canonical URLs',
      '  deploy:',
      '    needs: build',
      '    if: needs.build.outputs.deploy == \'true\'',
      '    uses: hangfolio/hangfolio/.github/workflows/deploy.yml@v1',
      '    permissions:',
      '      pages: write',
      '      id-token: write',
      '',
    ].join('\n'),
  },
  {
    file: '.github/dependabot.yml',
    optional: true,
    text: [
      '# Keeps your site up to date: once a month, a pull request for a new theme release and one for the',
      '# deploy workflow. Each one builds your site first; merging it publishes the update.',
      '# hangfolio-plumbing: 1',
      'version: 2',
      'updates:',
      '  - package-ecosystem: npm',
      '    directory: /',
      '    schedule: { interval: monthly }',
      '    allow: [{ dependency-name: hangfolio }]',
      '    open-pull-requests-limit: 1',
      '    commit-message: { prefix: "Update site theme" }',
      '  - package-ecosystem: github-actions',
      '    directory: /',
      '    schedule: { interval: monthly }',
      '    # build.yml and deploy.yml move to a new major together, in one pull request (S7).',
      '    groups:',
      '      engine:',
      '        patterns: ["hangfolio/hangfolio/*"]',
      '    commit-message: { prefix: "Update site engine" }',
      '',
    ].join('\n'),
  },
  {
    file: '.devcontainer/devcontainer.json',
    optional: true,
    text: [
      '// A ready-made preview for Codespaces: Code → Codespaces → Create codespace. It installs the site',
      '// and opens a live preview that reloads as you edit. You should not need to edit this file.',
      '// hangfolio-plumbing: 1',
      '{',
      '  "name": "Site preview",',
      '  "image": "mcr.microsoft.com/devcontainers/javascript-node:1-24-bookworm",',
      '  "postCreateCommand": "npm ci",',
      '  "postAttachCommand": "npm run dev",',
      '  "waitFor": "postCreateCommand",',
      '  "forwardPorts": [4321],',
      '  "portsAttributes": {',
      '    "4321": { "label": "Site preview", "onAutoForward": "openPreview" }',
      '  },',
      '  "customizations": {',
      '    "codespaces": { "openFiles": ["site.yaml"] },',
      '    "vscode": { "extensions": ["redhat.vscode-yaml"] }',
      '  }',
      '}',
      '',
    ].join('\n'),
  },
];

export const PLUMBING_SCRIPTS: Record<string, string> = {
  dev: 'hangfolio dev',
  build: 'hangfolio build',
  check: 'hangfolio check',
  preview: 'hangfolio preview',
};

export type PlumbingNotice = { code: 'N701'; file: string; line?: number; message: string; replacement: string };

/** Checks the plumbing of a site. `read` returns a file's text by its path in the site, or undefined. */
export function checkPlumbing(read: (file: string) => string | undefined): PlumbingNotice[] {
  const notices: PlumbingNotice[] = [];
  for (const { file, text, optional } of PLUMBING_FILES) {
    const add = (message: string, line?: number) => notices.push({ code: 'N701', file, line, message, replacement: text });
    const current = read(file);
    if (current === undefined) {
      if (optional) continue;
      add(`${file} is missing. It connects your site to hangfolio; create it with the text below.`);
      continue;
    }
    const lines = current.split(/\r?\n/);
    const index = lines.findIndex((line) => MARKER.test(line));
    const version = index === -1 ? undefined : Number(MARKER.exec(lines[index])![1]);
    if (version === undefined) {
      add(`${file} has no hangfolio-plumbing line, so it may have been edited. Replace everything in it with the text below.`, 1);
    } else if (version < PLUMBING_VERSION) {
      add(`${file} is plumbing version ${version}; this hangfolio needs version ${PLUMBING_VERSION}. Replace everything in it with the text below.`, index + 1);
    } else if (version > PLUMBING_VERSION) {
      add(`${file} is plumbing version ${version}, which needs a newer hangfolio than this one. Update hangfolio in package.json.`, index + 1);
    }
  }
  notices.push(...checkScripts(read('package.json')));
  return notices;
}

function checkScripts(text: string | undefined): PlumbingNotice[] {
  let scripts: Record<string, unknown> | undefined;
  try {
    scripts = text === undefined ? undefined : (JSON.parse(text).scripts ?? {});
  } catch {
    return []; // npm reports a broken package.json itself
  }
  if (!scripts) return [];
  const wrong = Object.keys(PLUMBING_SCRIPTS).filter((name) => scripts[name] !== PLUMBING_SCRIPTS[name]);
  if (wrong.length === 0) return [];
  const index = text!.split(/\r?\n/).findIndex((line) => line.includes('"scripts"'));
  const list = wrong.map((name) => `"${name}": "${PLUMBING_SCRIPTS[name]}"`).join(', ');
  return [{
    code: 'N701',
    file: 'package.json',
    line: index === -1 ? undefined : index + 1,
    message: `package.json needs these scripts for hangfolio to run: ${list}. Replace the "scripts" block with the text below.`,
    replacement: `"scripts": ${JSON.stringify(PLUMBING_SCRIPTS, null, 2).replace(/\n/g, '\n  ')}`,
  }];
}
