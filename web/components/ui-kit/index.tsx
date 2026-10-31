import Link from "next/link";
import { ArrowUpRight, BookOpen, ChevronRight, Languages, LibraryBig, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import type { Passage, Question } from "@/lib/content/types";
import { SITE } from "@/lib/site-config";
import { GRADES, homePath, aboutPath, privacyPath, gradePath, type Skill } from "@/lib/routes";

export interface NavigationItem { label: string; href?: string; }
export interface LinkCard { label: string; href: string; description?: string; skill?: Skill; }
export const SKILL_DESCRIPTIONS: Record<Skill, string> = {
 "doc-hieu": "Đọc bài, tìm thông tin và hiểu ý nghĩa trong ngữ cảnh.",
 "ngu-phap": "Ôn cấu trúc và chọn cách dùng câu phù hợp.",
 "tu-vung": "Nhận biết nghĩa từ và cách dùng trong từng chủ đề.",
 "viet-cau": "Luyện sắp xếp ý và diễn đạt thành câu rõ ràng.",
};
const skillIcons = { "doc-hieu": BookOpen, "ngu-phap": LibraryBig, "tu-vung": Languages, "viet-cau": PenLine };

export function PageShell({ title, children, hero }: { title: string; children: ReactNode; hero?: ReactNode }) {
 return <div className="flex min-h-screen flex-col">
  <a href="#noi-dung" className="sr-only z-50 rounded-md bg-surface p-3 font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Chuyển đến nội dung</a>
  <header className="border-t-4 border-t-navy border-b border-b-navy-soft/20 bg-surface">
   <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
    <div><div className="flex flex-wrap items-center gap-x-3"><Link href={homePath()} className="flex min-h-11 items-center gap-2 font-bold text-navy! no-underline"><BookOpen aria-hidden="true" className="size-6 shrink-0 text-primary"/>{SITE.wordmark}</Link><span className="rounded-md border border-primary/30 bg-warm px-2 py-1 text-xs font-semibold text-primary">Tên tạm</span></div><p className="text-sm text-navy-soft">Dành cho học sinh THCS · Không cần đăng nhập</p></div>
    <nav aria-label="Chọn lớp"><ul className="flex flex-wrap gap-2">{GRADES.map(grade => <li key={grade}><Link className="flex min-h-11 items-center rounded-md border border-navy-soft/20 px-4 font-semibold text-navy! no-underline motion-safe:transition-colors hover:bg-warm" href={gradePath(grade)}>Lớp {grade}</Link></li>)}</ul></nav>
   </div>
  </header>
  <main id="noi-dung" tabIndex={-1} className="flex-1 outline-none">
   {hero ?? <div className="border-b border-navy-soft/10 bg-warm"><div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12"><p className="mb-3 text-sm font-semibold text-primary">Góc luyện tập tiếng Anh</p><h1 className="max-w-3xl text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{title}</h1></div></div>}
   <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-12">{children}</div>
  </main>
  <footer className="bg-navy text-surface"><div className="mx-auto grid max-w-6xl gap-5 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto]"><div><Link href={homePath()} className="inline-flex min-h-11 items-center font-bold text-surface! no-underline">{SITE.wordmark}</Link><p className="max-w-xl text-sm">Nội dung mẫu tự soạn, chưa phải tài liệu học tập chính thức</p></div><nav aria-label="Thông tin"><ul className="flex flex-wrap gap-x-6"><li><Link className="inline-flex min-h-11 items-center text-surface!" href={aboutPath()}>Giới thiệu</Link></li><li><Link className="inline-flex min-h-11 items-center text-surface!" href={privacyPath()}>Chính sách bảo mật</Link></li></ul></nav></div></footer>
 </div>;
}
export function Breadcrumbs({ items }: { items: readonly NavigationItem[] }) {
 return <nav aria-label="Đường dẫn"><ol className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">{items.map((item, index) => <li key={index} className="flex min-w-0 max-w-full items-center gap-2">{index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-navy-soft"/>}{item.href && index < items.length - 1 ? <Link className="inline-flex min-h-11 min-w-0 items-center py-2" href={item.href}><span className="truncate">{item.label}</span></Link> : <span className="min-w-0 truncate py-2 font-medium" aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
export function LinkCardList({ items, emptyMessage = "Nội dung đang được chuẩn bị. Em hãy quay lại sau nhé." }: { items: readonly LinkCard[]; emptyMessage?: string }) {
 if (!items.length) return <p className="rounded-md border border-dashed border-navy-soft/30 bg-warm p-6">{emptyMessage}</p>;
 return <ul className="grid gap-4 md:grid-cols-2">{items.map(item => {
 const Icon = item.skill ? skillIcons[item.skill] : BookOpen;
 return <li key={item.href} className="min-w-0"><Link href={item.href} className="group flex h-full min-h-11 items-start gap-4 rounded-md border border-navy-soft/20 bg-surface p-5 text-navy! no-underline motion-safe:transition-colors hover:border-primary hover:bg-warm sm:p-6"><span className="rounded-md bg-warm-2 p-3 text-primary"><Icon aria-hidden="true" className="size-5"/></span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{item.label}</h2>{item.description && <p className="mt-2 text-sm leading-relaxed text-navy-soft">{item.description}</p>}</div><ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary"/></Link></li>;
 })}</ul>;
}
export function PassageBlock({ passage }: { passage: Passage }) {
 return <section aria-labelledby={`passage-${passage.id}`} className="rounded-md border border-navy-soft/20 bg-warm p-5 sm:p-7"><p className="mb-3 text-sm font-semibold text-primary">Bài đọc · {passage.wordCount} từ</p><div lang="en"><h2 id={`passage-${passage.id}`} className="mb-5 text-xl font-bold">{passage.title}</h2><p className="max-w-prose whitespace-pre-line leading-8">{passage.body}</p></div><p className="mt-6 border-t border-navy-soft/20 pt-4 text-sm">Bài đọc mẫu tự soạn</p></section>;
}
export function QuestionBlock({ question, number }: { question: Question; number: number }) {
 return <fieldset id={`question-${question.id}`} className="min-w-0 rounded-md border border-navy-soft/20 p-5"><legend className="px-2 font-bold">Câu {number}. <span lang="en">{question.stem}</span></legend><div className="space-y-3">{question.options.map(option => <label key={option.key} className="flex min-h-11 items-start gap-3 rounded-md border border-navy-soft/20 p-3"><input type="radio" name={`question-${question.id}`} value={option.key} className="mt-1 size-5 shrink-0 accent-primary"/><span lang="en">{option.key}. {option.text}</span></label>)}</div></fieldset>;
}
