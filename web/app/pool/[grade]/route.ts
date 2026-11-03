import { getQuizPool } from "@/lib/content/pool";
import { ensureContent } from "@/lib/content/source";
import { parseGradeSlug } from "@/lib/routes";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ grade: string }> }) {
 await ensureContent();
 const grade = parseGradeSlug((await params).grade);
 return grade ? Response.json(getQuizPool(grade)) : Response.json({ error: "Not found" }, { status: 404 });
}
