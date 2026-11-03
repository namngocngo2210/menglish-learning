import Image from "next/image";
import Link from "next/link";
import { ProgressHydrator } from "@/components/quiz/ProgressHydrator";
import { ArrowUpRight, BookOpen, ChevronRight, Languages, LibraryBig, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import type { Question } from "@/lib/content/types";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { GradeChip } from "@/components/chrome/GradeChip";
import { type Skill } from "@/lib/routes";

export interface NavigationItem { label: string; href?: string; }
export interface LinkCard { label: string; href: string; description?: string; skill?: Skill; progressKey?: string; }
export const SKILL_DESCRIPTIONS: Record<Skill, string> = {
 "doc-hieu": "Đọc bài, tìm thông tin và hiểu ý nghĩa trong ngữ cảnh.",
 "ngu-phap": "Ôn cấu trúc và chọn cách dùng câu phù hợp.",
 "tu-vung": "Nhận biết nghĩa từ và cách dùng trong từng chủ đề.",
 "viet-cau": "Luyện sắp xếp ý và diễn đạt thành câu rõ ràng.",
};
const skillIcons = { "doc-hieu": BookOpen, "ngu-phap": LibraryBig, "tu-vung": Languages, "viet-cau": PenLine };

export function PageShell({ title, children, hero, compact }: { title: string; children: ReactNode; hero?: ReactNode; compact?: boolean }) {
 return <div className="flex min-h-screen flex-col">
  <a href="#noi-dung" className="sr-only z-50 rounded-xl bg-surface p-3 font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Chuyển đến nội dung</a>
  <SiteHeader/>
  <main id="noi-dung" tabIndex={-1} className="flex-1 outline-none">
   {compact ? null : hero ?? <div className="border-b border-navy-soft/10 bg-warm"><div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12"><p className="mb-3 text-sm font-semibold text-primary">BeeJunior · Luyện tập tiếng Anh</p><h1 className="max-w-3xl text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{title}</h1></div></div>}
   <div className={compact ? "mx-auto max-w-6xl space-y-3 px-5 py-2 sm:space-y-3 sm:px-8 sm:py-3" : "mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-12"}>{children}</div>
  </main>
  <SiteFooter/>
 </div>;
}
/** Below 640px only the last two levels show, behind a "…" link to the level above; the full chain stays in the DOM and in JSON-LD. */
export function Breadcrumbs({ items }: { items: readonly NavigationItem[] }) {
 const hiddenUntil = items.length - 2; const up = items[hiddenUntil - 1];
 return <div className="flex items-center justify-between gap-2"><nav aria-label="Đường dẫn" className="min-w-0"><ol className="flex min-w-0 items-center gap-x-2 text-sm max-sm:flex-nowrap sm:flex-wrap">{up?.href && <li className="flex shrink-0 items-center sm:hidden"><Link aria-label={`Lên ${up.label}`} className="inline-flex min-h-11 min-w-11 items-center justify-center" href={up.href}>…</Link></li>}{items.map((item, index) => <li key={index} className={`flex min-w-0 max-w-full items-center gap-2${index < hiddenUntil ? " max-sm:hidden" : ""}`}>{index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-navy-soft"/>}{item.href && index < items.length - 1 ? <Link className="inline-flex min-h-11 min-w-0 items-center py-2 pointer-fine:min-h-8 pointer-fine:py-0" href={item.href}><span className="truncate">{item.label}</span></Link> : <span className="min-w-0 truncate py-2 font-medium pointer-fine:py-0" aria-current="page">{item.label}</span>}</li>)}</ol></nav><GradeChip/></div>;
}
export function LinkCardList({ items, emptyMessage = "Nội dung đang được chuẩn bị. Em hãy quay lại sau nhé." }: { items: readonly LinkCard[]; emptyMessage?: string }) {
 if (!items.length) return <div className="flex items-center gap-4 rounded-2xl border border-dashed border-navy-soft/30 bg-warm p-6"><Image unoptimized src="/brand/mascot.webp" alt="" width={512} height={348} loading="lazy" className="h-auto w-18 shrink-0"/><p>{emptyMessage}</p></div>;
 return <>{items.some(item => item.progressKey) && <ProgressHydrator/>}<ul className="grid gap-4 md:grid-cols-2">{items.map(item => {
 const Icon = item.skill ? skillIcons[item.skill] : BookOpen;
 return <li key={item.href} className="min-w-0"><Link href={item.href} className="group flex h-full min-h-11 items-start gap-4 rounded-xl border border-navy-soft/20 bg-surface p-5 text-navy! no-underline motion-safe:transition-colors hover:border-primary hover:bg-warm sm:p-6"><span className="rounded-xl bg-warm-2 p-3 text-primary"><Icon aria-hidden="true" className="size-5"/></span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{item.label}</h2>{item.description && <p className="mt-2 text-sm leading-relaxed text-navy-soft">{item.description}</p>}{item.progressKey && <p data-progress-slug={item.progressKey} className="mt-2 text-sm font-semibold text-primary empty:hidden"/>}</div><ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary"/></Link></li>;
 })}</ul></>;
}
/** H1 plus exactly one context line (counts); extra text goes in `children`. */
export function PageTitle({ title, context, children }: { title: string; context?: string; children?: ReactNode }) {
 return <header className="space-y-1"><h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">{title}</h1>{context && <p className="text-sm font-semibold text-primary sm:text-base">{context}</p>}{children}</header>;
}
const tileClass = "group flex h-full min-h-11 flex-col gap-1 rounded-xl border border-navy-soft/20 bg-surface p-4 text-navy! no-underline! motion-safe:transition-colors hover:border-primary hover:bg-warm [&_*]:no-underline";
/** Exam tiles: only what differs between exams. The status line reserves its height so hydration never shifts layout. */
export function TestTileList({ items }: { items: readonly { label: string; meta: string; href: string; progressKey: string }[] }) {
 return <><ProgressHydrator/><ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(item => <li key={item.href} className="min-w-0"><Link href={item.href} className={tileClass}><span className="text-lg font-bold">{item.label}</span><span className="text-sm text-navy-soft">{item.meta}</span><span data-progress-slug={item.progressKey} data-progress-style="tile" className="block min-h-5 text-sm font-semibold text-primary"/></Link></li>)}</ul></>;
}
/** Set (bộ đề) cards on the skill page. */
export function SetCardList({ items }: { items: readonly { label: string; meta: string; href: string }[] }) {
 return <ul className="grid gap-3 sm:grid-cols-2">{items.map(item => <li key={item.href} className="min-w-0"><Link href={item.href} className={tileClass}><span className="text-lg font-bold">{item.label}</span><span className="text-sm text-navy-soft">{item.meta}</span></Link></li>)}</ul>;
}
export function ChipList({ items }: { items: readonly { label: string; href: string }[] }) {
 return <ul className="flex flex-wrap gap-2">{items.map(item => <li key={item.href}><Link href={item.href} className="inline-flex min-h-11 items-center rounded-full border border-navy-soft/30 bg-surface px-4 text-sm font-semibold text-primary! no-underline hover:bg-sky-soft">{item.label}</Link></li>)}</ul>;
}
export { PassageBlock } from "./PassageBlock";
export function QuestionBlock({ question, number }: { question: Question; number: number }) {
 return <fieldset id={`question-${question.id}`} className="min-w-0 rounded-xl border border-navy-soft/20 p-5"><legend className="px-2 font-bold">Câu {number}. <span lang="en">{question.stem}</span></legend><div className="space-y-3">{question.options.map(option => <label key={option.key} className="flex min-h-11 items-start gap-3 rounded-xl border border-navy-soft/20 p-3"><input type="radio" name={`question-${question.id}`} value={option.key} className="mt-1 size-5 shrink-0 accent-primary"/><span lang="en">{option.key}. {option.text}</span></label>)}</div></fieldset>;
}
