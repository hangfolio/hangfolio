#!/usr/bin/env node
// The hangfolio command. dev, build and preview run the Astro CLI that belongs to this
// package, so a site never needs its own astro. Extra arguments pass straight through.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const [command, ...args] = process.argv.slice(2);

const ASTRO_COMMANDS = new Set(['dev', 'build', 'preview']);
// TODO(M2): check validates site.yaml and content/. TODO(M7): verify checks dist/.
const STUBS = new Set(['check', 'verify']);
const USAGE = `hangfolio ${version}

Usage: hangfolio <command> [options]

  dev       Preview the site locally, reloading on every edit
  build     Build the site into dist/
  preview   Serve the built dist/ folder
  check     Check site.yaml and content/ for mistakes
  verify    Check the links and files in dist/`;

if (command === '--version' || command === '-v') {
  console.log(version);
} else if (command === '--help' || command === '-h') {
  console.log(USAGE);
} else if (ASTRO_COMMANDS.has(command)) {
  runAstro(command, args);
} else if (STUBS.has(command)) {
  console.log(`hangfolio ${command}: not available yet in ${version}; nothing was checked.`);
} else {
  console.error(command ? `hangfolio: unknown command '${command}'\n\n${USAGE}` : USAGE);
  process.exit(1);
}

function runAstro(cmd, rest) {
  const astroDir = dirname(require.resolve('astro/package.json'));
  const astroBin = join(astroDir, require('astro/package.json').bin.astro);
  const env = {
    ...process.env,
    // The theme pins Astro, so Astro's "new version available" advice would be wrong, and
    // its first check writes .astro/settings.json, which restarts a dev server once.
    ASTRO_DISABLE_UPDATE_CHECK: 'true',
    // Builds make no network requests (SPEC 10.1).
    ASTRO_TELEMETRY_DISABLED: '1',
  };
  const child = spawn(process.execPath, [astroBin, cmd, ...rest], { stdio: 'inherit', env });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
