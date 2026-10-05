// Runs one step of the engine's workflows (.github/workflows/*.yml) the way the runner does:
// `shell: bash` as `bash --noprofile --norc -eo pipefail`, `shell: node {0}` with node, and the
// step's env plus the GITHUB_OUTPUT and GITHUB_STEP_SUMMARY files. The script text is taken from
// the workflow file itself, so the tests exercise exactly what ships.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const REPO = fileURLToPath(new URL('../../../', import.meta.url));

export type Step = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
export type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  'runs-on'?: string;
  permissions?: Record<string, string>;
  outputs?: Record<string, string>;
  steps?: Step[];
  uses?: string;
  secrets?: Record<string, string> | string;
  [key: string]: unknown;
};
export type Workflow = { name?: string; on: Record<string, unknown>; permissions?: Record<string, string>; jobs: Record<string, Job> };

export const readRepo = (file: string) => readFileSync(join(REPO, file), 'utf8');
export const workflow = (file: string) => parse(readRepo(file)) as Workflow;

export function step(wf: Workflow, job: string, id: string): Step {
  const found = wf.jobs[job]?.steps?.find((s) => s.id === id || s.name === id);
  assert.ok(found?.run, `no step ${job}.${id} with a run script`);
  return found;
}

const work = mkdtempSync(join(tmpdir(), 'hangfolio-steps-'));
let count = 0;

/** Removes every folder the steps used; call it from the test file's after(). */
export const cleanUp = () => rmSync(work, { recursive: true, force: true });

/** A fresh empty folder for one test. */
export function folder(name = 'dir'): string {
  const dir = join(work, `${++count}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export type StepResult = { status: number | null; stdout: string; stderr: string; outputs: Record<string, string>; summary: string };

/**
 * Runs the step. `env` holds what the step's ${{ }} expressions would give; literal values from the
 * workflow are added as they are. Keys must be ones the step declares (or GITHUB_*, RUNNER_* and
 * HANGFOLIO_* test hooks), so renaming a variable in the workflow breaks the test, not the site.
 */
export function runStep(s: Step, env: Record<string, string>, options: { cwd?: string; bin?: string } = {}): Promise<StepResult> {
  const declared = s.env ?? {};
  for (const key of Object.keys(env)) {
    assert.ok(key in declared || /^(GITHUB|RUNNER|HANGFOLIO)_/.test(key), `step "${s.name}" has no env ${key}`);
  }
  const literal = Object.fromEntries(Object.entries(declared).filter(([, v]) => !String(v).includes('${{')));
  const dir = folder('step');
  const output = join(dir, 'output');
  const summary = join(dir, 'summary');
  writeFileSync(output, '');
  writeFileSync(summary, '');
  const node = s.shell === 'node {0}';
  assert.ok(node || s.shell === 'bash', `step "${s.name}" sets shell: bash or node {0}`);
  const script = join(dir, node ? 'script.cjs' : 'script.sh');
  writeFileSync(script, s.run!);
  const [cmd, ...args] = node ? [process.execPath, script] : ['bash', '--noprofile', '--norc', '-eo', 'pipefail', script];
  const child = spawn(cmd, args, {
    cwd: options.cwd ?? dir,
    env: {
      PATH: [options.bin, process.env.PATH].filter(Boolean).join(':'),
      HOME: process.env.HOME,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      RUNNER_TEMP: dir,
      ...literal,
      ...env,
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  return new Promise((resolve) => {
    child.on('close', (status) => {
      resolve({ status, stdout, stderr, outputs: parseOutputs(readFileSync(output, 'utf8')), summary: readFileSync(summary, 'utf8') });
    });
  });
}

/** GITHUB_OUTPUT: `name=value` lines and `name<<DELIMITER` blocks. */
export function parseOutputs(text: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const heredoc = /^([\w-]+)<<(.+)$/.exec(lines[i]);
    if (heredoc) {
      const end = lines.indexOf(heredoc[2], i + 1);
      assert.ok(end > i, `unterminated ${heredoc[1]} output`);
      outputs[heredoc[1]] = lines.slice(i + 1, end).join('\n');
      i = end;
    } else if (lines[i].includes('=')) {
      const at = lines[i].indexOf('=');
      outputs[lines[i].slice(0, at)] = lines[i].slice(at + 1);
    }
  }
  return outputs;
}

/** Writes an executable script into a bin folder that runStep puts first on PATH. */
export function fakeCommand(bin: string, name: string, script: string): void {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, name), `#!/bin/bash\n${script}`, { mode: 0o755 });
}
