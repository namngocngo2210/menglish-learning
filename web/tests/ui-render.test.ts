import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AdSlot } from "@/components/ads/AdSlot";
import { Breadcrumbs, LinkCardList, PageShell } from "@/components/ui-kit";
import { GRADES, gradePath } from "@/lib/routes";
import { SITE } from "@/lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(() => vi.unstubAllEnvs());
it("renders shared navigation and the accessible content destination without client JavaScript", () => {
 const html = renderToStaticMarkup(PageShell({title:"Bài luyện",children:"Nội dung"}));
 expect(html).toContain('href="#noi-dung"');
 expect(html).toContain('id="noi-dung"');
 expect(html).toContain(SITE.wordmark);
 for (const grade of GRADES) expect(html).toContain(`href="${gradePath(grade)}"`);
});
it("marks the final breadcrumb as current and provides an empty card state", () => {
 const html = renderToStaticMarkup(createElement(Breadcrumbs,{items:[{label:"Trang chủ",href:"/"},{label:"Lớp 6",href:"/lop-6"}]}));
 expect(html).toContain('aria-current="page"');
 expect(html).not.toContain('href="/lop-6"');
 expect(renderToStaticMarkup(createElement(LinkCardList,{items:[],emptyMessage:"Chưa có chủ đề."}))).toContain("Chưa có chủ đề.");
});
it("reserves an aria-hidden ad placeholder if configuration is incomplete", () => {
 vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-example");
 vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_FOOTER", "");
 const html = renderToStaticMarkup(createElement(AdSlot,{slot:"footer"}));
 expect(html).toContain('aria-hidden="true"');
 expect(html).toContain("Vị trí quảng cáo");
 expect(html).toContain("min-h-[120px]");
 expect(html).not.toContain("<ins");
});
it("renders configured ad markup without loading or requesting ads", () => {
 vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-example");
 vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_FOOTER", "12345");
 const html = renderToStaticMarkup(createElement(AdSlot,{slot:"footer"}));
 expect(html).toContain('data-ad-client="ca-pub-example"');
 expect(html).toContain('data-ad-slot="12345"');
 expect(html).toContain("adsbygoogle");
 expect(html).toContain("min-height:120px");
 expect(html).not.toContain("<script");
});
it("keeps source and license provenance off test pages", async () => {
 const { getAllTestSlugs, getTestWithQuestions } = await import("@/lib/content/load");
 const { parseTestSlug, gradeSlug } = await import("@/lib/routes");
 const { default: TestPage } = await import("@/app/[grade]/[skill]/[topic]/[test]/page");
 const slug = getAllTestSlugs().find(slug => parseTestSlug(slug))!;
 const route = parseTestSlug(slug)!; const test = getTestWithQuestions(slug)!;
 const html = renderToStaticMarkup(await TestPage({ params: Promise.resolve({ grade: gradeSlug(route.grade), skill: route.skill, topic: route.topic, test: route.test }) }));
 expect(html).not.toContain("Nguồn nội dung");
 expect(html).not.toContain("license");
 expect(html).not.toContain("Vị trí quảng cáo");
 for (const question of test.questions) expect(html).not.toContain(question.sourceUrl);
 for (const source of test.sources) { expect(html).not.toContain(source.license); }
 expect(html).not.toContain("Nội dung mẫu nguyên bản");
 expect(html).not.toContain("Đề mẫu tự soạn");
});
