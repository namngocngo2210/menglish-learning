"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, XCircle } from "lucide-react";
import { numberQuestions, sectionProgress, type Answers, type DisplayQuestion, type QuizQuestion, type QuizSection } from "@/lib/quiz/sections";
import type { OptionKey } from "@/lib/content/types";

export interface FocusRequest { id: string; nonce: number }
export interface SectionedPracticeProps {
 sections: readonly QuizSection<DisplayQuestion>[];
 answers: Answers;
 checked: Record<string, boolean>;
 /** Reveal every explanation and lock all answers (results / review mode). */
 revealAll?: boolean;
 /** "none" hides the Kiểm tra button and explanations (e.g. live group rooms). */
 feedback?: "per-question" | "none";
 activeIndex: number;
 onActiveChange: (index: number) => void;
 onSelect: (questionId: string, key: OptionKey) => void;
 onCheck?: (questionId: string) => void;
 /** Extra actions rendered in the control bar (overview, submit). */
 footer?: ReactNode;
 /** Ask the layout to scroll to and focus a question (activate its section first). */
 focusRequest?: FocusRequest;
}
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-primary bg-surface px-4 py-2 font-bold text-primary motion-safe:transition-colors hover:bg-sky-soft disabled:border-navy-soft/30 disabled:text-navy-soft/60";
const ctaClass = "inline-flex w-full sm:w-auto min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 font-bold text-navy motion-safe:transition-colors hover:bg-cta-hover disabled:bg-navy-soft disabled:text-surface";
const paneClass = "min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-auto lg:[scrollbar-gutter:stable]";
function behavior(): ScrollBehavior { return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; }
function jump(id: string, block: ScrollLogicalPosition) {
 const el = document.getElementById(id);
 if (!el) return;
 el.scrollIntoView?.({ block, behavior: behavior() });
 el.focus({ preventScroll: true });
}

