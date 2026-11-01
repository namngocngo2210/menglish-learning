/** Loads the public content once at server start so the first visitor does not pay for it (db mode only). */
export async function register() {
 if (process.env.NEXT_RUNTIME !== "nodejs") return;
 const { contentMode, getContentStore } = await import("@/lib/content/source");
 if (contentMode() !== "db") return;
 try { await getContentStore().ensure(); }
 catch (error) { process.stdout.write(`${JSON.stringify({ level: "warn", event: "content_warmup_failed", reason: error instanceof Error ? error.message : "unknown" })}\n`); }
}
