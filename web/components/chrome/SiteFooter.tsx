import Link from "next/link";
import { getGrades, getSkills } from "@/lib/content/load";
import { gradePath, skillPath, homePath, aboutPath, privacyPath, contactPath, SKILL_NAMES } from "@/lib/routes";
import { SITE } from "@/lib/site-config";
import { NavLink } from "./NavLink";

const linkClass = "inline-flex min-h-11 items-center rounded-sm py-2 text-surface! hover:decoration-2 focus-visible:outline-surface! aria-[current=page]:font-bold";
export function SiteFooter() {
 return <footer className="bg-navy text-surface">
  <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_.6fr_1.5fr_1fr]">
   <div><Link href={homePath()} className={`${linkClass} font-bold no-underline`}>{SITE.wordmark}</Link><p className="mt-2">{SITE.tagline}</p><p className="mt-4 max-w-prose text-sm">Luyện tiếng Anh theo lớp và kỹ năng, có giải thích tiếng Việt.</p></div>
   <nav aria-label="Chọn lớp ở chân trang"><h2 className="mb-3 font-bold">Chọn lớp</h2><ul>{getGrades().map(grade => <li key={grade}><NavLink href={gradePath(grade)} className={linkClass}>Lớp {grade}</NavLink></li>)}</ul></nav>
   <nav aria-label="Kỹ năng theo lớp"><h2 className="mb-3 font-bold">Kỹ năng</h2><div className="space-y-4">{getGrades().map(grade => {
    const skills = getSkills(grade);
    return skills.length > 0 && <div key={grade}><h3 className="text-sm font-semibold">Lớp {grade}</h3><ul aria-label={`Kỹ năng lớp ${grade}`} className="flex flex-wrap gap-x-4">{skills.map(skill => <li key={skill}><NavLink href={skillPath(grade,skill)} className={`${linkClass} text-sm`}>{SKILL_NAMES[skill]}</NavLink></li>)}</ul></div>;
   })}</div></nav>
   <nav aria-label="Thông tin ở chân trang"><h2 className="mb-3 font-bold">Thông tin</h2><ul>{[["/thi-vao-lop-10","Thi vào lớp 10"],["/nguon-du-lieu","Nguồn dữ liệu và giấy phép"],[aboutPath(),"Giới thiệu"],[privacyPath(),"Chính sách bảo mật"],[contactPath(),"Liên hệ"]].map(([href,label]) => <li key={href}><NavLink href={href} className={linkClass}>{label}</NavLink></li>)}</ul></nav>
  </div>
  <div className="border-t border-surface/20"><p className="mx-auto max-w-6xl px-5 py-5 text-sm sm:px-8">© {new Date().getFullYear()} {SITE.name}. Tên thương hiệu tạm thời.</p></div>
 </footer>;
}
