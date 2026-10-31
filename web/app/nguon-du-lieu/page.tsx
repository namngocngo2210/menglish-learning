import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { JsonLd } from "@/components/json-ld";
import { loadBundle } from "@/lib/content/load";
import { GRADES } from "@/lib/routes";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
export const revalidate = 3600;
export const metadata = buildMetadata({ title: "Nguồn dữ liệu và giấy phép", description: "Nguồn văn bản, giấy phép và thống kê câu hỏi, bài đọc theo lớp trong ngân hàng luyện tiếng Anh THCS.", path: "/nguon-du-lieu" });
export default function CreditsPage() {
 const bank = loadBundle();
 return <PageShell title="Nguồn dữ liệu và giấy phép">
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Nguồn dữ liệu và giấy phép", path: "/nguon-du-lieu" }])}/>
  <Breadcrumbs items={[{ label: "Trang chủ", href: "/" }, { label: "Nguồn dữ liệu và giấy phép" }]}/>
  <p>Câu hỏi được tạo tự động bằng thuật toán và quy tắc từ văn bản gốc của các nguồn dưới đây, không dùng AI. Nội dung có giải thích tiếng Việt và đã được chủ sở hữu duyệt xuất bản.</p>
  <p>Thống kê tính các câu hỏi đã xuất bản và bài đọc được dùng theo từng lớp. Một bài đọc có thể được dùng ở nhiều lớp; mỗi bài chỉ được tính một lần trong mỗi lớp.</p>
  {bank.sources.map(source => <section key={source.id} className="space-y-4 rounded-md border border-navy-soft/20 p-5 sm:p-7">
   <h2 className="text-xl font-bold"><a className="inline-flex min-h-11 items-center" href={source.baseUrl}>{source.name}</a></h2>
   <p>Giấy phép: {source.license}</p><p>{source.attribution}</p>
   <table className="w-full text-left"><caption className="mb-3 text-left font-semibold">Nội dung đã xuất bản từ {source.name}</caption><thead><tr><th scope="col" className="p-2">Lớp</th><th scope="col" className="p-2">Câu hỏi</th><th scope="col" className="p-2">Bài đọc</th></tr></thead><tbody>{GRADES.map(grade => {
    const questions = bank.questions.filter(q => q.sourceId === source.id && q.grade === grade);
    const passageIds = new Set(bank.questions.filter(q => q.grade === grade).map(q => q.passageId));
    return <tr key={grade} className="border-t border-navy-soft/20"><th scope="row" className="p-2">{grade}</th><td className="p-2">{questions.length}</td><td className="p-2">{bank.passages.filter(p => p.sourceId === source.id && passageIds.has(p.id)).length}</td></tr>;
   })}</tbody></table>
  </section>)}
 </PageShell>;
}
