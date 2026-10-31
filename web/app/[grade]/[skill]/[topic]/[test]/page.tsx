import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, QuestionBlock, PassageBlock } from "@/components/ui-kit";
import { getAllTestSlugs, getTestWithQuestions, getTopics } from "@/lib/content/load";
import { isSlug, gradeSlug, parseGradeSlug, parseSkill, parseTestSlug, testPath, homePath, gradePath, skillPath, topicPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getAllTestSlugs().map(slug => { const p = parseTestSlug(slug)!; return {grade:gradeSlug(p.grade),skill:p.skill,topic:p.topic,test:p.test}; }); }
export default async function TestPage({ params }: { params: Promise<{ grade: string; skill: string; topic: string; test: string }> }) {
 const p = await params; const grade = parseGradeSlug(p.grade); const skill = parseSkill(p.skill);
 if (!grade || !skill || !isSlug(p.test)) notFound();
 const topic = getTopics(grade,skill).find(t=>t.slug===p.topic); if (!topic) notFound();
 const test = getTestWithQuestions(testPath(grade,skill,topic.slug,p.test).slice(1)); if (!test) notFound();
 return <PageShell title={test.title}><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:`Lớp ${grade}`,href:gradePath(grade)},{label:SKILL_NAMES[skill],href:skillPath(grade,skill)},{label:topic.name,href:topicPath(grade,skill,topic.slug)},{label:test.title}]}/>
 <p>Đề mẫu tự soạn · {test.questions.length} câu. Bản xem trước hiển thị sẵn đáp án và giải thích.</p>
 {test.passages.map(passage=><PassageBlock key={passage.id} passage={passage}/>)}
 {test.questions.map((question,index)=><QuestionBlock key={question.id} question={question} number={index+1}/>)}
 <section aria-label="Nguồn nội dung"><h2 className="font-bold">Nguồn nội dung mẫu</h2>{test.sources.map(source=><div key={source.id}><p>{source.name}</p><p>{source.attribution}</p><p>Giấy phép: Nội dung mẫu nguyên bản, không dùng cho sản phẩm chính thức.</p></div>)}</section>
 </PageShell>;
}
