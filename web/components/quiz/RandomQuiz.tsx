"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { buildRandomQuiz, QuizPool } from "@/lib/random-quiz";
import type { Quiz } from "./Quiz";
import { RandomStartContext } from "./random-context";
const buttonClass = "min-h-11 w-full rounded-xl bg-cta px-5 py-3 font-bold text-navy hover:bg-cta-hover disabled:bg-navy-soft disabled:text-surface sm:w-auto";
/** hideTrigger: the page offers the button elsewhere (Quiz menu, page footer) through RandomStartContext. */
export function RandomQuiz({ poolUrl, size = 20, children, afterResult, hideTrigger }: { poolUrl: string; size?: number; children?: ReactNode; afterResult?: ReactNode; hideTrigger?: boolean }) {
 const pool = useRef<QuizPool | null>(null);
 const [active, setActive] = useState<{ quiz: ReturnType<typeof buildRandomQuiz>; Quiz: typeof Quiz } | null>(null);
 const quiz = active?.quiz;
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const region = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 useEffect(() => { if (quiz) region.current?.querySelector<HTMLElement>("#quiz-heading")?.focus(); }, [quiz]);
 async function start() {
  setLoading(true); setError("");
  try {
   const [quizModule, mixerModule, loadedPool] = await Promise.all([
    import("./Quiz"),
    import("@/lib/random-quiz"),
    pool.current ? Promise.resolve(pool.current) : fetch(poolUrl).then(async response => {
     if (!response.ok) throw new Error("Pool unavailable");
     return await response.json() as QuizPool;
    }),
   ]);
   pool.current = loadedPool;
   const seed = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join("-");
   const mixed = mixerModule.buildRandomQuiz(loadedPool, seed, size);
   if (!mixed.questions.length) throw new Error("Empty pool");
   setActive({ quiz: mixed, Quiz: quizModule.Quiz });
  } catch { setError("Chưa tải được đề ngẫu nhiên. Em hãy thử lại hoặc làm đề cố định bên dưới."); }
  finally { setLoading(false); }
 }
 return <RandomStartContext.Provider value={{ start, again: Boolean(quiz), loading }}><div ref={region} className="space-y-6">
  {(!hideTrigger || quiz) && <div className="flex flex-col gap-3 sm:flex-row"><button ref={trigger} type="button" disabled={loading} aria-busy={loading} className={buttonClass} onClick={start}>{quiz ? "Làm đề ngẫu nhiên khác" : "Làm đề ngẫu nhiên"}</button>{quiz && <button type="button" className="min-h-11 w-full rounded-xl border border-primary bg-surface px-5 py-3 font-bold text-primary hover:bg-sky-soft sm:w-auto" onClick={() => { setActive(null); trigger.current?.focus(); }}>Quay lại đề cố định</button>}</div>}
  <p role="status" aria-live="polite" className="empty:hidden">{loading ? "Đang tải và trộn đề…" : error}</p>
  {active ? <active.Quiz key={active.quiz.seed} lead={<p className="font-bold text-primary">Đề ngẫu nhiên · {active.quiz.questions.length} câu</p>} questions={active.quiz.questions} passages={active.quiz.passages} storageKey={`random:${active.quiz.seed}`} afterResult={afterResult}/> : children}
 </div></RandomStartContext.Provider>;
}
