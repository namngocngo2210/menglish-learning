import { ensureContent } from "@/lib/content/source";
import { toQuizPool } from "@/lib/random-quiz";
import { AdSlot } from "@/components/ads/AdSlot";
import Link from "next/link";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { PreviousResult } from "@/components/quiz/PreviousResult";
import { Quiz } from "@/components/quiz/Quiz";
import { JsonLd } from "@/components/json-ld";
import { TITLE_MAX, buildMetadata, breadcrumbJsonLd, quizJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { getTestWithQuestions, getTopics, getTestsForTopic } from "@/lib/content/load";
import { isSlug, gradeSlug, parseGradeSlug, parseSkill, testPath, homePath, gradePath, skillPath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string; topic: string; test: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !isSlug(p.test)) return {};
 const topic = getTopics(grade, skill).find(t => t.slug === p.topic); if (!topic) return {};
 const test = getTestWithQuestions(testPath(grade, skill, topic.slug, p.test).slice(1)); if (!test) return {};
 return buildMetadata({ title: [`${test.title} - ${SKILL_NAMES[skill]} - Lớp ${grade}`, `${test.title} - Lớp ${grade}`, test.title].find(t => t.length <= TITLE_MAX) ?? test.title, description: `Bài tập tiếng Anh lớp ${grade}, kỹ năng ${SKILL_NAMES[skill].toLowerCase()}, chủ đề ${topic.name}, ${p.test}: ${test.questions.length} câu có đáp án và giải thích.`, path: testPath(grade, skill, topic.slug, p.test), type: "article" });
}
export default async function TestPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string; test: string }> }) {
 await ensureContent();
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !isSlug(p.test)) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 const test = getTestWithQuestions(testPath(grade,skill,topic.slug,p.test).slice(1)); if (!test) notFound();
 const quiz = toQuizPool(test);
 return <PageShell title={test.title}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }, { name: test.title, path: testPath(grade, skill, topic.slug, p.test) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name,href:topicPath(grade,skill,topic.slug)},{label:test.title}]}/>
 <JsonLd data={quizJsonLd({ name: test.title, description: `Bài tập tiếng Anh lớp ${grade}, kỹ năng ${SKILL_NAMES[skill].toLowerCase()}, chủ đề ${topic.name}.`, path: testPath(grade, skill, topic.slug, p.test), grade, skillName: SKILL_NAMES[skill], topicName: topic.name, questionCount: test.questions.length, datePublished: test.publishedAt })}/>
 <p>Luyện tiếng Anh lớp {grade}, kỹ năng {SKILL_NAMES[skill].toLowerCase()}, chủ đề {topic.name}: {test.questions.length} câu hỏi. Chọn đáp án, bấm “Kiểm tra” để xem giải thích từng câu, rồi “Nộp bài” để xem kết quả. Không giới hạn thời gian.</p>
 <PreviousResult slug={test.slug}/>
 <RandomQuiz poolUrl={`/pool/${gradeSlug(grade)}/${skill}/${topic.slug}`} afterResult={<AdSlot slot="footer"/>}>
  <Quiz questions={quiz.questions.map(({ id, stem, options, correctKey, explanation, passageId }) => ({ id, stem, options, correctKey, explanation, passageId }))} passages={quiz.passages} progressKey={test.slug} afterResult={<AdSlot slot="footer"/>}/>
 </RandomQuiz>
 <nav aria-label="Bài luyện liên quan" className="space-y-4"><h2 className="text-xl font-bold">Tiếp tục luyện tập</h2>
 <ul className="grid gap-3 sm:grid-cols-2">{getTestsForTopic(grade,skill,topic.slug).filter(t => t.slug !== test.slug).map(t => {
  const tests = getTestsForTopic(grade,skill,topic.slug); const index = tests.findIndex(t => t.slug === test.slug); const offset = tests.indexOf(t) - index;
  return <li key={t.slug}><Link className="inline-flex min-h-11 items-center" href={`/${t.slug}`}>{offset === -1 ? "Đề trước: " : offset === 1 ? "Đề tiếp theo: " : ""}{t.title}</Link></li>;
 })}</ul>
 <Link className="mr-5 inline-flex min-h-11 items-center" href={topicPath(grade,skill,topic.slug)}>Về chủ đề {topic.name}</Link>
 <Link className="inline-flex min-h-11 items-center" href={skillPath(grade,skill)}>Về kỹ năng {SKILL_NAMES[skill]}</Link></nav>
 </PageShell>;
}
