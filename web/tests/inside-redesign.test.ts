import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Breadcrumbs, TestTileList } from "@/components/ui-kit";
import { estimateMinutes, getTestsForTopic, getTopics, loadBundle } from "@/lib/content/load";
import SkillPage from "../app/[grade]/[skill]/page";
import TestPage from "../app/[grade]/[skill]/[topic]/[test]/page";
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("Not found"); } }));

const hash = (items: unknown[]) => createHash("sha256").update(items.map(i => JSON.stringify(i)).sort().join("\n")).digest("hex");
const bank = [6, 7, 8, 9].map(g => JSON.parse(readFileSync(`content/tests/bank-grade-${g}.json`, "utf8")));

it("renaming display names left every question, passage and test composition unchanged", () => {
 // Hashes taken from the bank before the rename; only topic names, titles and descriptions may differ.
 const items = bank.flatMap(b => [...b.questions.map((q: Record<string, unknown>) => [q.id, q.stem, q.options, q.correctKey, q.explanation, q.passageId, q.topicSlug]), ...b.passages.map((p: Record<string, unknown>) => [p.id, p.title, p.body])]);
 const tests = bank.flatMap(b => b.tests.map((t: Record<string, unknown>) => [t.slug, t.grade, t.skill, t.topicSlug, t.kind, t.seed, t.questionIds, t.optionOrder]));
 expect(items).toHaveLength(2748); expect(tests).toHaveLength(295);
 expect(hash(items)).toBe("855239a026bb324803ad8bf4cc36b17f6e7d50bb7f6cf22c9b2e13b56b03fc47");
 expect(hash(tests)).toBe("0bb912538768752f83ea9b55f4ea58c719c11609fe34b8a81f029ad090e5ef12");
});
it("shows reading's two sets as Đề dài / Đề ngắn without touching URLs", () => {
 expect(getTopics(6, "doc-hieu").map(t => [t.slug, t.name])).toEqual([["chung", "Đề dài"], ["tong-hop", "Đề ngắn"]]);
 expect(getTestsForTopic(6, "doc-hieu", "chung")[0].title).toBe("Đề dài - Đề 1");
 expect(getTestsForTopic(6, "doc-hieu", "tong-hop")[0].title).toBe("Đề ngắn - Đề 1");
 expect(getTopics(6, "tu-vung").map(t => t.name)).toEqual(["Tổng hợp Từ vựng"]);
});
it("orders tests numerically and estimates minutes at 0.7/question rounded to 5", () => {
 expect(getTestsForTopic(6, "doc-hieu", "tong-hop").map(t => t.slug.split("de-")[1]).slice(0, 12)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
 expect([10, 22, 26, 3].map(estimateMinutes)).toEqual([5, 15, 20, 5]);
});
it("collapses breadcrumbs to the last two levels on mobile but keeps every level in the DOM", () => {
 const html = renderToStaticMarkup(createElement(Breadcrumbs, { items: [{ label: "Trang chủ", href: "/" }, { label: "Lớp 6", href: "/lop-6" }, { label: "Đọc hiểu", href: "/lop-6/doc-hieu" }, { label: "Đề dài", href: "/x" }, { label: "Đề 1" }] }));
 expect(html).toContain('aria-label="Lên Đọc hiểu"'); expect(html.match(/max-sm:hidden/g)).toHaveLength(3);
 for (const label of ["Trang chủ", "Lớp 6", "Đọc hiểu", "Đề dài", "Đề 1"]) expect(html).toContain(label);
});
it("reserves a status line on every exam tile", () => {
 const html = renderToStaticMarkup(createElement(TestTileList, { items: [{ label: "Đề 1", meta: "22 câu · ~15 phút", href: "/a", progressKey: "a" }] }));
 expect(html).toContain("min-h-5"); expect(html).toContain('data-progress-style="tile"'); expect(html).toContain("grid-cols-2");
});
it("skill page lists the two reading sets once; single-set skills list exams directly", async () => {
 const reading = renderToStaticMarkup(await SkillPage({ params: Promise.resolve({ grade: "lop-6", skill: "doc-hieu" }) }));
 expect(reading).toContain("Đề dài"); expect(reading).toContain("Đề ngắn"); expect(reading).not.toContain("BeeJunior · Luyện tập tiếng Anh");
 expect(reading).toContain('href="/lop-6/doc-hieu/chung"');
 const vocab = renderToStaticMarkup(await SkillPage({ params: Promise.resolve({ grade: "lop-6", skill: "tu-vung" }) }));
 expect(vocab).toContain('href="/lop-6/tu-vung/tong-hop/de-1"'); expect(vocab).not.toContain('href="/lop-6/tu-vung/tong-hop"');
});
it("test page: one H1, one context line, one Cách làm, no repeated intro", async () => {
 const slug = loadBundle().tests.find(t => t.slug === "lop-6/doc-hieu/chung/de-1")!.slug;
 const html = renderToStaticMarkup(await TestPage({ params: Promise.resolve({ grade: "lop-6", skill: "doc-hieu", topic: "chung", test: "de-1" }) }));
 expect(slug).toBeTruthy(); expect(html.match(/<h1/g)).toHaveLength(1); expect(html).toContain("Đọc hiểu lớp 6 · Đề dài 1");
 expect(html.match(/Cách làm/g)).toHaveLength(1); expect(html).not.toContain("Bài luyện của em");
 expect(html).toContain("BreadcrumbList"); expect(html).toContain('"Quiz"'); expect(html).toContain('role="progressbar"');
});
