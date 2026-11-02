import { testSlugPath } from "@/lib/routes";
import { ensureContent } from "@/lib/content/source";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { JsonLd } from "@/components/json-ld";
import { AdSlot } from "@/components/ads/AdSlot";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { getEntranceTests } from "@/lib/content/load";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ title: "Ôn thi tiếng Anh vào lớp 10", description: "Ôn thi vào lớp 10 với đề tiếng Anh tổng hợp từ ngân hàng lớp 8–9, có kiểm tra đáp án và giải thích tiếng Việt.", path: "/grade-10-entrance" });
export default async function EntrancePage() {
 await ensureContent();
 return <PageShell title="Ôn thi tiếng Anh vào lớp 10">
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Thi vào lớp 10", path: "/grade-10-entrance" }])}/>
  <Breadcrumbs items={[{ label: "Trang chủ", href: "/" }, { label: "Thi vào lớp 10" }]}/>
  <p>Luyện đề tiếng Anh vào lớp 10: đề thi chính thức của Sở GD&ĐT Hà Nội các năm 2024, 2025, 2026 (các câu có hình minh họa không được đưa vào) và các đề tổng hợp từ ngân hàng câu hỏi lớp 8–9. Chọn đáp án, kiểm tra từng câu rồi nộp bài để xem điểm.</p>
  <RandomQuiz poolUrl="/pool/grade-10-entrance" size={40} afterResult={<AdSlot slot="footer"/>}/>
  <LinkCardList items={[...getEntranceTests()].sort((a, b) => Number(b.slug.includes("de-chinh-thuc-")) - Number(a.slug.includes("de-chinh-thuc-"))).map(t => ({ label: t.title, href: testSlugPath(t.slug), description: `${t.questionIds.length} câu hỏi · Có giải thích đáp án`, progressKey: t.slug }))}/>
  <AdSlot slot="footer"/>
 </PageShell>;
}
