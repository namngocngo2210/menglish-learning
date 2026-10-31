import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { skillPath, gradeSlug, parseGradeSlug, parseSkill, homePath, gradePath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().flatMap(g => getSkills(g).map(skill => ({ grade: gradeSlug(g), skill }))); }
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) return {};
 return buildMetadata({ title: `${SKILL_NAMES[skill]} lớp ${grade}`, description: `Luyện ${SKILL_NAMES[skill].toLowerCase()} tiếng Anh lớp ${grade} theo chủ đề với các bài tập có đáp án và giải thích.`, path: skillPath(grade, skill) });
}
export default async function SkillPage({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) notFound();
 return <PageShell title={`${SKILL_NAMES[skill]} lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill]}]}/><p>Chọn một chủ đề để bắt đầu luyện tập theo nội dung em muốn ôn.</p><LinkCardList emptyMessage="Chưa có chủ đề cho kỹ năng này. Nội dung sẽ được bổ sung sau." items={getTopics(grade,skill).map(topic => ({label:topic.name,description:`${topic.description} · ${getTestsForTopic(grade,skill,topic.slug).length} đề luyện tập`,href:topicPath(grade,skill,topic.slug)}))}/><AdSlot slot="footer"/></PageShell>;
}
