import Link from "next/link";
import { ENTRANCE_PATH, homePath, roomsLandingPath } from "@/lib/routes";
import { getGrades } from "@/lib/content/load";
import { roomsEnabled } from "@/lib/rooms/flag";
import { accountsEnabled } from "@/lib/account/flag";
import { loginPath } from "@/lib/account/paths";
import { BrandMark } from "./BrandMark";
import { GradePicker } from "./GradePicker";
import { NavLink } from "./NavLink";

const navLink = "hidden min-h-11 items-center rounded-xl px-3 font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:text-primary! md:flex";
export function SiteHeader() {
 return <header className="relative z-20 border-t-4 border-t-brand border-b border-b-navy-soft/20 bg-surface">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
   <Link href={homePath()} className="flex min-h-11 items-center gap-2 font-bold text-navy! no-underline"><BrandMark/></Link>
   <nav aria-label="Điều hướng chính" className="flex shrink-0 items-center gap-1"><GradePicker grades={getGrades()}/><NavLink className={navLink} href={ENTRANCE_PATH}>Thi vào lớp 10</NavLink>{roomsEnabled() && <NavLink className={navLink} href={roomsLandingPath()}>Luyện tập nhóm</NavLink>}{accountsEnabled() && <NavLink className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:text-primary!" href={loginPath()}>Đăng nhập</NavLink>}</nav>
  </div>
 </header>;
}
