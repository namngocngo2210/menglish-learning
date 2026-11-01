import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList, SKILL_DESCRIPTIONS } from "@/components/ui-kit";
import { getGrades, getSkills } from "@/lib/content/load";
import { FaqSection } from "@/components/faq-section";
import { buildGradeFaq, gradeStats, skillStats } from "@/lib/seo-content";
import { getTopics } from "@/lib/content/load";
import { topicPath, gradePath, gradeSlug, parseGradeSlug, homePath, skillPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().map(g => ({ grade: gradeSlug(g) })); }
export async function generateMetadata({ params }: { params: Promise<{ grade: string }> }) {
 const grade = parseGradeSlug((await params).grade); if (!grade) return {};
 return buildMetadata({ title: fitTitle(`Tiếng Anh lớp ${grade}`, ": ngữ pháp, từ vựng, đọc hiểu"), description: `Luyện tiếng Anh lớp ${grade} với ${gradeStats(grade).questions} câu hỏi trong ${gradeStats(grade).tests} đề, chia theo ${gradeStats(grade).topics} chủ đề ngữ pháp, từ vựng; có đáp án và giải thích.`, path: gradePath(grade) });
}
export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
 const grade = parseGradeSlug((await params).grade); if (!grade) notFound();
 return <PageShell title={`Tiếng Anh lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }])}/><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: `Lớp ${grade}` }]}/><p>Chọn kỹ năng em muốn luyện. Mỗi bài đều có lời giải để em tự xem lại. Tiếng Anh lớp {grade} trên BeeJunior hiện có {gradeStats(grade).questions} câu hỏi trong {gradeStats(grade).tests} đề luyện tập, miễn phí và không cần đăng nhập.</p><LinkCardList items={getSkills(grade).map(skill => ({ label: SKILL_NAMES[skill], skill, description: `${SKILL_DESCRIPTIONS[skill]} · ${skillStats(grade, skill).topics} chủ đề · ${skillStats(grade, skill).tests} đề`, href: skillPath(grade, skill) }))}/><section className="space-y-3"><h2 className="text-xl font-bold">Chủ đề nổi bật lớp {grade}</h2><ul className="grid gap-2 sm:grid-cols-2">{(["ngu-phap", "tu-vung"] as const).flatMap(skill => getTopics(grade, skill).filter(t => t.slug !== "tong-hop").slice(0, 4).map(t => <li key={`${skill}/${t.slug}`}><Link className="inline-flex min-h-11 items-center" href={topicPath(grade, skill, t.slug)}>{t.name}</Link></li>))}</ul></section><FaqSection items={buildGradeFaq(grade)}/>{grade >= 8 && <Link className="inline-flex min-h-11 items-center rounded-xl border border-primary p-4 font-semibold" href="/thi-vao-lop-10">Ôn thi vào lớp 10</Link>}<AdSlot slot="footer"/></PageShell>;
}
