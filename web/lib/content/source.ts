/**
 * Chooses where public content comes from.
 *  - "db": Postgres through the read-only `v_public_*` views (role bj_web). Used in production.
 *  - "files": the seed JSON in web/content/tests. Used by tests, `next build` and local dev
 *    without a database.
 * Default: "db" when DATABASE_URL or DATABASE_URL_FILE is set, else "files". CONTENT_SOURCE overrides.
 */
import { readFileSync } from "node:fs";
import { createContentStore, type ContentStore } from "./store";

export type ContentMode = "db" | "files";

export function contentMode(env: Record<string, string | undefined> = process.env): ContentMode {
 const forced = env.CONTENT_SOURCE;
 if (forced === "db" || forced === "files") return forced;
 return env.DATABASE_URL || env.DATABASE_URL_FILE ? "db" : "files";
}

function connectionString(env: Record<string, string | undefined>): string {
 const file = env.DATABASE_URL_FILE;
 const value = file ? readFileSync(file, "utf8").trim() : env.DATABASE_URL;
 if (!value) throw new Error("Missing environment: DATABASE_URL or DATABASE_URL_FILE");
 return value;
}

const globalKey = Symbol.for("beejunior.content-store");
type Holder = { [globalKey]?: ContentStore };

/** One store per process, shared by every route bundle (Next may load this module several times). */
export function getContentStore(): ContentStore {
 const holder = globalThis as unknown as Holder;
 holder[globalKey] ??= createContentStore({
  ttlMs: Number(process.env.CONTENT_TTL_MS ?? 30_000),
  load: async () => {
   const { createPublicReader } = await import("@bj/data");
   // The reader (pool) is created lazily and reused; its small pool is the web's only DB footprint.
   readerHolder.reader ??= createPublicReader({ connectionString: connectionString(process.env), poolMax: Number(process.env.PG_POOL_MAX ?? 5) });
   return readerHolder.reader.loadBundle();
  },
  onError: error => { process.stdout.write(`${JSON.stringify({ level: "warn", event: "content_refresh_failed", reason: error instanceof Error ? error.message : "unknown" })}\n`); },
 });
 return holder[globalKey];
}
const readerHolder: { reader?: { loadBundle(): Promise<import("@bj/core").ContentBundle>; ping(): Promise<void> } } = {};

/** Awaited at the top of every public page/route: loads or refreshes the snapshot in "db" mode. */
export async function ensureContent(): Promise<void> {
 if (contentMode() === "db") await getContentStore().ensure();
}

/** Readiness probe: the database answers (db mode) — files mode is always ready. */
export async function contentReady(): Promise<boolean> {
 if (contentMode() !== "db") return true;
 try { await getContentStore().ensure(); return true; } catch { return false; }
}
