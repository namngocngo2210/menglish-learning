"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { GRADES, gradePath, parseGradeSlug, parseSkillUrl, skillPath, type Grade } from "@/lib/routes";
import { NavLink } from "./NavLink";

export const GRADE_KEY = "bj-grade";

/** "Lớp N" chip beside the breadcrumb on /grade-N pages: real links to the same skill (or the grade page) for each grade; also remembers the grade client-side only. */
export function GradeChip() {
 const parts = usePathname().split("/").filter(Boolean);
 const grade = parts[0] ? parseGradeSlug(parts[0]) : null;
 useEffect(() => { if (grade) try { localStorage.setItem(GRADE_KEY, String(grade)); } catch { /* private mode */ } }, [grade]);
 if (!grade) return null;
 const skill = parts[1] ? parseSkillUrl(parts[1]) : null;
 const target = (g: Grade) => skill ? skillPath(g, skill) : gradePath(g);
 return <details className="relative shrink-0">
  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl border border-primary px-3 text-sm font-bold text-primary hover:bg-warm [&::-webkit-details-marker]:hidden">Lớp {grade} <ChevronDown aria-hidden="true" className="size-4"/></summary>
  <ul aria-label="Đổi lớp" className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-wrap gap-1 rounded-xl border border-navy-soft/20 bg-surface p-2 shadow-lg">{GRADES.map(g => <li key={g}><NavLink href={target(g)} className="flex min-h-11 min-w-14 items-center justify-center rounded-xl px-3 font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:bg-warm aria-[current=page]:text-primary!">Lớp {g}</NavLink></li>)}</ul>
 </details>;
}
