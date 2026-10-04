// What `hangfolio dev` shows in the browser (SPEC 5.10). The integration keeps the checks' result
// here, and a change under content/ or public/ makes the next page render run them again. Errors
// become Astro's error overlay, pointing at the first one's line; warnings and notices go in a
// small panel (components/DevChecks.astro). A build never sets this, so pages see no issues.
import { join } from 'node:path';
import type { Issue } from '../validate/issue.ts';

export type DevState = { root: string; errors: Issue[]; others: Issue[] };

type Store = { state?: DevState; stale?: boolean; refresh?: () => Promise<DevState>; pending?: Promise<DevState> };
const KEY = Symbol.for('hangfolio.dev-checks');
const store = ((globalThis as { [KEY]?: Store })[KEY] ??= {});

/** The checks' result, and how to run them again after a file changes. */
export function setDevState(state: DevState, refresh?: () => Promise<DevState>) {
  store.state = state;
  store.refresh = refresh ?? store.refresh;
  store.stale = false;
}

/** A file under content/ or public/ changed: the next page render checks again first. */
export function markDevStateStale() {
  store.stale = true;
}

export function devState(): DevState | undefined {
  return store.state;
}

/** The current result, checked again first when a file changed since the last check. */
export async function currentDevState(): Promise<DevState | undefined> {
  if (store.stale && store.refresh) {
    store.stale = false;
    store.pending ??= store.refresh().finally(() => (store.pending = undefined));
    store.state = await store.pending;
  }
  return store.state;
}

const where = (issue: Issue) => (issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ''}` : 'site');

/** The error the page throws so Astro shows its overlay: every error, the first one's line framed. */
export function checkError(state: DevState, help: string): Error {
  const [first, ...rest] = state.errors;
  const lines = [`\`${where(first)}\` ${first.code} ${first.message}`, ...rest.map((issue) => `\`${where(issue)}\` ${issue.code} ${issue.message}`)];
  const error = new Error(lines.join('\n\n')) as Error & { title: string; hint: string; loc?: object };
  error.name = 'HangfolioCheck';
  error.title = `hangfolio check found ${state.errors.length === 1 ? 'an error' : `${state.errors.length} errors`}`;
  error.hint = `Fix ${state.errors.length === 1 ? 'it' : 'them'} and save; this page reloads. The terminal lists the same problems. What each code means: ${help}`;
  if (first.file && first.line) error.loc = { file: join(state.root, first.file), line: first.line, column: first.col ?? 1 };
  error.stack = '';
  return error;
}

/**
 * For pages that rendered without a check error, in dev. Astro sends a render error to every open
 * page 200 ms after the failed response, so an error from a moment before a fix can land on the
 * fixed page. Such a hangfolio check error is stale there; this script removes it.
 */
export const DROP_STALE_OVERLAY = `new MutationObserver((records) => {
  for (const record of records) for (const node of record.addedNodes) {
    if (node.localName === 'vite-error-overlay' && node.shadowRoot?.querySelector('#name')?.textContent === 'HangfolioCheck') node.remove();
  }
}).observe(document.body, { childList: true });`;
