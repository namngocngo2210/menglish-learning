"use client";
import Image from "next/image";

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleHelp, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { saveProgress } from "@/lib/progress";
import type { PoolPassage } from "@/lib/random-quiz";
import { scoreTest, scoreOutOf10 } from "@/lib/scoring";
import { buildSections, flattenSections, numberQuestions, sectionProgress, unansweredIds, type QuizQuestion } from "@/lib/quiz/sections";
import { clearQuiz, readQuiz, writeQuiz } from "@/lib/quiz/persist";
import { SectionedPractice, type FocusRequest } from "./SectionedPractice";
import { initialQuizState, quizReducer } from "./state";

export interface QuizProps {
 questions: readonly QuizQuestion[];
 passages?: readonly PoolPassage[];
 afterResult?: ReactNode;
 progressKey?: string;
 /** localStorage id for in-progress answers; defaults to progressKey. */
 storageKey?: string;
}
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

export function Quiz({ questions, passages = [], afterResult, progressKey, storageKey }: QuizProps) {
 const [state, dispatch] = useReducer(quizReducer, undefined, initialQuizState);
 const sections = useMemo(() => buildSections(questions, passages), [questions, passages]);
 const ordered = useMemo(() => flattenSections(sections), [sections]);
 const numbers = useMemo(() => numberQuestions(sections), [sections]);
 const [activeIndex, setActiveIndex] = useState(0);
 const [dialog, setDialog] = useState<"overview" | "confirm" | null>(null);
 const [focusRequest, setFocusRequest] = useState<FocusRequest>();
 const [ready, setReady] = useState(false);
 const [restored, setRestored] = useState(false);
 const resultRef = useRef<HTMLElement>(null);
 const startRef = useRef<HTMLHeadingElement>(null);
 const overviewTrigger = useRef<HTMLButtonElement>(null);
 const submitTrigger = useRef<HTMLButtonElement>(null);
 const persistId = storageKey ?? progressKey;
 const result = state.submitted ? scoreTest(ordered, state.answers) : null;
 const answered = ordered.filter(question => state.answers[question.id] !== undefined).length;
 const missing = unansweredIds(sections, state.answers);
 useEffect(() => { if (state.submitted) resultRef.current?.focus(); }, [state.submitted]);
 useEffect(() => {
  /* Restore in-progress answers after hydration so server and client markup match. */
  /* eslint-disable react-hooks/set-state-in-effect */
  const saved = persistId ? readQuiz(persistId, ordered.map(q => q.id)) : undefined;
  if (saved) {
   dispatch({ type: "hydrate", answers: saved.answers, checked: saved.checked });
   setActiveIndex(Math.min(saved.active, sections.length - 1));
   setRestored(true);
  }
  setReady(true);
  /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);
 useEffect(() => {
  if (!ready || !persistId || state.submitted) return;
  if (!Object.keys(state.answers).length) { clearQuiz(persistId); return; }
  writeQuiz(persistId, { answers: state.answers as Record<string, "A" | "B" | "C" | "D">, checked: state.checked, active: activeIndex });
 }, [ready, persistId, state.answers, state.checked, state.submitted, activeIndex]);
 function jumpTo(id: string) {
  const index = sections.findIndex(s => s.questions.some(q => q.id === id));
  if (index >= 0) setActiveIndex(index);
  setFocusRequest(previous => ({ id, nonce: (previous?.nonce ?? 0) + 1 }));
 }
 function submit() {
  if (progressKey) { const score = scoreTest(ordered, state.answers); saveProgress(progressKey, score.score, score.total); }
  if (persistId) clearQuiz(persistId);
  setDialog(null);
  dispatch({ type: "submit" });
 }
 const footer = !state.submitted && <>
  <button ref={overviewTrigger} type="button" className={secondaryClass} onClick={() => setDialog("overview")}><ListChecks aria-hidden="true" className="size-5"/>Tổng quan<span className="max-sm:hidden"> {answered}/{ordered.length}</span></button>
  <button ref={submitTrigger} type="button" className={`${buttonClass} whitespace-nowrap`} onClick={() => setDialog("confirm")}>Nộp bài</button>
 </>;
 return <section aria-labelledby="quiz-heading" className="space-y-8">
  <div className="rounded-xl border border-navy-soft/20 bg-warm p-5"><h2 id="quiz-heading" ref={startRef} tabIndex={-1} className="text-xl font-bold">Bài luyện của em</h2><p className="mt-2">Chọn đáp án rồi bấm “Kiểm tra” để xem lời giải từng câu. Câu đã kiểm tra sẽ được khóa.</p><p className="mt-2 text-sm">Đã chọn {answered}/{ordered.length} câu. Khi nộp bài, câu bỏ trống được tính là chưa đúng.</p><p role="status" aria-live="polite" className="mt-2 text-sm font-semibold text-primary">{restored && !state.submitted ? "Đã khôi phục bài làm đang dở." : ""}</p><noscript><p className="mt-4 font-semibold">Em cần bật JavaScript để kiểm tra đáp án, nộp bài và xem kết quả. Em vẫn có thể đọc bài và chọn đáp án bên dưới.</p></noscript></div>
  <SectionedPractice sections={sections} answers={state.answers} checked={state.checked} revealAll={state.submitted} activeIndex={activeIndex} onActiveChange={setActiveIndex} onSelect={(id, key) => dispatch({ type: "select", id, key })} onCheck={id => dispatch({ type: "check", id })} footer={footer} focusRequest={focusRequest}/>
  <Dialog open={dialog === "overview"} onClose={() => { setDialog(null); overviewTrigger.current?.focus(); }} labelledBy="overview-title">
   <h2 id="overview-title" className="text-xl font-bold">Tổng quan bài làm</h2>
   <p className="text-sm">Đã làm {answered}/{ordered.length} câu. Chọn một câu để quay lại làm.</p>
   {sections.map(section => <div key={section.id}><h3 className="mb-2 font-bold">{section.label} · {sectionProgress(section, state.answers).answered}/{section.questions.length} đã làm</h3><ul className="flex flex-wrap gap-2">{section.questions.map(q => { const done = state.answers[q.id] !== undefined; return <li key={q.id}><button type="button" onClick={() => { setDialog(null); jumpTo(q.id); }} className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-2 font-bold ${done ? "border-primary bg-warm text-primary" : "border-navy-soft/40 bg-surface"}`}>{done ? <CheckCircle2 aria-hidden="true" className="size-4"/> : <CircleHelp aria-hidden="true" className="size-4"/>}{numbers[q.id]}<span className="sr-only">{done ? " đã làm" : " chưa làm"}</span></button></li>; })}</ul></div>)}
   <button type="button" className={secondaryClass} onClick={() => { setDialog(null); overviewTrigger.current?.focus(); }}>Đóng</button>
  </Dialog>
  <Dialog open={dialog === "confirm"} onClose={() => { setDialog(null); submitTrigger.current?.focus(); }} labelledBy="confirm-title">
   <h2 id="confirm-title" className="text-xl font-bold">Nộp bài?</h2>
   <p>{missing.length ? `Em còn ${missing.length} câu chưa làm. Câu bỏ trống được tính là chưa đúng.` : `Em đã làm hết ${ordered.length} câu.`}</p>
   {missing.length > 0 && <ul className="list-disc pl-5 text-sm">{sections.map(section => { const p = sectionProgress(section, state.answers); return p.answered < p.total ? <li key={section.id}>{section.label}: còn {p.total - p.answered} câu</li> : null; })}</ul>}
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={secondaryClass} onClick={() => { setDialog(null); submitTrigger.current?.focus(); }}>Quay lại làm tiếp</button><button type="button" className={buttonClass} onClick={submit}>Nộp bài</button></div>
  </Dialog>
  {result && <section ref={resultRef} tabIndex={-1} aria-live="polite" aria-labelledby="result-heading" className="space-y-6 rounded-xl border border-navy-soft/20 bg-warm p-5 sm:p-8">
   <div className="flex items-center gap-4"><Image unoptimized src="/brand/mascot.webp" alt="" width={512} height={348} loading="lazy" className="h-auto w-24 shrink-0"/><div><p className="text-sm font-semibold text-primary">Đã hoàn thành bài luyện</p><h2 id="result-heading" className="mt-2 text-2xl font-bold">Kết quả của em</h2></div></div>
   <dl className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-surface p-4"><dt>Số câu đúng</dt><dd className="mt-1 text-3xl font-bold">{result.score}/{result.total}</dd></div><div className="rounded-xl bg-surface p-4"><dt>Điểm trên thang 10</dt><dd className="mt-1 text-3xl font-bold">{scoreOutOf10(result.score,result.total).toLocaleString("vi-VN",{maximumFractionDigits:1})}/10</dd></div><div className="rounded-xl bg-surface p-4"><dt>Tỷ lệ đúng</dt><dd className="mt-1 text-3xl font-bold">{result.percent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%</dd></div></dl>
   <p>Hãy xem lại lời giải để biết phần nào em cần luyện thêm.</p>
   <ul className="grid gap-2 sm:grid-cols-2">{result.perQuestion.map(item => { const Icon = !item.answered ? CircleHelp : item.correct ? CheckCircle2 : XCircle; return <li key={item.questionId}><a href={`#question-${item.questionId}`} onClick={event => { event.preventDefault(); jumpTo(item.questionId); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-navy-soft/20 bg-surface px-3 py-2"><Icon aria-hidden="true" className="size-5 shrink-0"/>Câu {numbers[item.questionId]}: {!item.answered ? "Chưa trả lời" : item.correct ? "Đúng" : "Chưa đúng"}</a></li>; })}</ul>
   <button type="button" className={buttonClass} onClick={() => { dispatch({type:"reset"}); if (persistId) clearQuiz(persistId); setActiveIndex(0); setRestored(false); startRef.current?.focus(); }}><RotateCcw aria-hidden="true" className="size-5"/>Làm lại</button>
   {afterResult && <div className="border-t border-navy-soft/20 pt-6">{afterResult}</div>}
  </section>}
 </section>;
}
export default Quiz;
