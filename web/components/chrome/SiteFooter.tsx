import Link from "next/link";
import { getGrades, getSkills } from "@/lib/content/load";
import { gradePath, skillPath, homePath, aboutPath, privacyPath, contactPath, roomsLandingPath, SKILL_NAMES, ENTRANCE_PATH } from "@/lib/routes";
import { roomsEnabled } from "@/lib/rooms/flag";
import { accountsEnabled } from "@/lib/account/flag";
import { termsPath } from "@/lib/account/paths";
import { CookieNotice } from "@/components/account/Legal";
import { SITE } from "@/lib/site-config";
import { NavLink } from "./NavLink";

const linkClass = "inline-flex min-h-11 items-center rounded-xl py-2 text-surface! hover:decoration-2 focus-visible:outline-brand! aria-[current=page]:font-bold";
export function SiteFooter() {
 const info = [[ENTRANCE_PATH, "Thi vào lớp 10"], ...(roomsEnabled() ? [[roomsLandingPath(), "Luyện tập nhóm"]] : []), ["/data-sources", "Nguồn dữ liệu"], [aboutPath(), "Giới thiệu"], [privacyPath(), "Bảo mật"], ...(accountsEnabled() ? [[termsPath(), "Điều khoản"]] : []), [contactPath(), "Liên hệ"]];
 return <footer className="bg-navy text-surface">
  <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
   <nav aria-label="Thông tin ở chân trang"><ul className="flex flex-wrap gap-x-5">{info.map(([href, label]) => <li key={href}><NavLink href={href} className={linkClass}>{label}</NavLink></li>)}</ul></nav>
   <details className="mt-2 border-t border-surface/20"><summary className="flex min-h-11 cursor-pointer items-center font-bold focus-visible:outline-brand!">Tất cả bài luyện theo lớp</summary>
    <nav aria-label="Bài luyện theo lớp"><ul className="grid gap-x-6 gap-y-1 pb-2 md:grid-cols-2">{getGrades().map(grade => <li key={grade} className="flex flex-wrap items-center gap-x-4"><NavLink href={gradePath(grade)} className={`${linkClass} min-w-14 font-bold`}>Lớp {grade}</NavLink>{getSkills(grade).map(skill => <NavLink key={skill} href={skillPath(grade, skill)} className={`${linkClass} text-sm`}>{SKILL_NAMES[skill]}</NavLink>)}</li>)}</ul></nav>
   </details>
   <p className="mt-3 text-sm"><Link href={homePath()} className="font-bold text-surface! no-underline focus-visible:outline-brand!">{SITE.name}</Link> · {SITE.tagline}</p>
   {accountsEnabled() && <CookieNotice/>}
   <p className="mt-1 text-sm">© {new Date().getFullYear()} {SITE.name}.</p>
  </div>
 </footer>;
}
