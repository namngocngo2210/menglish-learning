import type { Metadata } from "next";
import Link from "next/link";
import { Link2, Play, PlusCircle } from "lucide-react";
import { Mascot } from "@/components/art/Mascot";
import { AdSlot } from "@/components/ads/AdSlot";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { RoomEntry } from "@/components/rooms/RoomEntry";
import { Breadcrumbs, PageShell } from "@/components/ui-kit";
import { ROOMS_DESCRIPTION, ROOMS_FAQ, ROOMS_PRIVACY, ROOMS_STEPS, ROOMS_TITLE } from "@/lib/rooms/landing-content";
import { buildRoomCatalog } from "@/lib/rooms/catalog";
import { roomsEnabled } from "@/lib/rooms/flag";
import { breadcrumbJsonLd, buildMetadata, webPageJsonLd } from "@/lib/seo";
import { GRADES, ENTRANCE_PATH, gradePath, homePath, roomsLandingPath } from "@/lib/routes";

// Static: the flag is read at build time, so changing ROOMS_ENABLED needs a rebuild.
export const dynamic = "force-static";

const SOON_TITLE = "Luyện tập nhóm — sắp ra mắt";
export function generateMetadata(): Metadata {
 if (!roomsEnabled()) {
  return { ...buildMetadata({ title: SOON_TITLE, description: "Luyện tập nhóm tiếng Anh cùng bạn bè sắp ra mắt trên BeeJunior.", path: roomsLandingPath() }), robots: { index: false, follow: false } };
 }
 return buildMetadata({ title: ROOMS_TITLE, description: ROOMS_DESCRIPTION, path: roomsLandingPath() });
}

const crumbs = [{ label: "Trang chủ", href: homePath() }, { label: "Luyện tập nhóm" }];
const gradeLinks = <nav aria-label="Luyện tập theo lớp" className="flex flex-wrap gap-2">
 {GRADES.map(g => <Link key={g} href={gradePath(g)} className="inline-flex min-h-11 items-center rounded-xl border-2 border-navy/20 bg-white px-4 font-semibold no-underline hover:bg-warm">Lớp {g}</Link>)}
 <Link href={ENTRANCE_PATH} className="inline-flex min-h-11 items-center rounded-xl border-2 border-navy/20 bg-white px-4 font-semibold no-underline hover:bg-warm">Thi vào lớp 10</Link>
</nav>;

function ComingSoon() {
 return <PageShell title={SOON_TITLE}>
  <Breadcrumbs items={crumbs}/>
  <section className="max-w-prose space-y-4" data-state="coming-soon">
   <p className="text-lg leading-relaxed">Tính năng cùng bạn bè làm một đề, cùng lúc và xếp hạng khi nộp bài đang được chuẩn bị. Trong lúc chờ, em có thể tự luyện theo lớp và kỹ năng.</p>
   {gradeLinks}
  </section>
 </PageShell>;
}

export default function RoomsLandingPage() {
 if (!roomsEnabled()) return <ComingSoon/>;
 return <PageShell title="Luyện tập nhóm" hero={<div className="border-b border-navy-soft/10 bg-warm"><div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
  <Mascot pose="group" size={128} className="float-right ml-3 max-sm:w-24 max-sm:h-24"/>
  <p className="mb-3 text-sm font-semibold text-primary">BeeJunior · Luyện tập nhóm</p>
  <h1 className="max-w-3xl text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">Luyện tập nhóm</h1>
  <p className="mt-3 max-w-2xl text-lg">Cùng làm bài, cùng xem thứ hạng. Không cần tài khoản.</p>
 </div></div>}>
  <JsonLd data={breadcrumbJsonLd([{ name: "Trang chủ", path: homePath() }, { name: "Luyện tập nhóm", path: roomsLandingPath() }])}/>
  <JsonLd data={webPageJsonLd({ name: ROOMS_TITLE, description: ROOMS_DESCRIPTION, path: roomsLandingPath() })}/>
  <Breadcrumbs items={crumbs}/>
  <RoomEntry catalog={buildRoomCatalog()}/>
  <section aria-labelledby="cach-choi" className="space-y-4">
   <h2 id="cach-choi" className="text-xl font-bold">Cách chơi trong 3 bước</h2>
   <ol className="grid gap-4 md:grid-cols-3">{ROOMS_STEPS.map((s, i) => {
    const Icon = [PlusCircle, Link2, Play][i];
    return <li key={s.title} className="relative rounded-2xl bg-sky-soft p-5 md:after:absolute md:after:top-10 md:after:-right-4 md:after:h-0.5 md:after:w-4 md:after:bg-primary/30 md:last:after:hidden">
     <div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cta font-bold text-navy" aria-hidden="true">{i + 1}</span><span aria-hidden="true" className="h-0.5 flex-1 bg-primary/30"/><Icon width={28} height={28} aria-hidden="true" className="text-primary"/></div>
     <h3 className="mt-3 font-bold">{s.title}</h3><p className="mt-1 text-navy">{s.text}</p>
    </li>;
   })}</ol>
  </section>
  <details className="space-y-3 rounded-xl border border-navy/20 px-4">
   <summary className="min-h-11 cursor-pointer py-2 font-bold text-primary">An toàn và riêng tư</summary>
   <ul className="list-disc space-y-2 pb-4 pl-6">{ROOMS_PRIVACY.map(t => <li key={t}>{t}</li>)}</ul>
  </details>
  <AdSlot slot="in-content"/>
  <FaqSection items={ROOMS_FAQ}/>
  <section aria-labelledby="luyen-them" className="space-y-3"><h2 id="luyen-them" className="text-xl font-bold">Luyện tập một mình</h2>{gradeLinks}</section>
 </PageShell>;
}
