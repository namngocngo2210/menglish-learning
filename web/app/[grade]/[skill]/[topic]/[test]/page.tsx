import { AdSlot } from "@/components/ads/AdSlot";
import { Quiz } from "@/components/quiz/Quiz";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd, quizJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, PassageBlock } from "@/components/ui-kit";
import { getAllTestSlugs, getTestWithQuestions, getTopics } from "@/lib/content/load";
import { isSlug, gradeSlug, parseGradeSlug, parseSkill, parseTestSlug, testPath, homePath, gradePath, skillPath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getAllTestSlugs().map(slug => { const p = parseTestSlug(slug)!; return {grade:gradeSlug(p.grade),skill:p.skill,topic:p.topic,test:p.test}; }); }
export async function generateMetadata({ params }: { params: Promise<{ grade: string; skill: string; topic: string; test: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !isSlug(p.test)) return {};
 const topic = getTopics(grade, skill).find(t => t.slug === p.topic); if (!topic) return {};
 const test = getTestWithQuestions(testPath(grade, skill, topic.slug, p.test).slice(1)); if (!test) return {};
 return buildMetadata({ title: `${test.title} - Lớp ${grade}`, description: `Bài tập tiếng Anh lớp ${grade}, kỹ năng ${SKILL_NAMES[skill].toLowerCase()}, chủ đề ${topic.name}: ${test.questions.length} câu có đáp án và giải thích.`, path: testPath(grade, skill, topic.slug, p.test), type: "article" });
}
export default async function TestPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string; test: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !isSlug(p.test)) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 const test = getTestWithQuestions(testPath(grade,skill,topic.slug,p.test).slice(1)); if (!test) notFound();
 return <PageShell title={test.title}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }, { name: SKILL_NAMES[skill], path: skillPath(grade, skill) }, { name: topic.name, path: topicPath(grade, skill, topic.slug) }, { name: test.title, path: testPath(grade, skill, topic.slug, p.test) }])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name,href:topicPath(grade,skill,topic.slug)},{label:test.title}]}/>
 <JsonLd data={quizJsonLd({ name: test.title, description: `Bài tập tiếng Anh lớp ${grade}, kỹ năng ${SKILL_NAMES[skill].toLowerCase()}, chủ đề ${topic.name}.`, path: testPath(grade, skill, topic.slug, p.test), grade, skillName: SKILL_NAMES[skill], topicName: topic.name, questionCount: test.questions.length, datePublished: test.publishedAt })}/>
 <p>Đề mẫu tự soạn · {test.questions.length} câu hỏi · Không giới hạn thời gian</p>
 <Quiz questions={test.questions} passageContent={test.passages.length ? <>{test.passages.map(passage => <PassageBlock key={passage.id} passage={passage}/>)}</> : undefined} afterResult={<AdSlot slot="footer"/>}/>
 <section aria-labelledby="sources-heading" className="space-y-4 rounded-md border border-navy-soft/20 bg-warm p-5 text-sm sm:p-6"><h2 id="sources-heading" className="text-lg font-bold">Nguồn nội dung</h2>{test.sources.map(source => <div key={source.id} className="max-w-prose space-y-2"><h3 className="font-semibold">{source.name}</h3><p>{source.attribution}</p><p>Giấy phép: Nội dung mẫu nguyên bản, không dùng cho sản phẩm chính thức.</p></div>)}</section>
 </PageShell>;
}
