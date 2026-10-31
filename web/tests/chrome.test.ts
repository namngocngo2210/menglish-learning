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
 expect(html).toContain("Tên tạm");
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
 expect(html).toContain("Nội dung mẫu tự soạn, chưa phải tài liệu học tập chính thức");
 expect(html).toContain(`© ${new Date().getFullYear()} ${SITE.name}. Tên thương hiệu tạm thời.`);
});
