"use client";

import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { Grade } from "@/lib/routes";
import { gradePath } from "@/lib/routes";
import { NavLink } from "./NavLink";

const btn = "inline-flex min-h-11 list-none items-center gap-1 rounded-xl border border-primary px-3 font-bold text-primary! no-underline hover:bg-warm";

/** The single grade control: scrolls to the home picker on "/", opens a link popover elsewhere. */
export function GradePicker({ grades }: { grades: readonly Grade[] }) {
 const pathname = usePathname();
 if (pathname === "/") return <a href="#chon-lop" className={btn}>Chọn lớp <ChevronDown aria-hidden="true" className="size-4"/></a>;
 return <details key={pathname} className="relative">
  <summary className={`${btn} cursor-pointer [&::-webkit-details-marker]:hidden`}>Chọn lớp <ChevronDown aria-hidden="true" className="size-4"/></summary>
  <ul className="absolute right-0 top-full z-30 mt-2 grid w-44 grid-cols-2 gap-1 rounded-xl border border-navy-soft/20 bg-surface p-2 shadow-lg">{grades.map(grade => <li key={grade}><NavLink href={gradePath(grade)} className="flex min-h-11 items-center justify-center rounded-xl font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:bg-warm aria-[current=page]:text-primary!">Lớp {grade}</NavLink></li>)}</ul>
 </details>;
}
