import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getSkills, getTopics } from "@/lib/content/load";
import { gradeSlug, parseGradeSlug, parseSkill, homePath, gradePath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().flatMap(g => getSkills(g).map(skill => ({ grade: gradeSlug(g), skill }))); }
export default async function SkillPage({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) notFound();
 return <PageShell title={`${SKILL_NAMES[skill]} lớp ${grade}`}><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill]}]}/><LinkCardList items={getTopics(grade,skill).map(topic => ({label:topic.name,description:topic.description,href:topicPath(grade,skill,topic.slug)}))}/></PageShell>;
}
