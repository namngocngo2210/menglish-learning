import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { loadBundle, getTopics } from "../lib/content/load";
import { ContentBundleSchema } from "../lib/content/types";
import { getTopicDef, topicOrder } from "../lib/topics/registry";
import { getAllRoutes } from "../lib/seo";
import sitemap from "../app/sitemap";
import TopicPage, { generateMetadata, generateStaticParams } from "../app/[grade]/[skill]/[topic]/page";
import { buildBank, serializeBundle, classifyEligibleQuestions } from "../scripts/lib/build-bank";
import { generateClassificationReport, generateLegacyRedirects } from "../scripts/lib/topic-artifacts";
import { SKILL_NAMES } from "../lib/routes";
import { SITE } from "../lib/site-config";
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("Not found"); } }));
const fragments = readdirSync("content/quarantine").filter(f => f.endsWith(".json")).sort().map(f => ContentBundleSchema.parse(JSON.parse(readFileSync(join("content/quarantine", f), "utf8"))));
const bundle = loadBundle();
it("publishes registered concrete topics with homogeneous topic tests of at least ten items", () => {
 const byId = new Map(bundle.questions.map(q => [q.id, q]));
 for (const topic of bundle.topics.filter(t => ["ngu-phap","tu-vung"].includes(t.skill))) {
  expect(topic.slug).not.toBe("chung");
  if (topic.slug === "tong-hop") continue;
  const def = getTopicDef(topic.skill, topic.slug); expect(def).toBeDefined();
  expect(topic.description).toBe(`${def!.summary} Lớp ${topic.grade}.`);
  const tests = bundle.tests.filter(t => t.kind === "topic" && t.grade === topic.grade && t.skill === topic.skill && t.topicSlug === topic.slug);
  expect(tests.length).toBeGreaterThan(0);
  expect(new Set(tests.flatMap(t => t.questionIds)).size).toBeGreaterThanOrEqual(10);
  for (const t of tests) {
   expect(t.questionIds.length).toBeGreaterThanOrEqual(10);
   for (const id of t.questionIds) expect(byId.get(id)).toMatchObject({ grade: topic.grade, skill: topic.skill, topicSlug: topic.slug });
  }
  const ordered = getTopics(topic.grade, topic.skill).map(t => topicOrder(t.skill, t.slug));
  expect(ordered).toEqual([...ordered].sort((a,b) => a-b));
 }
 expect(bundle.topics.some(t => t.skill === "doc-hieu" && t.slug === "chung")).toBe(true);
 expect(bundle.topics.some(t => t.skill === "viet-cau" && t.slug === "sap-xep-tu")).toBe(true);
});
it("preserves legacy paths or redirects them to an existing same-grade skill mixed page", () => {
 const paths = new Set(getAllRoutes().map(r => r.path));
 const legacy: string[] = JSON.parse(readFileSync("tests/fixtures/legacy-routes.json", "utf8"));
 const redirects: {source: string; destination: string}[] = JSON.parse(readFileSync("content/legacy-redirects.json", "utf8"));
 const output = buildBank(fragments);
 expect(redirects).toEqual(generateLegacyRedirects(legacy, output));
 expect(new Set(redirects.map(r => r.source)).size).toBe(redirects.length);
 for (const old of legacy) {
  if (paths.has(old)) { expect(redirects.some(r => r.source === old)).toBe(false); continue; }
  const redirect = redirects.find(r => r.source === old); expect(redirect, old).toBeDefined();
  expect(paths.has(redirect!.destination)).toBe(true);
  expect(redirect!.destination).toBe(`/${old.split("/").slice(1,3).join("/")}/tong-hop`);
 }
 expect(() => generateLegacyRedirects(["/lop-6/ngu-phap/missing"], {})).toThrow(/destination/i);
});
it("includes every topic page and test in the sitemap, with unique bounded topic metadata", async () => {
 const paths = new Set(getAllRoutes().map(r => r.path)); const urls = new Set(sitemap().map(r => new URL(r.url).pathname));
 const titles: string[] = []; const descriptions: string[] = [];
 for (const topic of bundle.topics) {
  const path = `/lop-${topic.grade}/${topic.skill}/${topic.slug}`; expect(paths.has(path)).toBe(true); expect(urls.has(path)).toBe(true);
  const meta = await generateMetadata({ params: Promise.resolve({ grade: `lop-${topic.grade}`, skill: topic.skill, topic: topic.slug }) });
  expect(typeof meta.title).toBe("string"); expect(`${meta.title as string} | ${SITE.name}`.length).toBeLessThanOrEqual(60);
  expect(meta.description!.length).toBeLessThanOrEqual(155); titles.push(meta.title as string); descriptions.push(meta.description!);
 }
 expect(new Set(titles).size).toBe(titles.length); expect(new Set(descriptions).size).toBe(descriptions.length);
 for (const test of bundle.tests) { expect(paths.has(`/${test.slug}`)).toBe(true); expect(urls.has(`/${test.slug}`)).toBe(true); }
});
it("reproduces report and bank bytes independently of fragment order without mutating inputs", () => {
 const before = structuredClone(fragments); const output = buildBank(fragments);
 expect(buildBank([...fragments].reverse())).toEqual(output);
 for (const [file, data] of Object.entries(output)) expect(readFileSync(join("content/tests", file), "utf8")).toBe(serializeBundle(data));
 const report = generateClassificationReport(fragments, output);
 expect(readFileSync("../docs/topic-classification.md", "utf8")).toBe(report);
 expect(generateClassificationReport([...fragments].reverse(), output)).toBe(report);
 expect(fragments).toEqual(before);
}, 60000);

