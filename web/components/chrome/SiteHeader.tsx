import Link from "next/link";
import { ENTRANCE_PATH, homePath, quickPracticePath, roomsLandingPath } from "@/lib/routes";
import { roomsEnabled } from "@/lib/rooms/flag";
import { accountsEnabled } from "@/lib/account/flag";
import { AuthNav } from "./AuthNav";
import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";

const link = "inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-navy! no-underline hover:bg-warm aria-[current=page]:text-primary!";
const cta = "inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-cta px-3 text-sm font-bold text-navy! no-underline! hover:bg-cta-hover md:hidden";
/** Brand + tasks (no grade picker: grades live on the home page, in the in-page grade chip and in the footer). */
export function SiteHeader() {
 const items = [[quickPracticePath(), "Luyện nhanh"], [ENTRANCE_PATH, "Thi vào lớp 10"], ...(roomsEnabled() ? [[roomsLandingPath(), "Luyện tập nhóm"]] : [])];
 const links = items.map(([href, label]) => <li key={href}><NavLink className={link} href={href}>{label}</NavLink></li>);
 return <header className="relative z-20 border-t-4 border-t-brand border-b border-b-navy-soft/20 bg-surface">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
   <Link href={homePath()} className="flex min-h-11 shrink-0 items-center gap-2 font-bold text-navy! no-underline"><BrandMark/></Link>
   <nav aria-label="Điều hướng chính" className="flex items-center gap-2 md:gap-1">
    <ul className="hidden items-center gap-1 md:flex">{links}{accountsEnabled() && <li className="flex items-center gap-1"><AuthNav/></li>}</ul>
    <Link href={quickPracticePath()} className={cta}>Luyện nhanh</Link>
    <MobileMenu>{links}{accountsEnabled() && <li className="flex flex-col"><AuthNav/></li>}</MobileMenu>
   </nav>
  </div>
 </header>;
}
