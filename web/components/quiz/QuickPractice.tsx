"use client";
import { useEffect, useState, type ReactNode } from "react";
import { GRADES, type Grade } from "@/lib/routes";
import { GRADE_KEY } from "@/components/chrome/GradeChip";
import { RandomQuiz } from "./RandomQuiz";
const choiceClass = "min-h-11 min-w-20 rounded-xl border border-primary bg-surface px-4 py-2 font-bold text-primary hover:bg-sky-soft";
/** Remembered grade from localStorage; null when missing or invalid. */
export function readGrade(raw: string | null): Grade | null {
 const n = Number(raw);
 return (GRADES as readonly number[]).includes(n) ? n as Grade : null;
}
/** Uses the remembered grade; with none stored it shows a visible grade choice instead of a silent default pool. */
export function QuickPractice({ afterResult }: { afterResult?: ReactNode }) {
 const [grade, setGrade] = useState<Grade | null>(null);
 const [ready, setReady] = useState(false);
 useEffect(() => { try { setGrade(readGrade(localStorage.getItem(GRADE_KEY))); } catch { /* private mode */ } setReady(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
 function pick(g: Grade | null) { setGrade(g); try { if (g) localStorage.setItem(GRADE_KEY, String(g)); } catch { /* private mode */ } }
 if (!ready) return <p role="status" className="min-h-24">Đang tải…</p>;
 if (!grade) return <section aria-labelledby="qp-grade" className="space-y-3"><h2 id="qp-grade" className="text-xl font-bold">Em học lớp mấy?</h2><ul className="flex flex-wrap gap-2">{GRADES.map(g => <li key={g}><button type="button" className={choiceClass} onClick={() => pick(g)}>Lớp {g}</button></li>)}</ul></section>;
 return <div className="space-y-4"><p className="flex flex-wrap items-center gap-3">Đề trộn từ lớp <b>{grade}</b>. <button type="button" className="min-h-11 font-semibold text-primary underline" onClick={() => pick(null)}>Đổi lớp</button></p><RandomQuiz key={grade} poolUrl={`/pool/grade-${grade}`} size={10} afterResult={afterResult}/></div>;
}
