import { contentReady } from "@/lib/content/source";
export const dynamic = "force-dynamic";
/** Readiness: 200 when a content snapshot exists (db mode) — the edge cache and compose healthcheck use it. */
export async function GET() {
 return (await contentReady()) ? new Response("ok", { status: 200, headers: { "cache-control": "no-store" } }) : new Response("content unavailable", { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } });
}
