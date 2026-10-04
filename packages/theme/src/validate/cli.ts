// `hangfolio check [--github]`: validates the site in the current folder, prints the report, and
// exits 1 when there is an error. --github adds annotations and the job summary (SPEC 8.2 step 5).
import { appendFileSync } from 'node:fs';
import { annotations, stepSummary } from './github.ts';
import { terminalReport, wantsColor } from './format.ts';
import { validateSite } from './index.ts';
import { counts } from './issue.ts';

type Stream = { write(text: string): unknown; isTTY?: boolean };
type Args = { root: string; args: string[]; env: Record<string, string | undefined>; out: Stream; err: Stream };

export const CHECK_USAGE = 'Usage: hangfolio check [--github]';

export async function runCheck({ root, args, env, out, err }: Args): Promise<number> {
  const unknown = args.filter((arg) => arg !== '--github');
  if (unknown.length > 0) {
    err.write(`hangfolio check: unknown option ${unknown[0]}\n${CHECK_USAGE}\n`);
    return 2;
  }
  const report = await validateSite(root, { mode: 'check', env });
  out.write(terminalReport(report, { color: wantsColor(out, env) }));
  if (args.includes('--github')) {
    out.write(annotations(report, env));
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, stepSummary(report, env));
  }
  return counts(report.issues).errors > 0 ? 1 : 0;
}
