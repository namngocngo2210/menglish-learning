import { PageShell, LinkCardList } from "@/components/ui-kit";
import { getGrades } from "@/lib/content/load";
import { gradePath } from "@/lib/routes";
import { SITE } from "@/lib/site-config";
export const dynamicParams = false;
export const revalidate = 3600;
export default function Home() {
 return <PageShell title={SITE.tagline}><p>Chọn lớp để xem nội dung luyện tập mẫu. Không cần đăng nhập.</p><p>Nội dung tự soạn chỉ để kiểm thử giao diện, chưa dùng cho học tập chính thức.</p><LinkCardList items={getGrades().map(grade => ({ label: `Lớp ${grade}`, href: gradePath(grade) }))}/></PageShell>;
}
