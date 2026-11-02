import { getGrades, getSkills, getTopics } from "@/lib/content/load";
import { getQuizPool } from "@/lib/content/pool";
import { ensureContent } from "@/lib/content/source";
import { gradeSlug, parseGradeSlug, parseSkillUrl, skillSegment, parseTopicSegment, topicSegment } from "@/lib/routes";
export const dynamic = "force-dynamic";
function knownPools() {
 return getGrades().flatMap(g => getSkills(g).flatMap(skill => [...new Set(["tong-hop", ...getTopics(g, skill).map(t => t.slug)])].map(topic => ({ grade: gradeSlug(g), skill: skillSegment(skill), topic: topicSegment(skill, topic) }))));
}
export async function GET(_request: Request, { params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkillUrl(p.skill);
 const topic = skill ? parseTopicSegment(skill, p.topic) : null;
 if (!grade || !skill || !topic || !knownPools().some(v => v.grade === p.grade && v.skill === p.skill && v.topic === p.topic)) return Response.json({ error: "Not found" }, { status: 404 });
 return Response.json(getQuizPool(grade, skill, topic));
}