/** Only fully graded questions can show feedback; room questions never carry these fields. */
const isGraded = (q: DisplayQuestion): q is QuizQuestion => "correctKey" in q;
function QuestionCard({ question, number, selected, revealed, feedback, onSelect, onCheck }: { question: DisplayQuestion; number: number; selected: OptionKey | undefined; revealed: boolean; feedback: boolean; onSelect: SectionedPracticeProps["onSelect"]; onCheck?: SectionedPracticeProps["onCheck"] }) {
 const graded = feedback && isGraded(question) ? question : null;
 const correct = graded ? selected === graded.correctKey : false;
 const FeedbackIcon = !selected ? CircleHelp : correct ? CheckCircle2 : XCircle;
 return <section id={`question-${question.id}`} tabIndex={-1} aria-label={`Câu ${number}`} className="scroll-mt-4 rounded-xl border border-navy-soft/20 bg-surface p-5 sm:p-6">
  <fieldset disabled={revealed} className="min-w-0" aria-describedby={revealed && graded ? `feedback-${question.id}` : undefined}>
   <legend className="mb-5 w-full font-bold"><span className="mb-2 block text-sm text-primary">Câu {number}</span><span lang="en">{question.stem}</span></legend>
   <div className="space-y-3">{question.options.map(option => <label key={option.key} className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 ${selected === option.key ? "border-primary bg-warm" : "border-navy-soft/30"}`}><input className="mt-1 size-5 shrink-0 accent-primary" type="radio" name={`quiz-${question.id}`} value={option.key} checked={selected === option.key} onChange={() => onSelect(question.id, option.key)}/><span lang="en">{option.key}. {option.text}</span></label>)}</div>
  </fieldset>
  {graded && !revealed && <button type="button" disabled={!selected} onClick={() => { onCheck?.(question.id); requestAnimationFrame(() => document.getElementById(`feedback-${question.id}`)?.focus()); }} className={`${ctaClass} mt-5`}>Kiểm tra<span className="sr-only"> câu {number}</span></button>}
  {graded && <div id={`feedback-${question.id}`} tabIndex={-1} aria-live="polite" aria-atomic="true">{revealed && <div className="mt-5 space-y-3 rounded-xl border border-navy-soft/20 bg-warm p-4"><p className="flex items-center gap-2 font-bold"><FeedbackIcon aria-hidden="true" className="size-5 shrink-0 text-primary"/>{!selected ? "Em chưa chọn đáp án." : correct ? "Chính xác!" : "Chưa đúng. Em hãy xem lời giải nhé."}</p><p className="font-semibold">Đáp án đúng: {graded.correctKey}.</p><p>{graded.explanation}</p></div>}</div>}
 </section>;
}

/**
 * Presentational, controlled layout: one section (passage + its questions) at a time.
 * Server markup contains every section; inactive ones are hidden by CSS only, and the
 * <noscript> style stacks them again for visitors without JavaScript.
 */
export function SectionedPractice({ sections, answers, checked, revealAll = false, feedback = "per-question", activeIndex, onActiveChange, onSelect, onCheck, footer, focusRequest }: SectionedPracticeProps) {
 const numbers = numberQuestions(sections);
 const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
 const active = sections[activeIndex] ?? sections[0];
 const last = activeIndex >= sections.length - 1;
 useEffect(() => { if (focusRequest) requestAnimationFrame(() => jump(`question-${focusRequest.id}`, "center")); }, [focusRequest]);
 function goTo(index: number) {
  onActiveChange(index);
  requestAnimationFrame(() => {
   // Bring the navigator to the top so navigator + panes + control bar fit the viewport.
   document.getElementById("quiz-nav")?.scrollIntoView?.({ block: "start", behavior: behavior() });
   document.getElementById(`${sections[index]?.id}-heading`)?.focus({ preventScroll: true });
  });
 }
 function showPassage() {
  if (!active?.passage) return;
  setCollapsed(c => ({ ...c, [active.id]: false }));
  requestAnimationFrame(() => jump(`passage-pane-${active.passage!.id}`, "start"));
 }
 function nextUnanswered() {
  const q = active?.questions.find(item => answers[item.id] === undefined);
  if (q) jump(`question-${q.id}`, "center");
 }
 const activeProgress = active ? sectionProgress(active, answers) : { answered: 0, total: 0 };
 const allDone = activeProgress.answered === activeProgress.total;
 return <div data-quiz-sections className="space-y-4">
  <noscript><style>{"[data-inactive]{display:block!important}[data-js-only]{display:none!important}"}</style></noscript>
  <nav id="quiz-nav" aria-label="Các phần của bài" className="scroll-mt-2">
   <ol className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible">{sections.map((section, index) => {
    const progress = sectionProgress(section, answers);
    return <li key={section.id} className="shrink-0"><a href={`#${section.id}-heading`} aria-current={index === activeIndex ? "step" : undefined} onClick={event => { event.preventDefault(); goTo(index); }} className={`flex min-h-11 flex-col justify-center rounded-xl border px-4 py-1 leading-tight no-underline! motion-safe:transition-colors ${index === activeIndex ? "border-primary bg-primary text-surface!" : "border-navy-soft/30 bg-surface text-navy! hover:bg-warm"}`}><span className="font-bold">{section.label}</span><span className="text-sm">{progress.answered}/{progress.total} đã làm</span></a></li>;
   })}</ol>
  </nav>
  {sections.map((section, index) => {
   const passage = section.passage;
   const isCollapsed = Boolean(collapsed[section.id]);
   return <section key={section.id} id={section.id} data-inactive={index === activeIndex ? undefined : "true"} aria-labelledby={`${section.id}-heading`} className="scroll-mt-4 data-inactive:hidden">
    <h3 id={`${section.id}-heading`} tabIndex={-1} className="mb-3 scroll-mt-4 text-lg font-bold">{section.label}{passage ? <> · <span lang="en">{passage.title}</span></> : null}</h3>
    <div className={passage ? "space-y-4 lg:grid lg:h-[calc(100dvh-17rem)] lg:min-h-[28rem] lg:grid-cols-2 lg:gap-6 lg:space-y-0" : "mx-auto max-w-3xl"}>
     {passage && <section id={`passage-pane-${passage.id}`} aria-labelledby={`passage-${passage.id}`} tabIndex={0} className={`${paneClass} border border-navy-soft/20 bg-warm`}>
      <div className="flex items-center justify-between gap-3 border-b border-navy-soft/20 bg-warm p-4 lg:sticky lg:top-0 lg:z-10 lg:px-6">
       <div lang="en" className="min-w-0"><h4 tabIndex={-1} id={`passage-${passage.id}`} className="scroll-mt-4 text-xl font-bold max-lg:sr-only">{passage.title}</h4><p lang="vi" className="text-sm font-semibold text-primary">Bài đọc · {passage.wordCount} từ</p></div>
       <button type="button" data-js-only="" aria-expanded={!isCollapsed} aria-controls={`passage-body-${passage.id}`} onClick={() => setCollapsed(c => ({ ...c, [section.id]: !isCollapsed }))} className={`${buttonClass} shrink-0 lg:hidden`}>{isCollapsed ? "Xem bài đọc" : "Ẩn bài đọc"}</button>
      </div>
      <div id={`passage-body-${passage.id}`} lang="en" className={`p-4 lg:px-6 ${isCollapsed ? "max-lg:hidden" : ""}`}><p className="max-w-prose whitespace-pre-line leading-8">{passage.body}</p></div>
     </section>}
     <section aria-label={passage ? `Câu hỏi của ${section.label}` : `Câu hỏi: ${section.label}`} tabIndex={0} className={`${paneClass} space-y-6 lg:p-1 lg:pr-3`}>
      {section.questions.map(question => <QuestionCard key={question.id} question={question} number={numbers[question.id]} selected={answers[question.id]} revealed={revealAll || Boolean(checked[question.id])} feedback={feedback === "per-question"} onSelect={onSelect} onCheck={onCheck}/>)}
     </section>
    </div>
   </section>;
  })}
  <div data-js-only="" className="sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-navy-soft/20 bg-surface/95 px-4 py-3 sm:mx-0 sm:rounded-xl sm:border">
   <div className="flex items-center gap-2 max-sm:[&_button]:px-3">
    <button type="button" className={buttonClass} disabled={activeIndex <= 0} onClick={() => goTo(activeIndex - 1)}><ChevronLeft aria-hidden="true" className="size-5"/><span className="max-sm:sr-only">Phần trước</span></button>
    {footer}
    <button type="button" className={`${buttonClass} sm:ml-auto`} disabled={last} onClick={() => goTo(activeIndex + 1)}><span className="max-sm:sr-only">Phần sau</span><ChevronRight aria-hidden="true" className="size-5"/></button>
   </div>
   <div className="flex items-center gap-2 text-sm lg:hidden [&_button]:px-3 [&_button]:text-sm">
    {active?.passage && <button type="button" className={buttonClass} onClick={showPassage}>Xem bài đọc</button>}
    <button type="button" className={buttonClass} disabled={allDone} onClick={nextUnanswered}>{allDone ? "Đã làm hết phần này" : "Câu chưa làm tiếp"}</button>
    <span className="ml-auto text-sm font-semibold" aria-live="polite">{activeProgress.answered}/{activeProgress.total}</span>
   </div>
  </div>
 </div>;
}
export default SectionedPractice;
