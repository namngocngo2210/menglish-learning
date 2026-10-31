import { toQuizPool } from "@/lib/random-quiz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { Quiz } from "@/components/quiz/Quiz";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { PreviousResult } from "@/components/quiz/PreviousResult";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { getEntranceTests, getEntranceTestWithQuestions } from "@/lib/content/load";
import { parseEntranceSlug } from "@/lib/routes";
import { buildMetadata, breadcrumbJsonLd, quizJsonLd } from "@/lib/seo";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getEntranceTests().map(t => parseEntranceSlug(t.slug)!); }
export async function generateMetadata({ params }: { params: Promise<{ test: string }> }) {
 const p = await params; const t = getEntranceTestWithQuestions(`thi-vao-lop-10/${p.test}`); if (!t) return {};
 return buildMetadata({ title: `${t.title} - Thi vào lớp 10`, description: `Ôn tiếng Anh vào lớp 10, ${p.test}: ${t.questions.length} câu tổng hợp lớp 8–9 có đáp án và giải thích tiếng Việt.`, path: `/${t.slug}`, type: "article" });
}
export default async function EntranceTestPage({ params }: { params: Promise<{ test: string }> }) {
 const p = await params; const t = getEntranceTestWithQuestions(`thi-vao-lop-10/${p.test}`); if (!t) notFound();
 const tests = getEntranceTests(); const index = tests.findIndex(test => test.slug === t.slug);
 const quiz = toQuizPool(t);
 return <PageShell title={t.title}>
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Thi vào lớp 10", path: "/thi-vao-lop-10" }, { name: t.title, path: `/${t.slug}` }])}/>
  <JsonLd data={quizJsonLd({ name: t.title, description: "Ôn thi tiếng Anh vào lớp 10 từ ngân hàng lớp 8–9.", path: `/${t.slug}`, grade: 9, skillName: "Tiếng Anh tổng hợp", topicName: "Thi vào lớp 10", questionCount: t.questions.length, datePublished: t.publishedAt })}/>
  <Breadcrumbs items={[{ label: "Trang chủ", href: "/" }, { label: "Thi vào lớp 10", href: "/thi-vao-lop-10" }, { label: t.title }]}/>
  <p>Ôn thi tiếng Anh vào lớp 10, tổng hợp kỹ năng và chủ đề lớp 8–9 với {t.questions.length} câu hỏi. Chọn đáp án, kiểm tra từng câu để đọc giải thích, rồi nộp bài để xem kết quả. Không giới hạn thời gian.</p>
  <PreviousResult slug={t.slug}/>
  <RandomQuiz poolUrl="/pool/thi-vao-lop-10" size={40} afterResult={<AdSlot slot="footer"/>}><Quiz questions={quiz.questions.map(({ id, stem, options, correctKey, explanation, passageId }) => ({ id, stem, options, correctKey, explanation, passageId }))} passages={quiz.passages} progressKey={t.slug} afterResult={<AdSlot slot="footer"/>}/></RandomQuiz>
  <nav aria-label="Đề ôn thi liên quan"><h2 className="text-xl font-bold">Tiếp tục ôn thi</h2><ul className="grid gap-3 sm:grid-cols-2">{tests.filter(test => test.slug !== t.slug).map(test => <li key={test.slug}><Link className="inline-flex min-h-11 items-center" href={`/${test.slug}`}>{tests.indexOf(test) === index-1 ? "Đề trước: " : tests.indexOf(test) === index+1 ? "Đề tiếp theo: " : ""}{test.title}</Link></li>)}</ul><Link className="inline-flex min-h-11 items-center" href="/thi-vao-lop-10">Về danh sách đề thi vào lớp 10</Link></nav>
 </PageShell>;
}
