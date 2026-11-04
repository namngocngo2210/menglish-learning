"use client";
import { Mascot } from "@/components/art/Mascot";
import { ScoreRing, ResultStars } from "./ScoreRing";
import { checkedStreak } from "@/lib/quiz/streak";
import { resultPose, starCount } from "@/lib/quiz/result-visual";

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleHelp, Flame, Ellipsis, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { saveProgress } from "@/lib/progress";
import type { PoolPassage } from "@/lib/random-quiz";
import { scoreTest, scoreOutOf10 } from "@/lib/scoring";
import { buildSections, flattenSections, numberQuestions, unansweredIds, type QuizQuestion } from "@/lib/quiz/sections";
import { clearQuiz, readQuiz, writeQuiz } from "@/lib/quiz/persist";
import { SectionedPractice, type FocusRequest } from "./SectionedPractice";
import { initialQuizState, quizReducer } from "./state";
import { RandomTrigger } from "./random-context";
import { HowTo } from "./HowTo";
import dynamic from "next/dynamic";
const QuizDialogs = dynamic(() => import("./QuizDialogs"), { ssr: false });

export interface QuizProps {
 questions: readonly QuizQuestion[];
 passages?: readonly PoolPassage[];
 afterResult?: ReactNode;
 progressKey?: string;
 /** localStorage id for in-progress answers; defaults to progressKey. */
 storageKey?: string;
 /** Extra items for the ⋯ menu (e.g. a link to create a room from this exam). */
 menu?: ReactNode;
 /** Context line (counts, previous score) shown beside "Cách làm". */
 lead?: ReactNode;
}
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 font-bold text-navy motion-safe:transition-colors hover:bg-cta-hover disabled:bg-navy-soft disabled:text-surface";
const secondaryClass = "inline-flex whitespace-nowrap min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-surface px-4 py-2 font-bold text-primary motion-safe:transition-colors hover:bg-sky-soft";


