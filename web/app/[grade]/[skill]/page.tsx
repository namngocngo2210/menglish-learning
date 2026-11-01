import { ensureContent } from "@/lib/content/source";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { skillPath, parseGradeSlug, parseSkill, homePath, gradePath, topicPath, SKILL_NAMES } from "@/lib/routes";
import { FaqSection } from "@/components/faq-section";
import { buildSkillFaq, skillStats, SKILL_INTROS } from "@/lib/seo-content";
import { getTopicDef } from "@/lib/topics/registry";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) return {};
 return buildMetadata({ title: fitTitle(`${SKILL_NAMES[skill]} lớp ${grade}`, ": bài tập có đáp án"), description: `Luyện ${SKILL_NAMES[skill].toLowerCase()} tiếng Anh lớp ${grade}: ${skillStats(grade, skill).tests} đề, ${skillStats(grade, skill).questions} câu hỏi theo ${skillStats(grade, skill).topics} chủ đề, có đáp án và giải thích tiếng Việt.`, path: skillPath(grade, skill) });
}
export default async function SkillPage({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) notFound();
 return <PageShell title={`${SKILL_NAMES[skill]} lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill]}]}/><p>{SKILL_INTROS[skill]}</p><p>Chọn một chủ đề để bắt đầu luyện tập theo nội dung em muốn ôn.</p><LinkCardList emptyMessage="Chưa có chủ đề cho kỹ năng này. Nội dung sẽ được bổ sung sau." items={getTopics(grade,skill).map(topic => ({label:topic.name,description:`${getTopicDef(skill, topic.slug)?.summary ?? topic.description} · ${getTestsForTopic(grade,skill,topic.slug).length} đề luyện tập`,href:topicPath(grade,skill,topic.slug)}))}/><FaqSection items={buildSkillFaq(grade, skill)}/><AdSlot slot="footer"/></PageShell>;
}
