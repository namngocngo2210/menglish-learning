import type { Passage } from "@/lib/content/types";

export function PassageBlock({ passage }: { passage: Passage }) {
 return <section aria-labelledby={`passage-${passage.id}`} className="rounded-md border border-navy-soft/20 bg-warm p-5 sm:p-7"><p className="mb-3 text-sm font-semibold text-primary">Bài đọc · {passage.wordCount} từ</p><div lang="en"><h2 id={`passage-${passage.id}`} className="mb-5 text-xl font-bold">{passage.title}</h2><p className="max-w-prose whitespace-pre-line leading-8">{passage.body}</p></div><p className="mt-6 border-t border-navy-soft/20 pt-4 text-sm">Bài đọc mẫu tự soạn</p></section>;
}
