"use client";

import { useEffect, useReducer, useRef, type ReactNode } from "react";
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from "lucide-react";
import type { Passage, Question } from "@/lib/content/types";
import { scoreTest, scoreOutOf10 } from "@/lib/scoring";
import { PassageBlock } from "@/components/ui-kit";
import { initialQuizState, quizReducer } from "./state";

type QuizQuestion = Pick<Question, "id" | "stem" | "options" | "correctKey" | "explanation">;
export interface QuizProps {
 questions: readonly QuizQuestion[];
 passages?: readonly Passage[];
 passageContent?: ReactNode;
 afterResult?: ReactNode;
}
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cta px-5 py-3 font-semibold text-white motion-safe:transition-colors hover:bg-primary disabled:bg-navy-soft disabled:text-surface";
export function Quiz({ questions, passages = [], passageContent, afterResult }: QuizProps) {
 const [state, dispatch] = useReducer(quizReducer, undefined, initialQuizState);
 const resultRef = useRef<HTMLElement>(null);
 const startRef = useRef<HTMLHeadingElement>(null);
 const result = state.submitted ? scoreTest(questions, state.answers) : null;
 const answered = questions.filter(question => state.answers[question.id] !== undefined).length;
 const hasPassages = Boolean(passageContent) || passages.length > 0;
 useEffect(() => { if (state.submitted) resultRef.current?.focus(); }, [state.submitted]);
 return <section aria-labelledby="quiz-heading" className="space-y-8">
  <div className="rounded-md border border-navy-soft/20 bg-warm p-5"><h2 id="quiz-heading" ref={startRef} tabIndex={-1} className="text-xl font-bold">Bài luyện của em</h2><p className="mt-2">Chọn đáp án rồi bấm “Kiểm tra” để xem lời giải từng câu. Câu đã kiểm tra sẽ được khóa.</p><p className="mt-2 text-sm">Đã chọn {answered}/{questions.length} câu. Khi nộp bài, câu bỏ trống được tính là chưa đúng.</p><noscript><p className="mt-4 font-semibold">Em cần bật JavaScript để kiểm tra đáp án, nộp bài và xem kết quả. Em vẫn có thể đọc bài và chọn đáp án bên dưới.</p></noscript></div>
  <div className={hasPassages ? "grid items-start gap-8 lg:grid-cols-2" : "mx-auto max-w-3xl"}>
   {hasPassages && <div className="min-w-0 space-y-5 lg:sticky lg:top-6">{passageContent ?? passages.map(passage => <PassageBlock key={passage.id} passage={passage}/>)}</div>}
   <div className="min-w-0 space-y-6">{questions.map((question,index) => {
    const revealed = Boolean(state.checked[question.id] || state.submitted);
    const selected = state.answers[question.id];
    const correct = selected === question.correctKey;
    const FeedbackIcon = !selected ? CircleHelp : correct ? CheckCircle2 : XCircle;
    return <section key={question.id} id={`question-${question.id}`} tabIndex={-1} aria-label={`Câu ${index+1}`} className="rounded-md border border-navy-soft/20 bg-surface p-5 sm:p-6">
     <fieldset disabled={revealed} className="min-w-0" aria-describedby={revealed ? `feedback-${question.id}` : undefined}>
      <legend className="mb-5 w-full font-bold"><span className="mb-2 block text-sm text-primary">Câu {index+1}</span><span lang="en">{question.stem}</span></legend>
      <div className="space-y-3">{question.options.map(option => <label key={option.key} className={`flex min-h-11 items-start gap-3 rounded-md border p-3 ${selected === option.key ? "border-primary bg-warm" : "border-navy-soft/30"}`}><input className="mt-1 size-5 shrink-0 accent-primary" type="radio" name={`quiz-${question.id}`} value={option.key} checked={selected === option.key} onChange={() => dispatch({type:"select",id:question.id,key:option.key})}/><span lang="en">{option.key}. {option.text}</span></label>)}</div>
     </fieldset>
     {!revealed && <button type="button" disabled={!selected} onClick={() => dispatch({type:"check",id:question.id})} className={`${buttonClass} mt-5`}>Kiểm tra<span className="sr-only"> câu {index+1}</span></button>}
     <div id={`feedback-${question.id}`} aria-live="polite" aria-atomic="true">{revealed && <div className="mt-5 space-y-3 rounded-md border border-navy-soft/20 bg-warm p-4"><p className="flex items-center gap-2 font-bold"><FeedbackIcon aria-hidden="true" className="size-5 shrink-0 text-primary"/>{!selected ? "Em chưa chọn đáp án." : correct ? "Chính xác!" : "Chưa đúng. Em hãy xem lời giải nhé."}</p><p className="font-semibold">Đáp án đúng: {question.correctKey}.</p><p>{question.explanation}</p></div>}</div>
    </section>;
   })}
   {!state.submitted && <div className="space-y-3 border-t border-navy-soft/20 pt-6"><button type="button" className={`${buttonClass} w-full sm:w-auto`} onClick={() => dispatch({type:"submit"})}>Nộp bài</button><p className="text-sm text-navy-soft">Nộp bài để xem điểm và lời giải. Kết quả chỉ hiển thị trong lần luyện này.</p></div>}
   </div>
  </div>
  {result && <section ref={resultRef} tabIndex={-1} aria-labelledby="result-heading" className="space-y-6 rounded-md border border-navy-soft/20 bg-warm p-5 sm:p-8">
   <div><p className="text-sm font-semibold text-primary">Đã hoàn thành bài luyện</p><h2 id="result-heading" className="mt-2 text-2xl font-bold">Kết quả của em</h2></div>
   <dl className="grid gap-4 sm:grid-cols-3"><div className="rounded-md bg-surface p-4"><dt>Số câu đúng</dt><dd className="mt-1 text-3xl font-bold">{result.score}/{result.total}</dd></div><div className="rounded-md bg-surface p-4"><dt>Điểm trên thang 10</dt><dd className="mt-1 text-3xl font-bold">{scoreOutOf10(result.score,result.total).toLocaleString("vi-VN",{maximumFractionDigits:1})}/10</dd></div><div className="rounded-md bg-surface p-4"><dt>Tỷ lệ đúng</dt><dd className="mt-1 text-3xl font-bold">{result.percent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%</dd></div></dl>
   <p>Hãy xem lại lời giải để biết phần nào em cần luyện thêm.</p>
   <ul className="grid gap-2 sm:grid-cols-2">{result.perQuestion.map((item,index) => { const Icon = !item.answered ? CircleHelp : item.correct ? CheckCircle2 : XCircle; return <li key={item.questionId}><a href={`#question-${item.questionId}`} className="flex min-h-11 items-center gap-2 rounded-md border border-navy-soft/20 bg-surface px-3 py-2"><Icon aria-hidden="true" className="size-5 shrink-0"/>Câu {index+1}: {!item.answered ? "Chưa trả lời" : item.correct ? "Đúng" : "Chưa đúng"}</a></li>; })}</ul>
   <button type="button" className={buttonClass} onClick={() => { dispatch({type:"reset"}); startRef.current?.focus(); }}><RotateCcw aria-hidden="true" className="size-5"/>Làm lại</button>
   {afterResult && <div className="border-t border-navy-soft/20 pt-6">{afterResult}</div>}
  </section>}
 </section>;
}
export default Quiz;
