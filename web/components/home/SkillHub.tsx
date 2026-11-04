"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { GradeBadge } from "@/components/art/GradeBadge";
import { SkillIcon, skillTone } from "@/components/art/SkillIcon";
import { tileClass } from "./tiles";
import { gradePath, skillPath, SKILL_NAMES, type Grade, type Skill } from "@/lib/routes";

import { GRADE_KEY as KEY } from "@/components/chrome/GradeChip";
const HINTS: Record<Skill, string> = {
 "doc-hieu": "Đọc bài, trả lời", "ngu-phap": "Thì, cấu trúc",
 "tu-vung": "Theo chủ đề", "viet-cau": "Sắp xếp câu",
};

/** Grade chips + skill tiles for the chosen grade. Chips stay real links (no-JS, crawlers); JS turns them into a selector. */
export function SkillHub({ grades, skills }: { grades: readonly Grade[]; skills: Record<number, Skill[]> }) {
 const [grade, setGrade] = useState<Grade>(grades[0]);
 useEffect(() => {
  let saved: Grade;
  try { saved = Number(localStorage.getItem(KEY)) as Grade; } catch { return; }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved grade after hydration to keep SSR markup stable
  if (grades.includes(saved)) setGrade(saved);
 }, [grades]);
 function pick(next: Grade) { setGrade(next); try { localStorage.setItem(KEY, String(next)); } catch { /* private mode */ } }
 return <>
  <ul id="chon-lop" aria-label="Chọn lớp" className="grid scroll-mt-4 grid-cols-4 gap-2 sm:gap-4">{grades.map(g => <li key={g}><a href={gradePath(g)} aria-current={g === grade ? "true" : undefined} onClick={e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); pick(g); }} className="press flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-navy-soft/20 bg-surface p-2 text-navy! no-underline shadow-sm motion-safe:transition-transform motion-safe:hover:-translate-y-1 hover:border-primary aria-[current=true]:border-primary aria-[current=true]:bg-sky-soft"><GradeBadge grade={g}/><span className="font-bold">Lớp {g}</span></a></li>)}</ul>
  <section aria-labelledby="skills-heading" className="mt-8">
   <h2 id="skills-heading" className="text-2xl font-bold">Chọn kỹ năng <span className="text-sm font-normal text-navy-soft">(lớp {grade})</span></h2>
   <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{skills[grade].map(skill => <li key={skill}><Link href={skillPath(grade, skill)} className={tileClass} style={{ borderTopColor: `var(--color-skill-${skillTone[skill]})` }}><SkillIcon kind={skill}/><b className="mt-2 text-lg">{SKILL_NAMES[skill]}</b><span className="text-sm text-navy-soft">{HINTS[skill]}</span></Link></li>)}</ul>
   <Link href={gradePath(grade)} className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold">Xem tất cả bài lớp {grade} <ArrowRight aria-hidden="true" className="size-4"/></Link>
  </section>
 </>;
}
