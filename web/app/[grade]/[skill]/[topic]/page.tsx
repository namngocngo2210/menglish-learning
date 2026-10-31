import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { gradeSlug, parseGradeSlug, parseSkill, parseTestSlug, homePath, gradePath, skillPath, testPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().flatMap(g => getSkills(g).flatMap(skill => getTopics(g,skill).map(t => ({grade:gradeSlug(g),skill,topic:t.slug})))); }
export default async function TopicPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 return <PageShell title={topic.name}><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name}]}/><p>{topic.description}</p><LinkCardList items={getTestsForTopic(grade,skill,topic.slug).map(test=>({label:test.title,href:testPath(grade,skill,topic.slug,parseTestSlug(test.slug)!.test)}))}/></PageShell>;
}
