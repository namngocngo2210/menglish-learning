import Image from "next/image";
import Link from "next/link";
import { Shuffle, GraduationCap, Users } from "lucide-react";
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
 const quick = [
  { href: "/quick-practice", Icon: Shuffle, label: "Luyện nhanh 10 phút", hint: "Đề trộn ngẫu nhiên", hot: true },
  { href: ENTRANCE_PATH, Icon: GraduationCap, label: "Thi vào lớp 10", hint: "Đề thi và đề luyện", hot: false },
  ...(roomsEnabled() ? [{ href: roomsLandingPath(), Icon: Users, label: "Luyện tập nhóm", hint: "Tạo phòng, gửi mã cho bạn", hot: false }] : []),
 ];
 return <PageShell title={SITE.tagline} hero={<section className="border-b border-navy-soft/20 bg-warm"><div className="mx-auto grid max-w-6xl items-center gap-5 px-5 py-7 sm:px-8 md:grid-cols-[1.5fr_1fr] md:gap-12 md:py-14"><div><p className="mb-2 text-sm font-bold text-primary">Luyện tiếng Anh miễn phí</p><h1 className="text-3xl leading-tight font-bold md:text-5xl">{SITE.tagline}</h1><p className="mt-3 text-navy-soft">Chọn lớp, chọn kỹ năng, làm bài và xem lời giải. Không cần đăng nhập.</p></div><Image unoptimized priority src="/brand/mascot.webp" alt="Chú ong BeeJunior đeo kính cầm bút và sách" width={512} height={348} className="mx-auto hidden h-auto w-72 md:block"/></div></section>}>
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }])}/><JsonLd data={websiteJsonLd()}/><JsonLd data={organizationJsonLd()}/>
  <div><SkillHub grades={grades} skills={Object.fromEntries(grades.map(g => [g, getSkills(g)]))}/></div>
  <section aria-labelledby="now-heading"><h2 id="now-heading" className="text-2xl font-bold">Làm ngay</h2><ul className={`mt-4 grid gap-3 ${quick.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>{quick.map(({ href, Icon, label, hint, hot }) => <li key={href}><Link href={href} className={`${tileClass} ${hot ? "border-primary bg-sky-soft" : ""}`}><Icon aria-hidden="true" className="size-6 text-primary"/><b className="text-lg">{label}</b><span className="text-sm text-navy-soft">{hint}</span></Link></li>)}</ul></section>
  <AdSlot slot="in-content"/>
 </PageShell>;
}
