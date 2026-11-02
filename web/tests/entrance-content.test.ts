import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TestSchema, type ContentBundle } from "@/lib/content/types";
import { getEntranceTests, getEntranceTestWithQuestions, getTestWithQuestions, loadBundle } from "@/lib/content/load";
import { ENTRANCE_PATH, entranceTestPath, parseEntranceSlug, parseTestSlug } from "@/lib/routes";
const dirs: string[] = [];
afterEach(() => { delete process.env.QUESTION_CONTENT_DIR; dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
const entrance = { slug: "thi-vao-lop-10/de-1", grade: 9, kind: "entrance10", title: "Entrance", questionIds: ["q1"], publishedAt: "2026-10-31T00:00:00.000Z", seed: "entry", optionOrder: { q1: "DCAB" } };
it("validates entrance paths without changing four-segment parsing", () => {
 expect(ENTRANCE_PATH).toBe("/grade-10-entrance"); expect(entranceTestPath(3)).toBe("/grade-10-entrance/test-3");
 expect(parseEntranceSlug("thi-vao-lop-10/de-3")).toEqual({ test: "de-3" });
 for (const slug of ["thi-vao-lop-10/de-0", "thi-vao-lop-10/de-01", "thi-vao-lop-10/de-x", "thi-vao-lop-10/de-1/extra"]) expect(parseEntranceSlug(slug)).toBeNull();
 expect(() => entranceTestPath(0)).toThrow(); expect(parseTestSlug(entrance.slug)).toBeNull();
 expect(TestSchema.safeParse(entrance).success).toBe(true);
 for (const override of [{ grade: 8 }, { skill: "tu-vung" }, { topicSlug: "chung" }, { kind: "topic" }, { slug: "lop-9/tu-vung/chung/de-1" }, { optionOrder: { q1: "ABCA" } }]) expect(TestSchema.safeParse({ ...entrance, ...override }).success).toBe(false);
});
function fixture(grade = 8, status = "published") {
 const bank = JSON.parse(readFileSync("content/quarantine/voa-grade-8.json", "utf8")) as ContentBundle;
 const question = { ...bank.questions[0], id: "q1", grade, reviewStatus: status };
 const bundle = { ...bank, questions: [question], tests: [entrance] };
 // References may live in another quarantine fragment.
 const grade6 = JSON.parse(readFileSync("content/quarantine/voa-grade-6.json", "utf8"));
 bundle.topics = bundle.topics.map(t => ({ ...t, grade: grade as 8 }));
 bundle.sources = grade6.sources;
 bundle.passages = [...grade6.passages, ...bank.passages];
 const dir = mkdtempSync(join(process.cwd(), ".entrance-test-")); dirs.push(dir);
 writeFileSync(join(dir, "fixture.json"), JSON.stringify(bundle)); process.env.QUESTION_CONTENT_DIR = dir;
 return bundle;
}
it("loads cross-grade entrance questions and applies options without mutating the bank", () => {
 fixture(); const raw = loadBundle().questions[0]; const original = structuredClone(raw);
 const loaded = getEntranceTestWithQuestions(entrance.slug)!;
 expect(getEntranceTests()).toHaveLength(1); expect(loaded.questions[0].options.map(o => o.text)).toEqual([raw.options[3].text, raw.options[2].text, raw.options[0].text, raw.options[1].text]);
 expect(loaded.questions[0].options.find(o => o.key === loaded.questions[0].correctKey)?.text).toBe(raw.options.find(o => o.key === raw.correctKey)?.text);
 expect(raw).toEqual(original); expect(getTestWithQuestions(entrance.slug)).toEqual(loaded); expect(getEntranceTestWithQuestions("unknown")).toBeUndefined();
});
it("hides entrance tests containing unpublished questions", () => { fixture(8, "quarantine"); expect(getEntranceTests()).toEqual([]); });
it("rejects entrance questions below grade eight", () => { fixture(7); expect(() => loadBundle()).toThrow(/missing or mismatched/); });
