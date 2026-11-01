import { ensureContent } from "@/lib/content/source";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getTopics, getTestsForTopic, loadBundle } from "@/lib/content/load";
import { topicPath, gradeSlug, parseGradeSlug, parseSkill, parseTestSlug, homePath, gradePath, skillPath, testPath, SKILL_NAMES } from "@/lib/routes";
import { FaqSection } from "@/components/faq-section";
import { buildTopicFaq } from "@/lib/seo-content";
import { getTopicDef } from "@/lib/topics/registry";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill) return {};
 const topic = getTopics(grade, skill).find(t => t.slug === p.topic); if (!topic) return {};
 return buildMetadata({ title: fitTitle(`${topic.name} lớp ${grade}`, ": bài tập có đáp án", ": bài tập"), description: `${getTopicDef(skill, topic.slug)?.summary ?? topic.description} Bài tập ${SKILL_NAMES[skill].toLowerCase()} lớp ${grade} có đáp án và giải thích.`, path: topicPath(grade, skill, topic.slug) });
}
export default async function TopicPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 const def = getTopicDef(skill, topic.slug);
 const tests = getTestsForTopic(grade, skill, topic.slug);
 const questionCount = loadBundle().questions.filter(q => q.grade === grade && q.skill === skill && (topic.slug === "tong-hop" || q.topicSlug === topic.slug)).length;
 const otherGrades = getGrades().filter(g => g !== grade).flatMap(g => getTopics(g, skill).filter(t => t.slug === topic.slug));
 return <PageShell title={topic.name}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name}]}/>{def ? <section aria-label="Kiến thức cần nhớ" className="space-y-4 leading-relaxed">
  {def.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
  {def.examples && <><h2 className="text-xl font-bold">Ví dụ</h2><ul className="list-disc space-y-2 pl-6">{def.examples.map(example => <li key={example.en}><span lang="en">{example.en}</span><br/>{example.vi}</li>)}</ul></>}
  {def.tips && <><h2 className="text-xl font-bold">Lưu ý khi làm bài</h2><ul className="list-disc space-y-2 pl-6">{def.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></>}
 </section> : <p>{topic.description}</p>}
 <p>Lớp {grade}: {questionCount} câu hỏi · {tests.length} đề luyện tập</p><RandomQuiz poolUrl={`/pool/${gradeSlug(grade)}/${skill}/${topic.slug}`} afterResult={<AdSlot slot="footer"/>}/><LinkCardList emptyMessage="Chủ đề này chưa có bài luyện. Em hãy quay lại sau nhé." items={tests.map(test=>({label:test.title,progressKey:test.slug,description:`${test.questionIds.length} câu hỏi · Có giải thích đáp án`,href:testPath(grade,skill,topic.slug,parseTestSlug(test.slug)!.test)}))}/><section className="space-y-4"><h2 className="text-xl font-bold">Chủ đề khác trong {SKILL_NAMES[skill]} lớp {grade}</h2>
 <LinkCardList emptyMessage="Chưa có chủ đề khác cho lớp này." items={getTopics(grade, skill).filter(t => t.slug !== topic.slug).map(t => ({ label: t.name, description: t.description, href: topicPath(grade, skill, t.slug) }))}/></section>
 {otherGrades.length > 0 && <section className="space-y-4"><h2 className="text-xl font-bold">Chủ đề này ở lớp khác</h2>
 <LinkCardList items={otherGrades.map(t => ({ label: `${t.name} lớp ${t.grade}`, description: t.description, href: topicPath(t.grade, skill, t.slug) }))}/></section>}
 <FaqSection items={buildTopicFaq(grade, skill, topic.slug, topic.name, questionCount, tests.length)}/><AdSlot slot="footer"/></PageShell>;
}
