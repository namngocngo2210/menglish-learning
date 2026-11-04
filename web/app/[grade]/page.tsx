import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/json-ld";
import { fitTitle, buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList, MoreInfo } from "@/components/ui-kit";
import { getSkills } from "@/lib/content/load";
import { ensureContent } from "@/lib/content/source";
import { FaqSection } from "@/components/faq-section";
import { buildGradeFaq, gradeStats, skillStats } from "@/lib/seo-content";
import { getTopics } from "@/lib/content/load";
import { topicPath, gradePath, parseGradeSlug, homePath, skillPath, SKILL_NAMES } from "@/lib/routes";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ grade: string }> }) {
 await ensureContent();
 const grade = parseGradeSlug((await params).grade); if (!grade) return {};
 return buildMetadata({ title: fitTitle(`Tiếng Anh lớp ${grade}`, ": ngữ pháp, từ vựng, đọc hiểu"), description: `Luyện tiếng Anh lớp ${grade} với ${gradeStats(grade).questions} câu hỏi trong ${gradeStats(grade).tests} đề, chia theo ${gradeStats(grade).topics} chủ đề ngữ pháp, từ vựng; có đáp án và giải thích.`, path: gradePath(grade) });
}
export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
 await ensureContent();
 const grade = parseGradeSlug((await params).grade); if (!grade) notFound();
 return <PageShell title={`Tiếng Anh lớp ${grade}`}><JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: `Lớp ${grade}`, path: gradePath(grade) }])}/><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: `Lớp ${grade}` }]}/><p>Chọn kỹ năng em muốn luyện.</p><LinkCardList items={getSkills(grade).map(skill => ({ label: SKILL_NAMES[skill], skill, description: `${skillStats(grade, skill).tests} đề · ${skillStats(grade, skill).questions} câu`, href: skillPath(grade, skill) }))}/><section className="space-y-3"><h2 className="text-xl font-bold">Chủ đề nổi bật lớp {grade}</h2><ul className="grid gap-2 sm:grid-cols-2">{(["ngu-phap", "tu-vung"] as const).flatMap(skill => getTopics(grade, skill).filter(t => t.slug !== "tong-hop").slice(0, 4).map(t => <li key={`${skill}/${t.slug}`}><Link className="inline-flex min-h-11 items-center" href={topicPath(grade, skill, t.slug)}>{t.name}</Link></li>))}</ul></section><MoreInfo><p>Tiếng Anh lớp {grade} trên BeeJunior hiện có {gradeStats(grade).questions} câu hỏi trong {gradeStats(grade).tests} đề luyện tập, miễn phí và không cần đăng nhập. Mỗi bài đều có lời giải để em tự xem lại.</p></MoreInfo><FaqSection items={buildGradeFaq(grade)}/>{grade >= 8 && <Link className="inline-flex min-h-11 items-center rounded-xl border border-primary p-4 font-semibold" href="/grade-10-entrance">Ôn thi vào lớp 10</Link>}<AdSlot slot="footer"/></PageShell>;
}
