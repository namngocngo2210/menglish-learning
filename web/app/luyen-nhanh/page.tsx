import { ensureContent } from "@/lib/content/source";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { JsonLd } from "@/components/json-ld";
import { AdSlot } from "@/components/ads/AdSlot";
import { RandomQuiz } from "@/components/quiz/RandomQuiz";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ title: "Luyện nhanh 10 phút", description: "Đề tiếng Anh trộn ngẫu nhiên, làm trong khoảng 10 phút, có kiểm tra đáp án và giải thích tiếng Việt.", path: "/luyen-nhanh" });
export default async function QuickPage() {
 await ensureContent();
 return <PageShell title="Luyện nhanh 10 phút">
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Luyện nhanh 10 phút", path: "/luyen-nhanh" }])}/>
  <Breadcrumbs items={[{ label: "Trang chủ", href: "/" }, { label: "Luyện nhanh 10 phút" }]}/>
  <p>Mười câu trộn ngẫu nhiên từ ngân hàng câu hỏi. Chọn đáp án, kiểm tra từng câu rồi nộp bài để xem điểm.</p>
  <RandomQuiz poolUrl="/pool/thi-vao-lop-10" size={10} afterResult={<AdSlot slot="footer"/>}/>
  <AdSlot slot="footer"/>
 </PageShell>;
}
