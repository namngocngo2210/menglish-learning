import { expect, it } from "vitest";
import { type Question } from "@/lib/content/types";
import { guardQuestions } from "@/scripts/lib/guards";
const question = (texts: string[], sourceRef = "VOA 123 | content-cloze 0", stem = "They ___ at home."): Question => ({
 id: "guard-fixture", type: "mcq", grade: 6, skill: "tu-vung", topicSlug: "chung", difficulty: 1,
 stem, options: texts.map((text, i) => ({ key: (["A", "B", "C", "D"] as const)[i], text })), correctKey: "A",
 explanation: "Fixture", sourceId: "voa-learning-english", sourceUrl: "https://learningenglish.voanews.com/a/123.html", sourceRef, reviewStatus: "quarantine",
});
it.each([
 [["Hello!", "hello", "world", "other"], "duplicate-options"],
 [["yes", "No!", "no", "maybe"], "duplicate-options"],
 [["worked", "working", "went", "made"], "cloze-inflection"],
 [["walk", "walks", "went", "made"], "cloze-inflection"],
 [["learned", "learnt", "went", "made"], "cloze-equivalent"],
 [["built", "build", "went", "made"], "cloze-inflection"],
] as const)("excludes ambiguous options %j for %s", (options, reason) => {
 const q = question([...options]); const before = structuredClone(q);
 const result = guardQuestions([q]);
 expect(result.questions).toEqual([]); expect(result.counts[reason]).toBe(1); expect(result.excluded).toBe(1);
 expect(q).toEqual(before);
});
it.each([
 ["appealed", "appeared"], ["flower", "flow"], ["station", "state"], ["working", "worker"], ["be", "is"], ["a", "an"], ["much", "many"],
])("keeps non-equivalent or context-dependent options %s/%s", (a, b) => {
 expect(guardQuestions([question([a, b, "went", "made"])]).excluded).toBe(0);
});
it("does not apply cloze inflection checks to grammar or word-order items", () => {
 for (const kind of ["verb-form", "word-order", "word-form", "not-content-cloze"]) {
  expect(guardQuestions([question(["walk", "walks", "went", "made"], `VOA 123 | ${kind} 0`)]).excluded).toBe(0);
 }
});
it("only rejects equivalent verb forms with an obvious perfect auxiliary", () => {
 const options = ["learned", "learnt", "learning", "learns"];
 expect(guardQuestions([question(options, "VOA 123 | verb-form 0", "They have ___ English.")]).counts["verb-equivalent"]).toBe(1);
 expect(guardQuestions([question(options, "VOA 123 | verb-form 0", "They ___ English.")]).excluded).toBe(0);
});
it("counts each exclusion once in fixed rule priority, independent of input order", () => {
 const qs = [question(["walks", "WALKS!", "walking", "went"]), question(["worked", "working", "went", "made"])];
 const result = guardQuestions(qs);
 expect(result.counts).toEqual({ "duplicate-options": 1, "cloze-inflection": 1, "cloze-equivalent": 0, "verb-equivalent": 0 });
 expect(result.excluded).toBe(2); expect(guardQuestions([...qs].reverse()).counts).toEqual(result.counts);
});
