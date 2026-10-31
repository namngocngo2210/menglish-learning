import { PageShell, Breadcrumbs } from "@/components/ui-kit";
import { homePath } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export default function PrivacyPage() { return <PageShell title="Chính sách bảo mật"><Breadcrumbs items={[{label:"Trang chủ",href:homePath()},{label:"Chính sách bảo mật"}]}/><p>Bản mẫu này không có đăng nhập, biểu mẫu thu thập thông tin cá nhân, quảng cáo hoặc công cụ phân tích. Không lưu câu trả lời hay tiến độ học tập.</p><p>Chính sách dành cho phiên bản chính thức sẽ được cập nhật khi có thêm chức năng.</p></PageShell>; }
