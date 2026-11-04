import Link from "next/link";
import { MousePointer2, PencilLine, ListChecks, ArrowRight } from "lucide-react";
import { HeroArt } from "@/components/art/HeroArt";
import { SkillIcon, skillTone, type SkillKind } from "@/components/art/SkillIcon";
import { JsonLd } from "@/components/json-ld";
import { AdSlot } from "@/components/ads/AdSlot";
import { SkillHub } from "@/components/home/SkillHub";
import { tileClass } from "@/components/home/tiles";
import { PageShell } from "@/components/ui-kit";
import { getGrades, getSkills } from "@/lib/content/load";
import { ensureContent } from "@/lib/content/source";
import { ENTRANCE_PATH, roomsLandingPath } from "@/lib/routes";
import { roomsEnabled } from "@/lib/rooms/flag";
import { buildMetadata, breadcrumbJsonLd, websiteJsonLd, organizationJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site-config";
export const metadata = buildMetadata({ title: "Luyện tiếng Anh miễn phí, không cần đăng nhập", description: "Khám phá nội dung tiếng Anh theo kỹ năng, chủ đề và bài luyện tập. Không cần đăng nhập.", path: "/" });
export const dynamic = "force-dynamic";
export default async function Home() {
 await ensureContent();
 const grades = getGrades();
 const quick: { href: string; kind: SkillKind; label: string; hint: string }[] = [
  { href: "/quick-practice", kind: "luyen-nhanh", label: "Luyện nhanh 10 phút", hint: "Đề trộn ngẫu nhiên" },
  { href: ENTRANCE_PATH, kind: "de-thi", label: "Thi vào lớp 10", hint: "Đề thi và đề luyện" },
  ...(roomsEnabled() ? [{ href: roomsLandingPath(), kind: "nhom" as const, label: "Luyện tập nhóm", hint: "Cùng bạn làm bài" }] : []),
 ];
 return <PageShell title={SITE.tagline} hero={<section className="border-b border-navy-soft/20 bg-warm"><div className="mx-auto grid max-w-6xl items-center gap-4 px-5 py-6 sm:px-8 md:grid-cols-[1.5fr_1fr] md:gap-12 md:py-8"><div><h1 className="text-3xl leading-tight font-bold md:text-5xl">{SITE.tagline}</h1><p className="mt-3 text-navy-soft">Chọn lớp, làm bài, xem lời giải. Miễn phí.</p></div><HeroArt/></div></section>}>
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }])}/><JsonLd data={websiteJsonLd()}/><JsonLd data={organizationJsonLd()}/>
  <div><SkillHub grades={grades} skills={Object.fromEntries(grades.map(g => [g, getSkills(g)]))}/></div>
  <section aria-labelledby="now-heading"><h2 id="now-heading" className="text-2xl font-bold">Làm ngay</h2><ul className={`mt-4 grid gap-3 ${quick.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>{quick.map(({ href, kind, label, hint }) => <li key={href}><Link href={href} className={tileClass} style={{ borderTopColor: `var(--color-skill-${skillTone[kind]})` }}><SkillIcon kind={kind}/><b className="mt-2 text-lg">{label}</b><span className="text-sm text-navy-soft">{hint}</span></Link></li>)}</ul></section>
  <section aria-labelledby="how-heading" className="rounded-2xl bg-sky-soft p-4 sm:p-6"><h2 id="how-heading" className="text-2xl font-bold">Cách học</h2><ol className="mt-4 grid grid-cols-3 gap-3">{[{ Icon: MousePointer2, label: "Chọn lớp" }, { Icon: PencilLine, label: "Làm bài" }, { Icon: ListChecks, label: "Xem lời giải" }].map(({ Icon, label }, index) => <li key={label} className="flex flex-col items-center gap-1 text-center sm:flex-row sm:text-left sm:gap-2"><Icon aria-hidden="true" className="size-6 text-primary"/><span className="font-semibold">{index + 1}. {label}</span>{index < 2 && <ArrowRight aria-hidden="true" className="hidden size-4 text-primary sm:block"/>}</li>)}</ol></section>
  <details className="rounded-2xl border border-navy-soft/20 p-4 sm:p-6"><summary className="min-h-11 cursor-pointer content-center font-bold"><h2 className="inline text-lg">Xem thêm về BeeJunior</h2></summary><p className="mt-3 max-w-prose">BeeJunior giúp học sinh lớp 6–9 luyện tiếng Anh qua bài đọc, ngữ pháp, từ vựng và viết câu. Em có thể chọn kỹ năng để học từng chút mỗi ngày.</p><p className="mt-3 max-w-prose">Các bài luyện hoàn toàn miễn phí, không cần đăng nhập. Sau khi làm bài, em xem đáp án kèm lời giải để hiểu cách làm và thử lại.</p></details>
  <AdSlot slot="in-content"/>
 </PageShell>;
}
