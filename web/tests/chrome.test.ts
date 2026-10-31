import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { getAllRoutes } from "@/lib/seo";
import { getSkills } from "@/lib/content/load";
import { GRADES, gradePath, skillPath } from "@/lib/routes";
import { SITE } from "@/lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/lop-6" }));

it("renders grade navigation, current page and a closed accessible mobile menu", () => {
 const html = renderToStaticMarkup(createElement(SiteHeader));
 expect(html).toContain('aria-label="Điều hướng chính"');
 expect(html).toContain('aria-current="page"');
 expect(html).toContain('aria-expanded="false"');
 expect(html).toContain('aria-controls="mobile-navigation"');
 expect(html).toContain('aria-label="Mở menu"');
 expect(html).toContain('id="mobile-navigation" hidden=""');
 expect(html).toContain('aria-hidden="true"');
 expect(html).toMatch(/<img[^>]+alt="BeeJunior"[^>]+width="231"[^>]+height="44"/);
 expect(html).toContain("border-t-brand");
 for (const grade of GRADES) expect(html).toContain(`href="${gradePath(grade)}"`);
 expect(html).not.toContain('type="search"');
});
it("renders footer navigation with only known public routes and all published skills", () => {
 const html = renderToStaticMarkup(createElement(SiteFooter));
 for (const label of ["Chọn lớp ở chân trang", "Kỹ năng theo lớp", "Thông tin ở chân trang"]) expect(html).toContain(`aria-label="${label}"`);
 const known = new Set(getAllRoutes().map(route => route.path));
 const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
 for (const href of links) expect(known.has(href), href).toBe(true);
 for (const grade of GRADES) {
  expect(links).toContain(gradePath(grade));
  for (const skill of getSkills(grade)) expect(links).toContain(skillPath(grade, skill));
 }
 for (const href of ["/gioi-thieu", "/chinh-sach-bao-mat", "/lien-he"]) expect(links).toContain(href);
 expect(html).toContain(SITE.tagline);
 expect(html).toContain(`© ${new Date().getFullYear()} ${SITE.name}.`);
});

it("removes retired branding from application source", () => {
 const retired = ["Luyện Tiếng Anh THCS", "Tên tạm", "Tên thương hiệu tạm thời", "Góc tiếng Anh", "Góc luyện tập tiếng Anh"];
 function inspect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
   const path = join(directory, entry.name);
   if (entry.isDirectory()) inspect(path);
   else if (/\.(tsx?|css|js|mjs)$/.test(entry.name)) {
    const source = readFileSync(path, "utf8");
    for (const brand of retired) expect(source, path).not.toContain(brand);
   }
  }
 }
 for (const directory of ["app", "components", "lib"]) inspect(directory);
});

it("keeps the BeeJunior palette and readable CTA and footer focus styles", () => {
 const css = readFileSync("app/globals.css", "utf8");
 for (const [token, color] of Object.entries({ navy: "#291e1c", "navy-soft": "#4a3f3a", surface: "#fffdf5", warm: "#fff6d6", "warm-2": "#ffedaa", primary: "#0a6590", cta: "#ffc001", brand: "#ffc001", "cta-hover": "#e6ac00", sky: "#10b7eb", "sky-soft": "#e8f7fd" })) {
  expect(css).toContain(`--color-${token}: ${color};`);
 }
 for (const component of ["Quiz", "RandomQuiz"]) {
  const source = readFileSync(`components/quiz/${component}.tsx`, "utf8");
  expect(source).toContain("font-bold text-navy");
  expect(source).toContain("hover:bg-cta-hover");
  expect(source).toContain("disabled:bg-navy-soft disabled:text-surface");
 }
 expect(renderToStaticMarkup(createElement(SiteFooter))).toContain("focus-visible:outline-brand!");
});