export function Quiz({ questions, passages = [], afterResult, progressKey, storageKey, menu, lead }: QuizProps) {
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
 const streak = checkedStreak(ordered, state.answers, state.checked);
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
 const closeMenu = (event: { currentTarget: Element }) => event.currentTarget.closest("details")?.removeAttribute("open");
 // Sticky compact header: progress, overview, submit and a ⋯ menu (room link / random exam).
 const bar = !state.submitted && <div data-js-only="" className="pb-1">
  <div className="flex items-center gap-2">
   <div className="min-w-0 flex-1"><div className="flex min-h-8 flex-wrap items-center gap-1"><b className="text-sm">{answered}/{ordered.length} câu</b>{streak >= 2 && <span aria-label={`Chuỗi đúng liên tiếp: ${streak}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-1 font-bold text-primary"><Flame width={18} height={18} aria-hidden="true"/>{streak}</span>}</div><div role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={ordered.length} aria-valuenow={answered} className="mt-1 h-1.5 overflow-hidden rounded-full bg-sky-soft"><div className="h-full bg-primary" style={{ width: `${ordered.length ? answered / ordered.length * 100 : 0}%` }}/></div></div>

   <button ref={overviewTrigger} type="button" className={`${secondaryClass} max-sm:px-3`} onClick={() => setDialog("overview")}><ListChecks aria-hidden="true" className="size-5 max-sm:hidden"/>Tổng quan</button>
   <button ref={submitTrigger} type="button" className={`${buttonClass} whitespace-nowrap max-sm:px-3`} onClick={() => setDialog("confirm")}>Nộp bài</button>
   <details className="relative"><summary aria-label="Thêm tùy chọn" className={`${secondaryClass} min-w-11 cursor-pointer list-none px-0 [&::-webkit-details-marker]:hidden`}><Ellipsis aria-hidden="true" className="size-5"/></summary>
    <div onClick={closeMenu} className="absolute right-0 z-30 mt-2 flex w-56 flex-col rounded-xl border border-navy-soft/20 bg-surface p-1 shadow-lg [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-lg [&_a]:px-3 [&_a]:no-underline [&_button]:flex [&_button]:min-h-11 [&_button]:items-center [&_button]:rounded-lg [&_button]:px-3 [&_button]:text-left [&_button]:font-semibold [&_button]:text-primary hover:[&_a]:bg-warm hover:[&_button]:bg-warm">{menu}<RandomTrigger className=""/></div>
   </details>
  </div>
 </div>;
 return <section aria-labelledby="quiz-heading" className="space-y-4">
  <h2 id="quiz-heading" ref={startRef} tabIndex={-1} className="sr-only">Bài làm</h2>
  {lead && <div className="flex flex-wrap items-center gap-x-4"><div className="min-w-0 flex-1">{lead}</div><HowTo/></div>}
  <p role="status" aria-live="polite" className="text-sm font-semibold text-primary empty:hidden">{restored && !state.submitted ? "Đã khôi phục bài làm đang dở." : ""}</p>
  <noscript><p className="font-semibold">Em cần bật JavaScript để kiểm tra đáp án, nộp bài và xem kết quả. Em vẫn có thể đọc bài và chọn đáp án bên dưới.</p></noscript>
  <SectionedPractice header={bar} sections={sections} answers={state.answers} checked={state.checked} revealAll={state.submitted} activeIndex={activeIndex} onActiveChange={setActiveIndex} onSelect={(id, key) => dispatch({ type: "select", id, key })} onCheck={id => dispatch({ type: "check", id })} focusRequest={focusRequest} compactHeading/>
  {dialog && <QuizDialogs dialog={dialog} sections={sections} answers={state.answers} numbers={numbers} total={ordered.length} answered={answered} missing={missing} onClose={() => setDialog(null)} onJump={jumpTo} onSubmit={submit} overviewTrigger={overviewTrigger} submitTrigger={submitTrigger}/>}
  {result && <section ref={resultRef} tabIndex={-1} aria-live="polite" aria-labelledby="result-heading" className="relative isolate overflow-hidden space-y-6 rounded-xl border border-navy-soft/20 bg-warm p-5 sm:p-8">
   {starCount(result.percent) >= 2 && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">{Array.from({ length: 10 }, (_, i) => <span key={i} className={`result-confetti absolute top-0 h-3 w-2 rounded-sm ${i % 2 ? "bg-primary" : "bg-cta"}`} style={{ left: `${5 + i * 10}%`, animationDelay: `${i * 60}ms` }}/>)}</div>}
   <div className="flex flex-wrap items-center justify-center gap-5 sm:justify-start">
    <ScoreRing score={result.score} total={result.total} percent={result.percent}/>
    <div className="flex items-center gap-3"><Mascot pose={resultPose(result.percent)} size={96}/><div><ResultStars percent={result.percent}/><h2 id="result-heading" className="mt-2 text-2xl font-bold">Kết quả của em</h2><p className="mt-1">{result.percent >= 60 ? "Giỏi lắm! Cùng xem lại lời giải nhé." : "Cùng xem lời giải, rồi thử lại nhé!"}</p></div></div>
   </div>
   <dl className="sr-only"><dt>Số câu đúng</dt><dd>{result.score}/{result.total}</dd><dt>Điểm trên thang 10</dt><dd>{scoreOutOf10(result.score,result.total).toLocaleString("vi-VN",{maximumFractionDigits:1})}/10</dd><dt>Tỷ lệ đúng</dt><dd>{result.percent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%</dd></dl>
   <ul className="grid gap-2 sm:grid-cols-2">{result.perQuestion.map(item => { const Icon = !item.answered ? CircleHelp : item.correct ? CheckCircle2 : XCircle; return <li key={item.questionId}><a href={`#question-${item.questionId}`} onClick={event => { event.preventDefault(); jumpTo(item.questionId); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-navy-soft/20 bg-surface px-3 py-2"><Icon aria-hidden="true" className="size-5 shrink-0"/>Câu {numbers[item.questionId]}: {!item.answered ? "Chưa trả lời" : item.correct ? "Đúng" : "Chưa đúng"}</a></li>; })}</ul>
   <button type="button" className={buttonClass} onClick={() => { dispatch({type:"reset"}); if (persistId) clearQuiz(persistId); setActiveIndex(0); setRestored(false); startRef.current?.focus(); }}><RotateCcw aria-hidden="true" className="size-5"/>Làm lại</button>
   {afterResult && <div className="border-t border-navy-soft/20 pt-6">{afterResult}</div>}
  </section>}
 </section>;
}
export default Quiz;
