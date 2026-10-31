import { describe, expect, it } from "vitest";
import { buildSections, flattenSections, numberQuestions, sectionProgress, unansweredIds, type QuizQuestion } from "@/lib/quiz/sections";
import { buildRandomQuiz } from "@/lib/random-quiz";
import { readQuiz, writeQuiz, clearQuiz } from "@/lib/quiz/persist";

const opts = (id: string) => (["A", "B", "C", "D"] as const).map(key => ({ key, text: `${id}-${key}` }));
const q = (id: string, passageId?: string): QuizQuestion => ({ id, stem: `Stem ${id}`, options: opts(id), correctKey: "A", explanation: "x", passageId });
const passages = ["p1", "p2"].map(id => ({ id, title: `T ${id}`, body: `Body ${id}`, wordCount: 2, level: 1 }));

describe("buildSections", () => {
 it("groups questions per passage in first-appearance order and keeps standalone last", () => {
  const sections = buildSections([q("a", "p2"), q("s1"), q("b", "p1"), q("c", "p2"), q("s2")], passages);
  expect(sections.map(s => [s.label, s.questions.map(x => x.id)])).toEqual([["Bài đọc 1/2", ["a", "c"]], ["Bài đọc 2/2", ["b"]], ["Câu độc lập", ["s1", "s2"]]]);
  expect(sections[0].passage?.id).toBe("p2");
  expect(sections.at(-1)?.kind).toBe("standalone");
 });
 it("labels a passage-free test as a plain exercise block", () => {
  const sections = buildSections([q("a"), q("b")]);
  expect(sections).toHaveLength(1);
  expect(sections[0].label).toBe("Bài tập");
 });
 it("numbers questions in section order and reports progress", () => {
  const sections = buildSections([q("s1"), q("a", "p1"), q("b", "p1")], passages);
  expect(numberQuestions(sections)).toEqual({ a: 1, b: 2, s1: 3 });
  expect(flattenSections(sections).map(x => x.id)).toEqual(["a", "b", "s1"]);
  expect(sectionProgress(sections[0], { a: "B" })).toEqual({ answered: 1, total: 2 });
  expect(unansweredIds(sections, { a: "B" })).toEqual(["b", "s1"]);
 });
 it("keeps every passage's questions together for mixer output", () => {
  const questions = Array.from({ length: 24 }, (_, i) => ({ ...q(`q${String(i).padStart(2, "0")}`, i < 18 ? `p${(i % 3) + 1}` : undefined), difficulty: 1 + (i % 3), skill: i < 18 ? "doc-hieu" as const : "ngu-phap" as const }));
  const pool = { questions, passages: ["p1", "p2", "p3"].map(id => ({ id, title: id, body: id, wordCount: 1, level: 1 })) };
  for (const seed of ["a", "b", "c", "d"]) {
   const mixed = buildRandomQuiz(pool, seed, 12);
   const sections = buildSections(mixed.questions, mixed.passages);
   const seen = new Set<string>();
   for (const section of sections.filter(s => s.kind === "passage")) {
    expect(section.questions.every(x => x.passageId === section.passage!.id)).toBe(true);
    expect(seen.has(section.passage!.id)).toBe(false);
    seen.add(section.passage!.id);
   }
   expect(flattenSections(sections)).toHaveLength(mixed.questions.length);
   // The mixer emits each passage group contiguously, so grouping never reorders within a passage.
   const order = mixed.questions.filter(x => x.passageId).map(x => x.passageId);
   expect(order.join().replace(/(p\d),(?=\1)/g, "")).toBe([...new Set(order)].join());
  }
 });
});

describe("quiz persistence", () => {
 const memory = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data }; };
 it("round-trips answers and drops unknown ids or keys", () => {
  const store = memory();
  writeQuiz("t1", { answers: { a: "B", z: "C" }, checked: { a: true, z: true }, active: 2 }, store);
  expect(readQuiz("t1", ["a", "b"], store)).toEqual({ answers: { a: "B" }, checked: { a: true }, active: 2 });
  store.setItem("ml:quiz:v1:t2", JSON.stringify({ v: 1, answers: { a: "Z" }, checked: {}, active: 0 }));
  expect(readQuiz("t2", ["a"], store)).toBeUndefined();
 });
 it("ignores corrupt data, wrong versions and clears", () => {
  const store = memory();
  store.setItem("ml:quiz:v1:bad", "{nope");
  expect(readQuiz("bad", ["a"], store)).toBeUndefined();
  store.setItem("ml:quiz:v1:old", JSON.stringify({ v: 2, answers: { a: "A" } }));
  expect(readQuiz("old", ["a"], store)).toBeUndefined();
  writeQuiz("t3", { answers: { a: "A" }, checked: {}, active: 0 }, store);
  clearQuiz("t3", store);
  expect(readQuiz("t3", ["a"], store)).toBeUndefined();
 });
 it("swallows storage failures", () => {
  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("denied"); } };
  expect(() => writeQuiz("x", { answers: {}, checked: {}, active: 0 }, broken)).not.toThrow();
  expect(readQuiz("x", [], broken)).toBeUndefined();
  expect(() => clearQuiz("x", broken)).not.toThrow();
 });
});
