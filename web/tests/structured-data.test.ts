import { gradeParams, skillParams, topicParams, testParams } from "@/lib/content/params";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi, afterEach } from "vitest";
import robots from "@/app/robots";
import * as gradePage from "@/app/[grade]/page";
import * as skillPage from "@/app/[grade]/[skill]/page";
import * as topicPage from "@/app/[grade]/[skill]/[topic]/page";
import * as testPage from "@/app/[grade]/[skill]/[topic]/[test]/page";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, faqJsonLd, getAllRoutes, organizationJsonLd, quizJsonLd, websiteJsonLd } from "@/lib/seo";
import { buildGradeFaq, buildSkillFaq, buildTopicFaq, NOT_FOUND_LINKS } from "@/lib/seo-content";
import { getGrades, getSkills, getTopics, getTestsForTopic, loadBundle } from "@/lib/content/load";
import { topicPath } from "@/lib/routes";

afterEach(() => vi.unstubAllEnvs());

it("builds valid FAQPage data for every grade, skill and topic page", () => {
 let pages = 0;
 const check = (items: { question: string; answer: string }[]) => {
  pages++;
  expect(items.length).toBeGreaterThanOrEqual(2);
  expect(new Set(items.map(i => i.question)).size).toBe(items.length);
  const ld = faqJsonLd(items) as { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  expect(ld["@type"]).toBe("FAQPage");
  ld.mainEntity.forEach((q, i) => { expect(q.name).toBe(items[i].question); expect(q.acceptedAnswer.text).toBe(items[i].answer); expect(q.acceptedAnswer.text.length).toBeGreaterThan(20); });
 };
 for (const grade of getGrades()) {
  check(buildGradeFaq(grade));
  for (const skill of getSkills(grade)) {
   check(buildSkillFaq(grade, skill));
   for (const t of getTopics(grade, skill)) check(buildTopicFaq(grade, skill, t.slug, t.name, loadBundle().questions.length, getTestsForTopic(grade, skill, t.slug).length));
  }
 }
 expect(pages).toBeGreaterThan(40);
});

it("rejects empty FAQ data instead of emitting an invalid FAQPage", () => { expect(() => faqJsonLd([])).toThrow(); });

it("keeps breadcrumb positions sequential with absolute URLs", () => {
 const ld = breadcrumbJsonLd([{ name: "Trang chủ", path: "/" }, { name: "Lớp 6", path: "/grade-6" }, { name: "Ngữ pháp" }]) as { itemListElement: { position: number; name: string; item?: string }[] };
 expect(ld.itemListElement.map(i => i.position)).toEqual([1, 2, 3]);
 expect(ld.itemListElement[0].item).toBe(absoluteUrl("/"));
 expect(ld.itemListElement[2].item).toBeUndefined();
});

it("emits complete Quiz, Organization and WebSite data", () => {
 const quiz = quizJsonLd({ name: "Đề 1", description: "Mô tả", path: "/grade-6/grammar/x/test-1", grade: 6, skillName: "Ngữ pháp", topicName: "X", questionCount: 10, datePublished: "2026-10-31T00:00:00.000Z" }) as Record<string, unknown>;
 for (const key of ["name", "url", "educationalLevel", "teaches", "inLanguage", "datePublished"]) expect(quiz[key]).toBeTruthy();
 expect(String(quiz.url).startsWith("https://")).toBe(true);
 const org = organizationJsonLd(); expect(org.logo.startsWith("https://")).toBe(true);
 expect(websiteJsonLd().inLanguage).toBe("vi");
});

it("gives every page unique, length-bounded metadata with canonical and hreflang vi", async () => {
 const meta = [
  ...(await Promise.all(gradeParams().map(p => gradePage.generateMetadata({ params: Promise.resolve(p) })))),
  ...(await Promise.all(skillParams().map(p => skillPage.generateMetadata({ params: Promise.resolve(p) })))),
  ...(await Promise.all(topicParams().map(p => topicPage.generateMetadata({ params: Promise.resolve(p) })))),
  ...(await Promise.all(testParams().map(p => testPage.generateMetadata({ params: Promise.resolve(p) })))),
 ];
 expect(meta.length).toBeGreaterThan(100);
 for (const m of meta) {
  expect(`${m.title} | BeeJunior`.length).toBeLessThanOrEqual(60);
  expect(String(m.description).length).toBeLessThanOrEqual(155);
  expect(m.alternates?.languages).toEqual({ vi: m.alternates?.canonical });
  expect(m.robots).toEqual({ index: true, follow: true });
 }
 expect(new Set(meta.map(m => m.title)).size).toBe(meta.length);
 expect(new Set(meta.map(m => m.description)).size).toBe(meta.length);
});

it("gives every sitemap route a lastModified and hubs never older than their tests", () => {
 const routes = getAllRoutes();
 for (const r of routes) expect(r.lastModified).toBeInstanceOf(Date);
 const byPath = new Map(routes.map(r => [r.path, r.lastModified]));
 for (const grade of getGrades()) for (const skill of getSkills(grade)) for (const t of getTopics(grade, skill)) for (const test of getTestsForTopic(grade, skill, t.slug)) {
  expect(byPath.get(topicPath(grade, skill, t.slug))!.getTime()).toBeGreaterThanOrEqual(new Date(test.publishedAt).getTime());
 }
});

it("indexes by default, never emits noindex in production code and robots blocks only api/pool", () => {
 vi.stubEnv("SEO_NOINDEX", undefined);
 expect(buildMetadata({ title: "a", description: "b", path: "/" }).robots).toEqual({ index: true, follow: true });
 const r = robots() as { rules: { allow: string; disallow: string[] }; sitemap: string };
 expect(r.rules.disallow).toEqual(["/api/", "/pool/"]);
 expect(r.sitemap).toBe(absoluteUrl("/sitemap.xml"));
 const hits: string[] = [];
 const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
   if (["node_modules", ".next", "content", "tests"].includes(name)) continue;
   const p = join(dir, name);
   if (statSync(p).isDirectory()) walk(p);
   else if (/\.(tsx?|mjs|json)$/.test(name) && /noindex|X-Robots-Tag/i.test(readFileSync(p, "utf8"))) hits.push(p.replace(process.cwd() + "/", ""));
  }
 };
 for (const dir of ["app", "lib", "components"]) walk(join(process.cwd(), dir));
 const next = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
 // X-Robots-Tag is allowed only for the private room shell routes (see rooms-ui-flag-seo.test.ts).
 expect(next.match(/X-Robots-Tag/gi)).toHaveLength(1);
 // Only the SEO_NOINDEX switch helper may mention noindex.
 expect([...new Set(hits)].filter(f => !["app/robots.ts", "lib/seo.ts", "package.json", "lighthouserc.json"].includes(f)).sort()).toEqual([]);
});

it("404 page links to home, every grade and the entrance exam", () => {
 const hrefs = NOT_FOUND_LINKS.map(l => l.href);
 expect(hrefs).toEqual(expect.arrayContaining(["/", "/grade-6", "/grade-7", "/grade-8", "/grade-9", "/grade-10-entrance"]));
});
