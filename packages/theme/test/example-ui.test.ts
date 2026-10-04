// What pages show for example mode and the checks: the ExampleBanner's words, the initials
// monogram, the avatar found in public/images, and the error that becomes the dev overlay.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { findAvatar, initials } from '../src/lib/avatar.ts';
import { CREATE_URL, exampleBanner } from '../src/lib/banner.ts';
import { checkError, devState, setDevState } from '../src/lib/dev-checks.ts';

const work = mkdtempSync(join(tmpdir(), 'hangfolio-ui-'));
after(() => rmSync(work, { recursive: true, force: true }));

test('the banner: plain text locally, a site.yaml link in a copy, and "Create your own" on the template', () => {
  assert.deepEqual(exampleBanner({}), { text: 'This is an example site. Edit site.yaml to make it yours.' });
  assert.deepEqual(exampleBanner({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'mara/website' }), {
    text: 'This is an example site.',
    link: { href: 'https://github.com/mara/website/blob/HEAD/site.yaml', label: 'Edit site.yaml to make it yours →' },
  });
  assert.deepEqual(exampleBanner({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Hangfolio/Starter' }), {
    text: 'This is the demo of hangfolio (a fictional person).',
    link: { href: CREATE_URL, label: 'Create your own →' },
  });
  assert.equal(CREATE_URL, 'https://github.com/new?template_owner=hangfolio&template_name=starter');
});

test('initials: first and last word, letters only, or advanced.nameParts', () => {
  assert.equal(initials('Rowan Vale'), 'RV');
  assert.equal(initials('Ana María de la Cruz'), 'AC');
  assert.equal(initials('Ōta'), 'Ō');
  assert.equal(initials('"Juniper" Ash'), 'JA');
  assert.equal(initials('🌊 Mara Quill'), 'MQ');
  assert.equal(initials('Mara Quill 🌊'), 'MQ');
  assert.equal(initials('Lin Mei', { given: 'Mei', family: 'Lin' }), 'ML');
});

test('the avatar is found by its default names in public/images', () => {
  assert.equal(findAvatar(work), undefined);
  mkdirSync(join(work, 'public/images'), { recursive: true });
  writeFileSync(join(work, 'public/images/Avatar.PNG'), 'x');
  assert.equal(findAvatar(work), undefined);
  rmSync(join(work, 'public/images/Avatar.PNG'));
  writeFileSync(join(work, 'public/images/avatar.webp'), 'x');
  writeFileSync(join(work, 'public/images/avatar.jpg'), 'x');
  assert.equal(findAvatar(work), '/images/avatar.jpg');
});

test('the dev overlay error lists every error and points at the first one', () => {
  assert.equal(devState(), undefined);
  const state = {
    root: '/site',
    errors: [
      { code: 'E401' as const, file: 'site.yaml', line: 3, col: 1, message: 'tagline is still the example text. Write your own sentence.' },
      { code: 'E203' as const, file: 'content/projects/x.md', message: "'title' is required. Add a line: title: \"…\"" },
    ],
    others: [],
  };
  setDevState(state);
  assert.equal(devState(), state);
  const error = checkError(state, 'https://example.org/help') as Error & { title: string; hint: string; loc: object };
  assert.equal(error.title, 'hangfolio check found 2 errors');
  assert.equal(error.message, "`site.yaml:3` E401 tagline is still the example text. Write your own sentence.\n\n`content/projects/x.md` E203 'title' is required. Add a line: title: \"…\"");
  assert.deepEqual(error.loc, { file: '/site/site.yaml', line: 3, column: 1 });
  assert.match(error.hint, /https:\/\/example\.org\/help$/);
  assert.equal(error.stack, '');
});
