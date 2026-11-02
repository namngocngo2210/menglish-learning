import { getQuizPool } from "@/lib/content/pool";
import { ensureContent } from "@/lib/content/source";
export const dynamic = "force-dynamic";
export async function GET() { await ensureContent(); return Response.json(getQuizPool()); }
