"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { buildRandomQuiz, QuizPool } from "@/lib/random-quiz";
import type { Quiz } from "./Quiz";
const buttonClass = "min-h-11 w-full rounded-md bg-cta px-5 py-3 font-semibold text-white hover:bg-primary disabled:bg-navy-soft sm:w-auto";
export function RandomQuiz({ poolUrl, size = 20, children, afterResult }: { poolUrl: string; size?: number; children?: ReactNode; afterResult?: ReactNode }) {
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
 return <div ref={region} className="space-y-6">
  <div className="flex flex-col gap-3 sm:flex-row"><button ref={trigger} type="button" disabled={loading} aria-busy={loading} className={buttonClass} onClick={start}>{quiz ? "Làm đề ngẫu nhiên khác" : "Làm đề ngẫu nhiên"}</button>{quiz && <button type="button" className={`${buttonClass} bg-navy`} onClick={() => { setActive(null); trigger.current?.focus(); }}>Quay lại đề cố định</button>}</div>
  <p role="status" aria-live="polite">{loading ? "Đang tải và trộn đề…" : error}</p>
  {active ? <><p className="font-bold text-primary">Đề ngẫu nhiên · {active.quiz.questions.length} câu</p><active.Quiz key={active.quiz.seed} questions={active.quiz.questions} passages={active.quiz.passages} afterResult={afterResult}/></> : children}
 </div>;
}
