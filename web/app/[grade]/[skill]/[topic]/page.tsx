import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { topicPath, gradeSlug, parseGradeSlug, parseSkill, parseTestSlug, homePath, gradePath, skillPath, testPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().flatMap(g => getSkills(g).flatMap(skill => getTopics(g,skill).map(t => ({grade:gradeSlug(g),skill,topic:t.slug})))); }
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill) return {};
 const topic = getTopics(grade, skill).find(t => t.slug === p.topic); if (!topic) return {};
 return buildMetadata({ title: `${topic.name} - ${SKILL_NAMES[skill]} ${grade}`, description: `${topic.description} Luyện ${SKILL_NAMES[skill].toLowerCase()} tiếng Anh lớp ${grade} qua bài tập có đáp án.`, path: topicPath(grade, skill, topic.slug) });
}
export default async function TopicPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 return <PageShell title={topic.name}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name}]}/><p>{topic.description}</p><LinkCardList emptyMessage="Chủ đề này chưa có bài luyện. Em hãy quay lại sau nhé." items={getTestsForTopic(grade,skill,topic.slug).map(test=>({label:test.title,description:`${test.questionIds.length} câu hỏi · Có giải thích đáp án`,href:testPath(grade,skill,topic.slug,parseTestSlug(test.slug)!.test)}))}/><AdSlot slot="footer"/></PageShell>;
}
