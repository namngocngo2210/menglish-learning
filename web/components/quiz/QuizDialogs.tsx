"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, CircleHelp } from "lucide-react";
import { sectionProgress, type QuizSection, type Answers, type QuizQuestion } from "@/lib/quiz/sections";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 font-bold text-navy motion-safe:transition-colors hover:bg-cta-hover disabled:bg-navy-soft disabled:text-surface";
const secondaryClass = "inline-flex whitespace-nowrap min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-surface px-4 py-2 font-bold text-primary motion-safe:transition-colors hover:bg-sky-soft";

function Dialog({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (open && !dialog.open) { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
  if (!open && dialog.open) { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }
 }, [open]);
 return <dialog ref={ref} aria-labelledby={labelledBy} onClose={onClose} onClick={event => { if (event.target === ref.current) onClose(); }} className="m-auto max-h-[90dvh] w-[min(92vw,36rem)] overflow-y-auto rounded-xl border border-navy-soft/30 bg-surface p-0 text-navy backdrop:bg-navy/50">
  {open && <div className="space-y-4 p-5 sm:p-6">{children}</div>}
 </dialog>;
}

/** Overview and submit-confirm dialogs; loaded on first open so they stay out of the initial JS. */
export default function QuizDialogs({ dialog, sections, answers, numbers, total, answered, missing, onClose, onJump, onSubmit, overviewTrigger, submitTrigger }: {
 dialog: "overview" | "confirm"; sections: readonly QuizSection<QuizQuestion>[]; answers: Answers; numbers: Record<string, number>; total: number; answered: number; missing: readonly string[];
 onClose: () => void; onJump: (id: string) => void; onSubmit: () => void;
 overviewTrigger: React.RefObject<HTMLButtonElement | null>; submitTrigger: React.RefObject<HTMLButtonElement | null>;
}) {
 return <>
  <Dialog open={dialog === "overview"} onClose={() => { onClose(); overviewTrigger.current?.focus(); }} labelledBy="overview-title">
   <h2 id="overview-title" className="text-xl font-bold">Tổng quan bài làm</h2>
   <p className="text-sm">Đã làm {answered}/{total} câu. Chọn một câu để quay lại làm.</p>
   {sections.map(section => <div key={section.id}><h3 className="mb-2 font-bold">{section.label} · {sectionProgress(section, answers).answered}/{section.questions.length} đã làm</h3><ul className="flex flex-wrap gap-2">{section.questions.map(q => { const done = answers[q.id] !== undefined; return <li key={q.id}><button type="button" onClick={() => { onClose(); onJump(q.id); }} className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-2 font-bold ${done ? "border-primary bg-warm text-primary" : "border-navy-soft/40 bg-surface"}`}>{done ? <CheckCircle2 aria-hidden="true" className="size-4"/> : <CircleHelp aria-hidden="true" className="size-4"/>}{numbers[q.id]}<span className="sr-only">{done ? " đã làm" : " chưa làm"}</span></button></li>; })}</ul></div>)}
   <button type="button" className={secondaryClass} onClick={() => { onClose(); overviewTrigger.current?.focus(); }}>Đóng</button>
  </Dialog>
  <Dialog open={dialog === "confirm"} onClose={() => { onClose(); submitTrigger.current?.focus(); }} labelledBy="confirm-title">
   <h2 id="confirm-title" className="text-xl font-bold">Nộp bài?</h2>
   <p>{missing.length ? `Em còn ${missing.length} câu chưa làm. Câu bỏ trống được tính là chưa đúng.` : `Em đã làm hết ${total} câu.`}</p>
   {missing.length > 0 && <ul className="list-disc pl-5 text-sm">{sections.map(section => { const p = sectionProgress(section, answers); return p.answered < p.total ? <li key={section.id}>{section.label}: còn {p.total - p.answered} câu</li> : null; })}</ul>}
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={secondaryClass} onClick={() => { onClose(); submitTrigger.current?.focus(); }}>Quay lại làm tiếp</button><button type="button" className={buttonClass} onClick={onSubmit}>Nộp bài</button></div>
  </Dialog>
 </>;
}
