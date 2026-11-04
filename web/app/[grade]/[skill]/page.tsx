import { ensureContent } from "@/lib/content/source";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, PageTitle, SetCardList, TestTileList, MoreInfo, LinkCardList } from "@/components/ui-kit";
import { getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { skillPath, parseGradeSlug, parseSkillUrl, parseTestSlug, homePath, gradePath, topicPath, testPath, SKILL_NAMES } from "@/lib/routes";
import { FaqSection } from "@/components/faq-section";
import { buildSkillFaq, skillStats, SKILL_INTROS } from "@/lib/seo-content";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkillUrl(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) return {};
 return buildMetadata({ title: fitTitle(`${SKILL_NAMES[skill]} lớp ${grade}`, ": bài tập có đáp án"), description: `Luyện ${SKILL_NAMES[skill].toLowerCase()} tiếng Anh lớp ${grade}: ${skillStats(grade, skill).tests} đề, ${skillStats(grade, skill).questions} câu hỏi${skillStats(grade, skill).topics > 1 ? ` theo ${skillStats(grade, skill).topics} chủ đề` : ""}, có đáp án và giải thích tiếng Việt.`, path: skillPath(grade, skill) });
}
export default async function SkillPage({ params }: { params: Promise<{ grade: string; skill: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkillUrl(p.skill);
 if (!grade || !skill || !getSkills(grade).includes(skill)) notFound();
 const stats = skillStats(grade, skill); const topics = getTopics(grade, skill);
 const tile = (topicSlug: string) => getTestsForTopic(grade, skill, topicSlug).map(test => ({ label: `Đề ${parseTestSlug(test.slug)!.test.replace("de-", "")}`, meta: `${test.questionIds.length} câu`, href: testPath(grade, skill, topicSlug, parseTestSlug(test.slug)!.test), progressKey: test.slug }));
 // A skill with a single (mixed) set skips the topic level and lists its exams directly.
 const body = topics.length === 1 ? <TestTileList items={tile(topics[0].slug)}/> : <SetCardList items={topics.map(topic => { const tests = getTestsForTopic(grade, skill, topic.slug); const average = Math.round(tests.reduce((sum, t) => sum + t.questionIds.length, 0) / Math.max(tests.length, 1)); return { label: topic.name, meta: `${tests.length} đề · ~${average} câu`, href: topicPath(grade, skill, topic.slug) }; })} skill={skill}/>;
 return <PageShell compact title={`${SKILL_NAMES[skill]} lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill]}]}/>
  <PageTitle title={`${SKILL_NAMES[skill]} lớp ${grade}`} context={`${stats.tests} đề · ${stats.questions} câu`}/>
  {topics.length ? <section aria-labelledby="bo-de" className="space-y-3"><h2 id="bo-de" className="text-lg font-bold">{topics.length === 1 ? "Chọn đề" : "Chọn bộ đề"}</h2>{body}</section> : <LinkCardList items={[]} emptyMessage="Chưa có đề cho kỹ năng này. Nội dung sẽ được bổ sung sau."/>}
  <MoreInfo><p>{SKILL_INTROS[skill]} Mọi đề đều có giải thích tiếng Việt.</p></MoreInfo>
  <FaqSection items={buildSkillFaq(grade, skill)}/><AdSlot slot="footer"/></PageShell>;
}
