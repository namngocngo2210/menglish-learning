import { publicPathToTestSlug } from "@/lib/routes";
import { testParams, entranceParams } from "@/lib/content/params";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import * as fixed from "@/app/[grade]/[skill]/[topic]/[test]/page";
import * as entrance from "@/app/grade-10-entrance/[test]/page";
import Credits from "@/app/data-sources/page";
import { getAllTestSlugs, loadBundle } from "@/lib/content/load";
import { getQuizPool } from "@/lib/content/pool";
import { buildRandomQuiz } from "@/lib/random-quiz";
import { AdSlot } from "@/components/ads/AdSlot";
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("Not found"); } }));
it("generates exactly all 370+ bank test routes across both route families", () => {
 const paths = [...testParams().map(p => publicPathToTestSlug(`/${p.grade}/${p.skill}/${p.topic}/${p.test}`)!), ...entranceParams().map(p => publicPathToTestSlug(`/grade-10-entrance/${p.test}`)!)];
 expect(paths.sort()).toEqual(getAllTestSlugs().sort()); expect(paths.length).toBeGreaterThanOrEqual(300);
 expect(fixed.dynamic).toBe("force-dynamic"); expect(entrance.dynamic).toBe("force-dynamic");
});
it("centralizes published source credits and per-grade counts", async () => {
 const html = renderToStaticMarkup(await Credits());
 expect(html).toContain("VOA Learning English"); expect(html).toContain("Public domain"); expect(html).toContain("không dùng AI");
 for (const source of loadBundle().sources) expect(html).toContain(`href="${source.baseUrl}"`);
 for (const grade of [6, 7, 8, 9]) expect(html).toContain(String(loadBundle().questions.filter(q => q.grade === grade && q.sourceName === "VOA Learning English").length));
 expect(html).toContain("BreadcrumbList");
});
it("renders fixed entrance quiz questions without source attribution or ad nodes", async () => {
 const html = renderToStaticMarkup(await entrance.default({ params: Promise.resolve(entranceParams()[0]) }));
 expect(html).toContain("<fieldset"); expect(html).toContain('type="radio"'); expect(html).toContain("Quiz");
 expect(html).not.toContain("adsbygoogle"); expect(html).not.toContain("Vị trí quảng cáo");
 expect(html).not.toContain("Nguồn nội dung"); expect(html).not.toContain("Giấy phép"); expect(html).not.toContain("license");
 for (const q of loadBundle().questions) expect(html).not.toContain(q.sourceUrl);
});
it("returns minimal pools and deterministically remaps answers with adjacent passage groups", () => {
 const pool = getQuizPool(6, "doc-hieu", "tong-hop");
 for (const item of [...pool.questions, ...pool.passages]) {
  expect(item).not.toHaveProperty("sourceUrl"); expect(item).not.toHaveProperty("license"); expect(item).not.toHaveProperty("sourceId");
 }
 const mixed = buildRandomQuiz(pool, "seed-a", 20);
 expect(mixed).toEqual(buildRandomQuiz(pool, "seed-a", 20)); expect(mixed).not.toEqual(buildRandomQuiz(pool, "seed-b", 20));
 expect(mixed.questions.length).toBeGreaterThanOrEqual(20);
 expect(new Set(mixed.questions.map(q => q.id)).size).toBe(mixed.questions.length);
 for (const q of mixed.questions) {
  const original = pool.questions.find(item => item.id === q.id)!;
  expect(q.options.find(o => o.key === q.correctKey)?.text).toBe(original.options.find(o => o.key === original.correctKey)?.text);
  if (q.passageId) {
   const indices = mixed.questions.flatMap((item, i) => item.passageId === q.passageId ? [i] : []);
   expect(indices.at(-1)! - indices[0]+1).toBe(indices.length);
   expect(mixed.passages.some(p => p.id === q.passageId)).toBe(true);
  }
 }
 expect(getQuizPool().questions.every(q => loadBundle().questions.find(item => item.id === q.id)!.grade >= 8)).toBe(true);
});
it("reserves an ad placeholder without a configured client", () => {
 vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
 try { const html = renderToStaticMarkup(createElement(AdSlot, { slot: "footer" })); expect(html).toContain("min-h-[120px]"); expect(html).not.toContain("<ins"); } finally { vi.unstubAllEnvs(); }
});
