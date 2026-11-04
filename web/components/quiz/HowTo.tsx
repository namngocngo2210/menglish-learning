import { ArrowRight, Check, MousePointer2, Send } from "lucide-react";
/** The single place that explains how a practice works (collapsed; text stays in the DOM). */
export function HowTo() {
 return <details className="shrink-0 open:basis-full"><summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">Cách làm</summary><p className="flex flex-wrap items-center gap-2 pb-2 text-sm text-primary"><MousePointer2 width={16} height={16} aria-hidden="true"/>Chọn đáp án <ArrowRight width={16} height={16} aria-hidden="true"/><span className="sr-only">→</span><Check width={16} height={16} aria-hidden="true"/>Kiểm tra <ArrowRight width={16} height={16} aria-hidden="true"/><span className="sr-only">→</span><Send width={16} height={16} aria-hidden="true"/>Nộp bài</p></details>;
}
