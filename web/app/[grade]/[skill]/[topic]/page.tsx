import { ensureContent } from "@/lib/content/source";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, PageTitle, TestTileList, ChipList, LinkCardList } from "@/components/ui-kit";
import { getGrades, getTopics, getTestsForTopic, loadBundle } from "@/lib/content/load";
import { topicPath, parseTopicSegment, skillSegment, topicSegment, gradeSlug, parseGradeSlug, parseSkillUrl, parseTestSlug, homePath, gradePath, skillPath, testPath, SKILL_NAMES, type Grade, type Skill } from "@/lib/routes";
import { FaqSection } from "@/components/faq-section";
import { buildTopicFaq } from "@/lib/seo-content";
import { getTopicDef } from "@/lib/topics/registry";
export const dynamic = "force-dynamic";
// Reading's two sets read as "Đọc hiểu lớp 6: đề dài"; other topics keep their own name plus the grade.
const topicHeading = (skill: Skill, grade: Grade, name: string) => skill === "doc-hieu" ? `${SKILL_NAMES[skill]} lớp ${grade}: ${name.toLowerCase()}` : `${name} lớp ${grade}`;
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkillUrl(p.skill);
 if (!grade || !skill) return {};
 const topic = getTopics(grade, skill).find(t => t.slug === parseTopicSegment(skill, p.topic)); if (!topic) return {};
 return buildMetadata({ title: fitTitle(topicHeading(skill, grade, topic.name), ": bài tập có đáp án", ": bài tập"), description: `${getTopicDef(skill, topic.slug)?.summary ?? topic.description} Bài tập ${SKILL_NAMES[skill].toLowerCase()} lớp ${grade} có đáp án và giải thích.`, path: topicPath(grade, skill, topic.slug) });
}
export default async function TopicPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkillUrl(p.skill);
 if (!grade || !skill) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===parseTopicSegment(skill, p.topic)); if (!topic) notFound();
 const def = getTopicDef(skill, topic.slug);
 const tests = getTestsForTopic(grade, skill, topic.slug);
 const questionCount = loadBundle().questions.filter(q => q.grade === grade && q.skill === skill && (topic.slug === "tong-hop" || q.topicSlug === topic.slug)).length;
 const average = Math.round(tests.reduce((sum, t) => sum + t.questionIds.length, 0) / Math.max(tests.length, 1));
 const otherGrades = getGrades().filter(g => g !== grade).flatMap(g => getTopics(g, skill).filter(t => t.slug === topic.slug));
 const heading = topicHeading(skill, grade, topic.name);
 return <PageShell compact title={heading}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name}]}/>
  <PageTitle title={heading} context={`${tests.length} đề · ${questionCount} câu · mỗi đề ~${average} câu${skill === "doc-hieu" && topic.slug === "chung" ? " từ 2–4 bài đọc" : ""}`}>{!def && <p>{topic.description}</p>}</PageTitle>
  {def && <section aria-label="Kiến thức cần nhớ" className="space-y-4 leading-relaxed">
   {def.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
   {def.examples && <><h2 className="text-xl font-bold">Ví dụ</h2><ul className="list-disc space-y-2 pl-6">{def.examples.map(example => <li key={example.en}><span lang="en">{example.en}</span><br/>{example.vi}</li>)}</ul></>}
   {def.tips && <details className="rounded-xl border border-navy-soft/20 bg-surface p-4"><summary className="flex min-h-11 cursor-pointer items-center"><h2 className="text-lg font-bold">Lưu ý khi làm bài</h2></summary><ul className="mt-3 list-disc space-y-2 pl-6">{def.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></details>}
  </section>}
  <RandomQuiz poolUrl={`/pool/${gradeSlug(grade)}/${skillSegment(skill)}/${topicSegment(skill, topic.slug)}`} afterResult={<AdSlot slot="footer"/>}>
   {tests.length ? <TestTileList items={tests.map(test => ({ label: `Đề ${parseTestSlug(test.slug)!.test.replace("de-", "")}`, meta: `${test.questionIds.length} câu`, href: testPath(grade, skill, topic.slug, parseTestSlug(test.slug)!.test), progressKey: test.slug }))}/> : <LinkCardList items={[]} emptyMessage="Chủ đề này chưa có bài luyện. Em hãy quay lại sau nhé."/>}
  </RandomQuiz>
  <section aria-labelledby="bo-de-khac" className="space-y-3"><h2 id="bo-de-khac" className="text-lg font-bold">Bộ đề khác</h2>
   <ChipList items={[...getTopics(grade, skill).filter(t => t.slug !== topic.slug).map(t => ({ label: `${t.name} · ${getTestsForTopic(grade, skill, t.slug).length} đề`, href: topicPath(grade, skill, t.slug) })), ...otherGrades.map(t => ({ label: `${t.name} lớp ${t.grade}`, href: topicPath(t.grade, skill, t.slug) }))]}/></section>
  <FaqSection items={buildTopicFaq(grade, skill, topic.slug, topic.name, questionCount, tests.length)}/><AdSlot slot="footer"/></PageShell>;
}
