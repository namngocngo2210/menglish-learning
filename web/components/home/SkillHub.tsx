"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Languages, LibraryBig, PenLine } from "lucide-react";
import { tileClass } from "./tiles";
import { gradePath, skillPath, SKILL_NAMES, type Grade, type Skill } from "@/lib/routes";

import { GRADE_KEY as KEY } from "@/components/chrome/GradeChip";
const META: Record<Skill, [typeof BookOpen, string]> = {
 "doc-hieu": [BookOpen, "Bài đọc và câu hỏi"], "ngu-phap": [LibraryBig, "Thì, cấu trúc"],
 "tu-vung": [Languages, "Theo chủ đề"], "viet-cau": [PenLine, "Sắp xếp, viết lại"],
};

/** Grade chips + skill tiles for the chosen grade. Chips stay real links (no-JS, crawlers); JS turns them into a selector. */
export function SkillHub({ grades, skills }: { grades: readonly Grade[]; skills: Record<number, Skill[]> }) {
 const [grade, setGrade] = useState<Grade>(grades[0]);
 useEffect(() => {
  const saved = Number(localStorage.getItem(KEY)) as Grade;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved grade after hydration to keep SSR markup stable
  if (grades.includes(saved)) setGrade(saved);
 }, [grades]);
 function pick(next: Grade) { setGrade(next); try { localStorage.setItem(KEY, String(next)); } catch { /* private mode */ } }
 return <>
  <p className="mt-5 font-bold">Em học lớp mấy?</p>
  <ul id="chon-lop" aria-label="Chọn lớp" className="mt-3 flex scroll-mt-4 flex-wrap gap-2">{grades.map(g => <li key={g}><a href={gradePath(g)} aria-current={g === grade ? "true" : undefined} onClick={e => { e.preventDefault(); pick(g); }} className="inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl border-2 border-primary bg-surface px-4 text-lg font-bold text-primary! no-underline aria-[current=true]:bg-primary aria-[current=true]:text-white!">{g}</a></li>)}</ul>
  <section aria-labelledby="skills-heading" className="mt-8">
   <h2 id="skills-heading" className="text-2xl font-bold">Luyện theo kỹ năng <span className="text-sm font-normal text-navy-soft">(lớp {grade})</span></h2>
   <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{skills[grade].map(skill => { const [Icon, hint] = META[skill]; return <li key={skill}><Link href={skillPath(grade, skill)} className={tileClass}><Icon aria-hidden="true" className="size-6 text-primary"/><b className="text-lg">{SKILL_NAMES[skill]}</b><span className="text-sm text-navy-soft">{hint}</span></Link></li>; })}</ul>
   <Link href={gradePath(grade)} className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold">Xem tất cả bài lớp {grade} <ArrowRight aria-hidden="true" className="size-4"/></Link>
  </section>
 </>;
}
