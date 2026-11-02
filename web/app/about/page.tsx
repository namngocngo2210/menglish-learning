import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { homePath, aboutPath } from "@/lib/routes";
export const metadata = buildMetadata({ title: "Giới thiệu", description: "Tìm hiểu nền tảng luyện tiếng Anh miễn phí, nội dung từ VOA Learning English và cách tự luyện không cần tài khoản.", path: aboutPath() });
export const revalidate = 3600;
export default function AboutPage() {
 return <PageShell title="Giới thiệu"><JsonLd data={breadcrumbJsonLd([{name:"Trang chủ",path:homePath()},{name:"Giới thiệu",path:aboutPath()}])}/><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Giới thiệu"}]}/><article className="max-w-prose space-y-8 leading-relaxed"><section className="space-y-3"><h2 className="text-xl font-bold">Một góc tự luyện tiếng Anh</h2><p>Đây là nền tảng luyện tiếng Anh miễn phí với tên thương hiệu tạm. Học sinh không cần đăng nhập.</p><p>Câu hỏi được tạo tự động bằng thuật toán từ bài đọc VOA Learning English, có giải thích tiếng Việt để em tự luyện và xem lại.</p></section><section className="space-y-3"><h2 className="text-xl font-bold">Em có thể luyện tập như thế nào?</h2><ul className="list-disc space-y-2 pl-6"><li>Chọn lớp, kỹ năng và chủ đề muốn ôn.</li><li>Chọn đáp án và kiểm tra để đọc giải thích.</li><li>Nộp bài để xem kết quả, hoặc làm lại để tự luyện thêm.</li></ul></section><section className="space-y-3 border-t border-navy-soft/20 pt-6"><h2 className="text-xl font-bold">Liên hệ</h2><p>Thông tin liên hệ sẽ được bổ sung.</p></section></article></PageShell>;
}
