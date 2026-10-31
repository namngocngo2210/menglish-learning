import { notFound } from "next/navigation";
import { PageShell, Breadcrumbs, LinkCardList } from "@/components/ui-kit";
import { getGrades, getSkills } from "@/lib/content/load";
import { gradeSlug, parseGradeSlug, homePath, skillPath, SKILL_NAMES } from "@/lib/routes";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return getGrades().map(g => ({ grade: gradeSlug(g) })); }
export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
 const grade = parseGradeSlug((await params).grade); if (!grade) notFound();
 return <PageShell title={`Tiếng Anh lớp ${grade}`}><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: `Lớp ${grade}` }]}/><LinkCardList items={getSkills(grade).map(skill => ({ label: SKILL_NAMES[skill], href: skillPath(grade, skill) }))}/></PageShell>;
}
