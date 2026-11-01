import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { contentMode, getContentStore } from "@/lib/content/source";
export const dynamic = "force-dynamic";

function expectedToken(): string | undefined {
 const file = process.env.INTERNAL_TOKEN_FILE;
 return (file ? readFileSync(file, "utf8").trim() : process.env.INTERNAL_TOKEN) || undefined;
}
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Internal hook called by the edge cache after a publish purge: reload the content snapshot now. Never routed publicly. */
export async function POST(request: Request) {
 const expected = expectedToken();
 const given = request.headers.get("x-internal-token") ?? "";
 if (!expected || !timingSafeEqual(digest(given), digest(expected))) return new Response(null, { status: 403 });
 if (contentMode() !== "db") return Response.json({ refreshed: false, mode: "files" });
 try { await getContentStore().invalidate(); return Response.json({ refreshed: true }); }
 catch { return Response.json({ refreshed: false }, { status: 503 }); }
}
