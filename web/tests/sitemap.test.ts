import { afterEach, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { absoluteUrl, getAllRoutes } from "@/lib/seo";
import { getGrades, getSkills, getTopics, getAllTestSlugs, getTestWithQuestions } from "@/lib/content/load";
import { gradePath, skillPath, topicPath, testSlugPath } from "@/lib/routes";
afterEach(() => vi.unstubAllEnvs());
it("lists exactly every public content route with absolute URLs and publication dates", async () => {
 const paths = ["/","/contact","/about","/privacy-policy","/grade-10-entrance","/quick-practice","/data-sources",...getGrades().flatMap(grade => [gradePath(grade),...getSkills(grade).flatMap(skill => [skillPath(grade,skill),...getTopics(grade,skill).map(topic=>topicPath(grade,skill,topic.slug))])]),...getAllTestSlugs().map(testSlugPath)];
 const routes = getAllRoutes(); const entries = await sitemap();
 expect(routes.map(route=>route.path).sort()).toEqual(paths.sort());
 expect(entries.map(entry=>entry.url).sort()).toEqual(paths.map(absoluteUrl).sort());
 expect(new Set(entries.map(entry=>entry.url)).size).toBe(entries.length);
 expect(entries).toHaveLength(routes.length);
 for (const slug of getAllTestSlugs()) expect(entries.find(entry=>entry.url===absoluteUrl(testSlugPath(slug)))?.lastModified).toEqual(new Date(getTestWithQuestions(slug)!.publishedAt));
});
it("allows indexing and advertises the sitemap by default", () => {
 vi.stubEnv("SEO_NOINDEX",undefined);
 expect(robots()).toEqual({rules:{userAgent:"*",allow:"/",disallow:["/api/","/pool/"]},sitemap:absoluteUrl("/sitemap.xml")});
});
it("blocks crawling only for the beta opt-in switch", () => {
 vi.stubEnv("SEO_NOINDEX","true");
 expect(robots()).toEqual({rules:{userAgent:"*",disallow:"/"}});
});
