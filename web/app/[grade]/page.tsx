import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList, SKILL_DESCRIPTIONS } from "@/components/ui-kit";
import { getGrades, getSkills } from "@/lib/content/load";
import { gradePath, gradeSlug, parseGradeSlug, homePath, skillPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().map(g => ({ grade: gradeSlug(g) })); }
export async function generateMetadata({ params }: { params: Promise<{ grade: string }> }) {
 const grade = parseGradeSlug((await params).grade); if (!grade) return {};
 return buildMetadata({ title: `Tiếng Anh lớp ${grade}`, description: `Luyện tiếng Anh lớp ${grade} với các kỹ năng đọc hiểu, ngữ pháp, từ vựng và viết câu theo chủ đề.`, path: gradePath(grade) });
}
export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
 const grade = parseGradeSlug((await params).grade); if (!grade) notFound();
 return <PageShell title={`Tiếng Anh lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }])}/><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: `Lớp ${grade}` }]}/><p>Chọn kỹ năng em muốn luyện. Mỗi bài đều có lời giải để em tự xem lại.</p><LinkCardList items={getSkills(grade).map(skill => ({ label: SKILL_NAMES[skill], skill, description: SKILL_DESCRIPTIONS[skill], href: skillPath(grade, skill) }))}/><AdSlot slot="footer"/></PageShell>;
}
