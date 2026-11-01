import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { JsonLd } from "@/components/json-ld";
import { loadBundle } from "@/lib/content/load";
import { GRADES } from "@/lib/routes";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import officialExamsReport from "@/content/official-exams-report.json";
const officialExamStatuses: Record<string, string> = {
 "imported": "Đã xuất bản",
 "ocr-transcribed": "Đã xuất bản (bản scan, chép lại bằng OCR 2 lượt độc lập)",
 "scanned-no-text-layer": "Bản scan, không có lớp văn bản — bỏ qua",
 "no-keyed-items": "Không có câu hỏi kèm đáp án hợp lệ — bỏ qua",
 "cache-missing": "Thiếu tệp trong bộ nhớ đệm — bỏ qua",
 "parse-error": "Lỗi phân tích PDF — bỏ qua",
};
export const revalidate = 3600;
export const metadata = buildMetadata({ title: "Nguồn dữ liệu và giấy phép", description: "Nguồn văn bản, giấy phép và thống kê câu hỏi, bài đọc theo lớp trong ngân hàng luyện tiếng Anh THCS.", path: "/nguon-du-lieu" });
export default function CreditsPage() {
 const bank = loadBundle();
 return <PageShell title="Nguồn dữ liệu và giấy phép">
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Nguồn dữ liệu và giấy phép", path: "/nguon-du-lieu" }])}/>
  <Breadcrumbs items={[{ label: "Trang chủ", href: "/" }, { label: "Nguồn dữ liệu và giấy phép" }]}/>
  <p>Câu hỏi được tạo tự động bằng thuật toán và quy tắc từ văn bản gốc của các nguồn dưới đây, không dùng AI. Nội dung có giải thích tiếng Việt và đã được chủ sở hữu duyệt xuất bản.</p>
  <p>Thống kê tính các câu hỏi đã xuất bản và bài đọc được dùng theo từng lớp. Một bài đọc có thể được dùng ở nhiều lớp; mỗi bài chỉ được tính một lần trong mỗi lớp.</p>
  {bank.sources.map(source => <section key={source.id} className="space-y-4 rounded-xl border border-navy-soft/20 p-5 sm:p-7">
   <h2 className="text-xl font-bold"><a className="inline-flex min-h-11 items-center" href={source.baseUrl}>{source.name}</a></h2>
   <p>Giấy phép: {source.license}</p><p>{source.attribution}</p>
   <table className="w-full text-left"><caption className="mb-3 text-left font-semibold">Nội dung đã xuất bản từ {source.name}</caption><thead><tr><th scope="col" className="p-2">Lớp</th><th scope="col" className="p-2">Câu hỏi</th><th scope="col" className="p-2">Bài đọc</th></tr></thead><tbody>{GRADES.map(grade => {
    const questions = bank.questions.filter(q => q.sourceId === source.id && q.grade === grade);
    const passageIds = new Set(bank.questions.filter(q => q.grade === grade).map(q => q.passageId));
    return <tr key={grade} className="border-t border-navy-soft/20"><th scope="row" className="p-2">{grade}</th><td className="p-2">{questions.length}</td><td className="p-2">{bank.passages.filter(p => p.sourceId === source.id && passageIds.has(p.id)).length}</td></tr>;
   })}</tbody></table>
  </section>)}
  <section className="space-y-4 rounded-xl border border-navy-soft/20 p-5 sm:p-7">
   <h2 className="text-xl font-bold">Đề chính thức Bộ/Sở GD&ĐT</h2>
   <p>Câu hỏi từ đề chính thức đã được chủ sở hữu duyệt xuất bản và được giữ nguyên văn. Với đề scan, AI chỉ chép lại chữ từ ảnh (không viết lại, không giải); đáp án chỉ lấy từ file đáp án chính thức, và câu chỉ được giữ khi hai lượt chép độc lập khớp nhau.</p>
   {!officialExamsReport.seeds.some(seed => seed.status === "imported" || seed.status === "ocr-transcribed") && <p>Chưa có câu hỏi nào từ các đề chính thức được xuất bản.</p>}
   <div className="overflow-x-auto">
    <table className="w-full text-left">
     <caption className="mb-3 text-left font-semibold">Kết quả xử lý các đề chính thức đã xác minh</caption>
     <thead><tr><th scope="col" className="p-2">Năm</th><th scope="col" className="p-2">Tỉnh</th><th scope="col" className="p-2">Nguồn</th><th scope="col" className="p-2">Trạng thái</th><th scope="col" className="p-2">Số câu</th><th scope="col" className="p-2">Đọc được / loại do hai lượt không khớp</th></tr></thead>
     <tbody>{officialExamsReport.seeds.map(seed => <tr key={seed.url} className="border-t border-navy-soft/20">
      <th scope="row" className="p-2">{seed.year}</th>
      <td className="p-2">{seed.province}</td>
      <td className="p-2"><a className="inline-flex min-h-11 min-w-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2" href={seed.pageUrl ?? seed.url} aria-label={`Nguồn đề chính thức ${seed.province} năm ${seed.year}`}>Xem nguồn</a></td>
      <td className="p-2">{officialExamStatuses[seed.status] ?? "Chưa xác định"}</td>
      <td className="p-2">{seed.items}</td>
      <td className="p-2">{"ocr" in seed && seed.ocr ? `${seed.ocr.extracted} / ${seed.ocr.rejected}` : "—"}</td>
     </tr>)}</tbody>
    </table>
   </div>
  </section>
 </PageShell>;
}
