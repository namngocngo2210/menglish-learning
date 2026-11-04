import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AdSlot } from "@/components/ads/AdSlot";
import { Breadcrumbs, LinkCardList, PageShell } from "@/components/ui-kit";
import { skillSegment, topicSegment, testSegment, GRADES, gradePath, skillPath } from "@/lib/routes";
import { getGrades, getSkills } from "@/lib/content/load";
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
 const html = renderToStaticMarkup(createElement(Breadcrumbs,{items:[{label:"Trang chủ",href:"/"},{label:"Lớp 6",href:"/grade-6"}]}));
 expect(html).toContain('aria-current="page"');
 expect(html).not.toContain('href="/grade-6"');
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
 const page = await TestPage({ params: Promise.resolve({ grade: gradeSlug(route.grade), skill: skillSegment(route.skill), topic: topicSegment(route.skill, route.topic), test: testSegment(route.test) }) });
 const { Quiz } = await import("@/components/quiz/Quiz");
 let questionPropsChecked = false;
 function checkQuizProps(node: ReactNode) {
  if (Array.isArray(node)) { node.forEach(checkQuizProps); return; }
  if (!isValidElement<{ children?: ReactNode; questions?: object[] }>(node)) return;
  if (node.type === Quiz) {
   questionPropsChecked = true;
   for (const question of node.props.questions!) expect(Object.keys(question).sort()).toEqual(["correctKey", "explanation", "id", "options", "passageId", "stem"]);
  }
  checkQuizProps(node.props.children);
 }
 checkQuizProps(page);
 expect(questionPropsChecked).toBe(true);
 const html = renderToStaticMarkup(page);
 expect(html).not.toContain("Nguồn nội dung");
 expect(html).not.toContain("license");
 expect(html).not.toContain("Vị trí quảng cáo");
 for (const question of test.questions) expect(html).not.toContain(question.sourceUrl);
 for (const source of test.sources) { expect(html).not.toContain(source.license); }
 expect(html).not.toContain("Nội dung mẫu nguyên bản");
 expect(html).not.toContain("Đề mẫu tự soạn");
});

it("server-renders empty progress targets alongside card content", () => {
 const html = renderToStaticMarkup(createElement(LinkCardList, { items: [
  { label: "Đề 1", href: "/de-1", progressKey: "test-one" },
  { label: "Đề 2", href: "/de-2", progressKey: "test-two" },
 ] }));
 expect(html).toContain('data-progress-slug="test-one"');
 expect(html).toContain('data-progress-slug="test-two"');
 expect(html).toContain("empty:hidden");
 expect(html).toContain('href="/de-1"');
 expect(html).not.toContain("Lần trước:");
});

it("renders the home mascot outside questions and publishes BeeJunior organization data", async () => {
 const { default: Home } = await import("@/app/page");
 const html = renderToStaticMarkup(await Home());
 expect(html).toContain('viewBox="0 0 300 240" aria-hidden="true"');
 expect(html).not.toContain('src="/brand/mascot.webp"');
 expect(html).toContain('"@type":"Organization","name":"BeeJunior"');
 expect(html.match(/<h1[ >]/g)).toHaveLength(1);
 expect(html).toContain('href="/grade-10-entrance"');
});

it("renders the skill-first home: one grade picker, current grades only, every grade and skill link reachable", async () => {
 const { default: Home } = await import("@/app/page");
 const html = renderToStaticMarkup(await Home());
 const links = [...html.matchAll(/href="(\/grade-[6-9][^"]*)"/g)].map(m => m[1]);
 for (const grade of getGrades()) {
  expect(links).toContain(gradePath(grade));
  for (const skill of getSkills(grade)) expect(links).toContain(skillPath(grade, skill));
 }
 expect(links.length).toBeLessThanOrEqual(29);
 expect(html).toContain('href="/quick-practice"');
 expect(html.match(/id="chon-lop"/g)).toHaveLength(1);
 expect(html).not.toMatch(/sắp có|Lớp [1-5]\b/);
 expect(html).not.toContain("mobile-navigation");
});

it("shows the home group-practice CTA only when ROOMS_ENABLED is on", async () => {
 const { default: Home } = await import("@/app/page");
 vi.stubEnv("ROOMS_ENABLED", "true");
 const on = renderToStaticMarkup(await Home());
 expect(on).toContain('href="/group-practice"');
 vi.stubEnv("ROOMS_ENABLED", "false");
 expect(renderToStaticMarkup(await Home())).not.toContain("luyen-tap-nhom");
 vi.unstubAllEnvs();
});
