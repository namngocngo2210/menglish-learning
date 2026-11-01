import Link from "next/link";
import { GRADES, gradePath, homePath } from "@/lib/routes";
import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { roomsEnabled } from "@/lib/rooms/flag";
import { roomsLandingPath } from "@/lib/routes";

export function SiteHeader() {
 return <header className="relative z-20 border-t-4 border-t-brand border-b border-b-navy-soft/20 bg-surface">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
   <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3"><Link href={homePath()} className="flex min-h-11 items-center gap-2 font-bold text-navy! no-underline"><BrandMark/></Link></div><p className="mt-1 hidden text-sm text-navy-soft sm:block">Dành cho học sinh THCS · Không cần đăng nhập</p></div>
   <nav aria-label="Điều hướng chính" className="hidden shrink-0 lg:block"><ul className="flex gap-2">{GRADES.map(grade => <li key={grade}><NavLink className="flex min-h-11 items-center rounded-xl border border-navy-soft/20 px-3 font-semibold text-navy! no-underline motion-safe:transition-colors hover:bg-warm aria-[current=page]:border-primary aria-[current=page]:bg-warm aria-[current=page]:text-primary!" href={gradePath(grade)}>Lớp {grade}</NavLink></li>)}<li><NavLink className="flex min-h-11 items-center rounded-xl px-3 font-semibold" href="/thi-vao-lop-10">Thi vào lớp 10</NavLink></li>{roomsEnabled() && <li><NavLink className="flex min-h-11 items-center rounded-xl px-3 font-semibold" href={roomsLandingPath()}>Luyện tập nhóm</NavLink></li>}</ul></nav>
   <MobileMenu showRooms={roomsEnabled()}/>
  </div>
 </header>;
}
