import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { homePath } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export default function AboutPage() { return <PageShell title="Giới thiệu"><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Giới thiệu"}]}/><p>Đây là bản nền tảng luyện tiếng Anh cho học sinh lớp 6–9 với tên thương hiệu tạm. Học sinh không cần đăng nhập.</p><p>Các đề và bài đọc hiện tại là nội dung mẫu tự soạn để kiểm thử giao diện, chưa phải tài liệu học tập chính thức.</p></PageShell>; }
