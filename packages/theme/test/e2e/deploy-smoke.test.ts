// deploy.yml's live check against a real build: the starter built at base /hangfolio, served the
// way GitHub Pages serves it, and checked with the step's own script (page, stylesheet and, once
// the theme stamps it, the build SHA in the generator tag).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, test } from 'node:test';
import { cleanUp, REPO, runStep, step, workflow } from '../workflow-steps.ts';
import { buildSite, serve } from './fixture.ts';

after(cleanUp);

test("the live check passes on the starter's real build", async () => {
  // The commit this build stands for, as GITHUB_SHA would be on the runner.
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  process.env.GITHUB_SHA = sha;
  const dist = buildSite('starter', 'https://u.github.io/hangfolio');
  const site = await serve(dist, '/hangfolio');
  try {
    const check = step(workflow('.github/workflows/deploy.yml'), 'deploy', 'Check the live site');
    const result = await runStep(check, { PAGE_URL: site.home, SHA: sha, HANGFOLIO_SMOKE_TRIES: '1' });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /::warning/);
    assert.match(result.summary, new RegExp(`^## Live at ${site.home}\\n\\nPublished commit ${sha.slice(0, 7)}\\. Checked (the page|build ${sha.slice(0, 7)}) and its stylesheet on the live site\\.`));
  } finally {
    await site.close();
  }
});
