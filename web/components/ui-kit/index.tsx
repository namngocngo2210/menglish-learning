import Link from "next/link";
import type { ReactNode } from "react";
import type { Passage, Question } from "@/lib/content/types";
import { SITE } from "@/lib/site-config";
import { homePath, aboutPath, privacyPath } from "@/lib/routes";
export interface NavigationItem { label: string; href?: string; }
export interface LinkCard { label: string; href: string; description?: string; }
export function PageShell({ title, children }: { title: string; children: ReactNode }) {
 return <div className="mx-auto max-w-4xl px-5 py-6">
  <header><Link className="inline-block min-h-11 py-2 font-bold" href={homePath()}>{SITE.wordmark}</Link><p>Tên tạm · Bản nội dung mẫu</p></header>
  <main id="noi-dung" className="space-y-5 py-6"><h1 className="text-2xl font-bold">{title}</h1>{children}</main>
  <footer><nav aria-label="Thông tin"><ul className="flex flex-wrap gap-5"><li><Link className="inline-block min-h-11 py-2" href={aboutPath()}>Giới thiệu</Link></li><li><Link className="inline-block min-h-11 py-2" href={privacyPath()}>Chính sách bảo mật</Link></li></ul></nav></footer>
 </div>;
}
export function Breadcrumbs({ items }: { items: readonly NavigationItem[] }) {
 return <nav aria-label="Đường dẫn"><ol className="flex flex-wrap gap-x-3">{items.map((item, index) => <li key={index}>{item.href ? <Link className="inline-block min-h-11 py-2" href={item.href}>{item.label}</Link> : <span className="inline-block py-2" aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
export function LinkCardList({ items }: { items: readonly LinkCard[] }) {
 return <ul className="space-y-3">{items.map(item => <li key={item.href} className="rounded border border-navy-soft/20 bg-warm p-4"><Link className="inline-block min-h-11 py-2 font-semibold" href={item.href}>{item.label}</Link>{item.description && <p>{item.description}</p>}</li>)}</ul>;
}
export function PassageBlock({ passage }: { passage: Passage }) {
 return <section aria-labelledby={`passage-${passage.id}`} className="space-y-3 bg-warm-2 p-4"><h2 id={`passage-${passage.id}`} className="font-bold">{passage.title}</h2><p lang="en" className="whitespace-pre-line">{passage.body}</p><p>{passage.wordCount} từ · Bài đọc mẫu tự soạn</p></section>;
}
export function QuestionBlock({ question, number }: { question: Question; number: number }) {
 return <section aria-labelledby={`question-${question.id}`} className="space-y-3 border-b border-navy-soft/20 py-5">
  <h2 id={`question-${question.id}`} className="font-semibold">Câu {number}. <span lang="en">{question.stem}</span></h2>
  <ul lang="en">{question.options.map(option => <li key={option.key}>{option.key}. {option.text}</li>)}</ul>
  <p><strong>Đáp án: {question.correctKey}.</strong> {question.explanation}</p>
 </section>;
}
