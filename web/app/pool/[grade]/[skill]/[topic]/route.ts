import { getGrades, getSkills, getTopics } from "@/lib/content/load";
import { getQuizPool } from "@/lib/content/pool";
import { ensureContent } from "@/lib/content/source";
import { gradeSlug, parseGradeSlug, parseSkill } from "@/lib/routes";
export const dynamic = "force-dynamic";
function knownPools() {
 return getGrades().flatMap(g => getSkills(g).flatMap(skill => [...new Set(["tong-hop", ...getTopics(g, skill).map(t => t.slug)])].map(topic => ({ grade: gradeSlug(g), skill, topic }))));
}
export async function GET(_request: Request, { params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !knownPools().some(v => v.grade === p.grade && v.skill === p.skill && v.topic === p.topic)) return Response.json({ error: "Not found" }, { status: 404 });
 return Response.json(getQuizPool(grade, skill, p.topic));
}
