/**
 * In-process snapshot of the public content, refreshed from Postgres (blueprint §4).
 *
 * - Fresh for `ttlMs`; after that the stale snapshot is still served while ONE background refresh
 *   runs (single-flight, stale-while-revalidate).
 * - A failed refresh keeps the last good snapshot (stale-on-error): a database outage never turns
 *   into a 404 or an empty page. Only a process that has never loaded content fails, and the edge
 *   cache turns that into a clean 503.
 * - `invalidate()` forces a reload (called by the internal purge hook after a publish).
 */
import type { ContentBundle } from "./types";

export class ContentUnavailableError extends Error {
 constructor(message = "Content is not loaded yet") { super(message); this.name = "ContentUnavailableError"; }
}

export interface ContentStoreOptions {
 load: () => Promise<ContentBundle>;
 ttlMs: number;
 now?: () => number;
 onError?: (error: unknown) => void;
}

export interface ContentStore {
 /** Resolves once a snapshot exists and is fresh enough; rejects only when none was ever loaded. */
 ensure(): Promise<void>;
 /** The current snapshot. Throws ContentUnavailableError if none was loaded. */
 current(): ContentBundle;
 /** Reloads from the source now; rejects when the reload fails (the old snapshot is kept). */
 invalidate(): Promise<void>;
 loadedAt(): number | undefined;
}

export function createContentStore(options: ContentStoreOptions): ContentStore {
 const now = options.now ?? (() => Date.now());
 let bundle: ContentBundle | undefined;
 let at = 0;
 let inflight: Promise<void> | undefined;
 const reload = (): Promise<void> => {
  inflight ??= options.load().then(next => { bundle = next; at = now(); }).finally(() => { inflight = undefined; });
  return inflight;
 };
 return {
  async ensure() {
   if (bundle && now() - at < options.ttlMs) return;
   if (!bundle) return reload();
   // Stale: answer immediately from the old snapshot and refresh in the background.
   reload().catch((error: unknown) => options.onError?.(error));
  },
  current() {
   if (!bundle) throw new ContentUnavailableError();
   return bundle;
  },
  invalidate: reload,
  loadedAt: () => (bundle ? at : undefined),
 };
}
