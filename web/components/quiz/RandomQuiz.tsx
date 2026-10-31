"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buildRandomQuiz, type QuizPool } from "@/lib/random-quiz";
import { Quiz } from "./Quiz";
const buttonClass = "min-h-11 w-full rounded-md bg-cta px-5 py-3 font-semibold text-white hover:bg-primary disabled:bg-navy-soft sm:w-auto";
export function RandomQuiz({ poolUrl, size = 20, children, afterResult }: { poolUrl: string; size?: number; children?: ReactNode; afterResult?: ReactNode }) {
 const pool = useRef<QuizPool | null>(null);
 const [quiz, setQuiz] = useState<ReturnType<typeof buildRandomQuiz> | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const region = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 useEffect(() => { if (quiz) region.current?.querySelector<HTMLElement>("#quiz-heading")?.focus(); }, [quiz]);
 async function start() {
  setLoading(true); setError("");
  try {
   if (!pool.current) { const response = await fetch(poolUrl); if (!response.ok) throw new Error("Pool unavailable"); pool.current = await response.json(); }
   const seed = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join("-");
   const mixed = buildRandomQuiz(pool.current!, seed, size);
   if (!mixed.questions.length) throw new Error("Empty pool");
   setQuiz(mixed);
  } catch { setError("Chưa tải được đề ngẫu nhiên. Em hãy thử lại hoặc làm đề cố định bên dưới."); }
  finally { setLoading(false); }
 }
 return <div ref={region} className="space-y-6">
  <div className="flex flex-col gap-3 sm:flex-row"><button ref={trigger} type="button" disabled={loading} aria-busy={loading} className={buttonClass} onClick={start}>{quiz ? "Làm đề ngẫu nhiên khác" : "Làm đề ngẫu nhiên"}</button>{quiz && <button type="button" className={`${buttonClass} bg-navy`} onClick={() => { setQuiz(null); trigger.current?.focus(); }}>Quay lại đề cố định</button>}</div>
  <p role="status" aria-live="polite">{loading ? "Đang tải và trộn đề…" : error}</p>
  {quiz ? <><p className="font-bold text-primary">Đề ngẫu nhiên · {quiz.questions.length} câu</p><Quiz key={quiz.seed} questions={quiz.questions} passages={quiz.passages} afterResult={afterResult}/></> : children}
 </div>;
}
