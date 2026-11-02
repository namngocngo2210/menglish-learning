import { ensureContent } from "@/lib/content/source";
import { toQuizPool } from "@/lib/random-quiz";
import { AdSlot } from "@/components/ads/AdSlot";
import Link from "next/link";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { RandomTrigger } from "@/components/quiz/random-context";
import { HowTo } from "@/components/quiz/HowTo";
import { PreviousResult } from "@/components/quiz/PreviousResult";
import { Quiz } from "@/components/quiz/Quiz";
import { JsonLd } from "@/components/json-ld";
import { TITLE_MAX, buildMetadata, breadcrumbJsonLd, quizJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, ChipList } from "@/components/ui-kit";
import { roomsEnabled } from "@/lib/rooms/flag";
import { accountsEnabled } from "@/lib/account/flag";
import { SaveProgressInvite } from "@/components/account/SaveProgressInvite";
import { getTestWithQuestions, getTopics, getTestsForTopic, estimateMinutes } from "@/lib/content/load";
import { isSlug, roomsLandingPath, gradeSlug, parseGradeSlug, parseSkill, testPath, homePath, gradePath, skillPath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamic = "force-dynamic";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-primary bg-surface px-4 py-2 font-bold text-primary no-underline hover:bg-sky-soft";
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
 const number = p.test.replace("de-", "");
 // Reading reads "Đọc hiểu lớp 6 · Đề dài 1"; other topics "Động từ khuyết thiếu lớp 6 · Đề 1".
 const heading = skill === "doc-hieu" ? `${SKILL_NAMES[skill]} lớp ${grade} · ${topic.name} ${number}` : `${topic.name} lớp ${grade} · Đề ${number}`;
 const tests = getTestsForTopic(grade, skill, topic.slug); const index = tests.findIndex(t => t.slug === test.slug);
 const next = [tests[index + 1], tests[index + 2]].filter(Boolean);
 const context = [`${test.questions.length} câu`, quiz.passages.length ? `${quiz.passages.length} bài đọc` : "", `~${estimateMinutes(test.questions.length)} phút`].filter(Boolean).join(" · ");
 const roomHref = `${roomsLandingPath()}?de=${test.slug}#tao-phong`;
 return <PageShell compact title={heading}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }, { name: test.title, path: testPath(grade, skill, topic.slug, p.test) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name,href:topicPath(grade,skill,topic.slug)},{label:`Đề ${number}`}]}/>
 <JsonLd data={quizJsonLd({ name: test.title, description: `Bài tập tiếng Anh lớp ${grade}, kỹ năng ${SKILL_NAMES[skill].toLowerCase()}, chủ đề ${topic.name}.`, path: testPath(grade, skill, topic.slug, p.test), grade, skillName: SKILL_NAMES[skill], topicName: topic.name, questionCount: test.questions.length, datePublished: test.publishedAt })}/>
 <header className="flex flex-wrap items-center gap-x-4"><h1 className="text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">{heading}</h1><p className="min-w-0 flex-1 text-sm font-semibold text-primary sm:text-base">{context}<PreviousResult slug={test.slug}/></p><HowTo/></header>
 <RandomQuiz hideTrigger poolUrl={`/pool/${gradeSlug(grade)}/${skill}/${topic.slug}`} afterResult={<AdSlot slot="footer"/>}>
  <Quiz questions={quiz.questions.map(({ id, stem, options, correctKey, explanation, passageId }) => ({ id, stem, options, correctKey, explanation, passageId }))} passages={quiz.passages} progressKey={test.slug} afterResult={<AdSlot slot="footer"/>} menu={roomsEnabled() ? <Link href={roomHref}>Tạo phòng từ đề này</Link> : undefined}/>
  <nav aria-label="Đề liên quan" className="mt-8 space-y-3"><h2 className="text-lg font-bold">Đề tiếp theo</h2>
   <ChipList items={[...next.map((t, i) => ({ label: `Đề ${t.slug.split("de-")[1]}${i === 0 ? " →" : ""}`, href: `/${t.slug}` })), { label: `Cả bộ ${tests.length} đề`, href: topicPath(grade, skill, topic.slug) }]}/>
   <div className="flex flex-col gap-3 sm:flex-row">{roomsEnabled() && <Link data-slot="create-room-from-test" href={roomHref} className={secondary}>Tạo phòng từ đề này</Link>}<RandomTrigger className={secondary}/></div>
  </nav>
 </RandomQuiz>
 {accountsEnabled() && <SaveProgressInvite/>}
 </PageShell>;
}