it("renders knowledge, counts and related links while mixed topics keep their description", async () => {
 const topic = bundle.topics.find(t => t.skill === "ngu-phap" && getTopicDef(t.skill, t.slug))!;
 const html = renderToStaticMarkup(await TopicPage({ params: Promise.resolve({ grade: `lop-${topic.grade}`, skill: topic.skill, topic: topic.slug }) }));
 const def = getTopicDef(topic.skill, topic.slug)!;
 for (const paragraph of def.intro) expect(html).toContain(renderToStaticMarkup(createElement("p", null, paragraph)));
 for (const example of def.examples!) expect(html).toContain(renderToStaticMarkup(createElement("span", { lang: "en" }, example.en)));
 expect(html).toContain(`Chủ đề khác trong ${SKILL_NAMES[topic.skill]} lớp ${topic.grade}`);
 expect(html).toContain("Chủ đề này ở lớp khác"); expect(html).toContain("câu hỏi ·");
 expect(html).toContain("BreadcrumbList"); expect(html).toContain("FAQPage"); expect(html).toContain("Câu hỏi thường gặp");
 expect(html).toContain('href="/lop-6/ngu-phap/tong-hop"');
 const mixed = bundle.topics.find(t => t.grade === topic.grade && t.skill === topic.skill && t.slug === "tong-hop")!;
 const mixedHtml = renderToStaticMarkup(await TopicPage({ params: Promise.resolve({ grade: `lop-${topic.grade}`, skill: topic.skill, topic: "tong-hop" }) }));
 expect(mixedHtml).toContain(mixed.description); expect(mixedHtml).not.toContain('aria-label="Kiến thức cần nhớ"');
 expect(generateStaticParams().map(p => `/${p.grade}/${p.skill}/${p.topic}`).sort()).toEqual(bundle.topics.map(t => `/lop-${t.grade}/${t.skill}/${t.slug}`).sort());
});
it("uses provenance to find context for cloze items without passageId", () => {
 const q = { ...fragments.flatMap(f => f.questions).find(q => q.skill === "tu-vung")!, sourceId: "unit", sourceUrl: "https://example.test/food", stem: "The ___ is here.", options: (["A","B","C","D"] as const).map((key, i) => ({ key, text: ["oven","seem","very","also"][i] })), correctKey: "A" as const, passageId: undefined };
 const passage = { ...fragments.flatMap(f => f.passages)[0], sourceId: q.sourceId, sourceUrl: q.sourceUrl, title: "Cooking meals", body: "oven bread rice kitchen dinner soup bake" };
 expect(classifyEligibleQuestions([q], [passage])[0].question.topicSlug).toBe("am-thuc");
 expect(classifyEligibleQuestions([q], [{ ...passage, sourceId: "other" }])[0].question.topicSlug).toBe("tong-hop");
});
