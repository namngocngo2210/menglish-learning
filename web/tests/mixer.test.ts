import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/content/types";
import { applyOptionOrder, createRng, mixTest, partitionTests, shuffle } from "@/lib/mixer";
const question = (i: number, extra: Partial<Question> = {}): Question => ({
 id: `q-${String(i).padStart(3, "0")}`, type: "mcq", grade: 9, skill: "tu-vung", topicSlug: "chung", difficulty: (i % 3 + 1),
 stem: `Question ${i}`, options: [{ key: "A", text: "one" }, { key: "B", text: "two" }, { key: "C", text: "three" }, { key: "D", text: "four" }],
 correctKey: "C", explanation: "Explanation", sourceId: "voa", sourceUrl: "https://example.com", reviewStatus: "published", ...extra,
});
const pool = Array.from({ length: 90 }, (_, i) => question(i));
describe("seeded mixer", () => {
 it("is deterministic, independent of input order, and changes with the seed", () => {
  const a = mixTest(pool, { seed: "one", size: 20 });
  expect(mixTest(pool, { seed: "one", size: 20 })).toEqual(a);
  expect(mixTest([...pool].reverse(), { seed: "one", size: 20 })).toEqual(a);
  expect(mixTest(pool, { seed: "two", size: 20 }).questionIds).not.toEqual(a.questionIds);
  expect(new Set(a.questionIds).size).toBe(20);
  const before = structuredClone(pool); shuffle(pool, createRng("x")); expect(pool).toEqual(before);
 });
 it("shuffles valid permutations and preserves correct option text without mutation", () => {
  const before = structuredClone(pool);
  const result = mixTest(pool, { seed: "options", size: 60 });
  expect(Object.values(result.optionOrder).some(order => order !== "ABCD")).toBe(true);
  const positions = new Set<string>();
  for (const q of pool.filter(q => result.questionIds.includes(q.id))) {
   const order = result.optionOrder[q.id]; expect([...order].sort().join("")).toBe("ABCD");
   const mapped = applyOptionOrder(q, order);
   expect(mapped.options.map(o => o.key)).toEqual(["A", "B", "C", "D"]);
   expect(mapped.options.find(o => o.key === mapped.correctKey)?.text).toBe("three"); positions.add(mapped.correctKey);
  }
  expect(positions.size).toBeGreaterThan(1); expect(pool).toEqual(before);
  expect(applyOptionOrder(question(0), "DCAB").correctKey).toBe("B");
  for (const invalid of ["AAAA", "ABC", "ABCDE", "abcd"]) expect(() => applyOptionOrder(question(0), invalid)).toThrow();
 });
 it("keeps passage groups whole and adjacent, with at most eight overflow questions", () => {
  const grouped = pool.slice(0, 12).map((q, i) => ({ ...q, passageId: `p${Math.floor(i / 4)}` }));
  const result = mixTest(grouped, { seed: "groups", size: 6 }); expect(result.questionIds).toHaveLength(8);
  for (const p of ["p0", "p1", "p2"]) {
   const indices = result.questionIds.map((id, i) => grouped.find(q => q.id === id)?.passageId === p ? i : -1).filter(i => i >= 0);
   if (indices.length) { expect(indices).toHaveLength(4); expect(indices.at(-1)! - indices[0]).toBe(3); }
  }
  const large = pool.slice(0, 15).map(q => ({ ...q, passageId: "big" }));
  expect(mixTest(large, { seed: "large", size: 10 }).questionIds).toHaveLength(8);
 });
 it("deduplicates normalized stems and ids and respects exclusions", () => {
  const duplicates = [question(1), question(1), question(2, { stem: "  QUESTION   1  " }), question(3), question(4)];
  const result = mixTest(duplicates, { seed: "dedupe", size: 20, excludeIds: new Set(["q-003"]) });
  expect(result.questionIds.sort()).toEqual(["q-001", "q-004"]);
 });
 it("honours available difficulty and skill fractions and fills absent levels", () => {
  const result = mixTest(pool, { seed: "levels", size: 20, difficultyMix: { 1: .5, 2: .3, 3: .2 } });
  expect([1, 2, 3].map(d => result.questionIds.filter(id => pool.find(q => q.id === id)!.difficulty === d).length)).toEqual([10, 6, 4]);
  expect(mixTest(pool.filter(q => q.difficulty === 1), { seed: "missing", size: 20, difficultyMix: { 3: 1 } }).questionIds).toHaveLength(20);
  const skills = pool.map((q, i) => ({ ...q, skill: i < 45 ? "tu-vung" as const : "ngu-phap" as const }));
  const mixed = mixTest(skills, { seed: "skills", size: 20, skillMix: { "tu-vung": .3, "ngu-phap": .7 } });
  expect(mixed.questionIds.filter(id => skills.find(q => q.id === id)!.skill === "tu-vung")).toHaveLength(6);
 });
 it("partitions with zero overlap, stable numbered seeds, and bounded tails", () => {
  for (const count of [0, 5, 20, 25, 29, 43, 90]) {
   const tests = partitionTests(pool.slice(0, count), { seedPrefix: "topic", size: 20, minSize: 10 });
   const ids = tests.flatMap(t => t.questionIds); expect(new Set(ids).size).toBe(ids.length);
   tests.forEach((t, i) => { expect(t.seed).toBe(`topic/de-${i + 1}`); expect(t.questionIds.length).toBeGreaterThanOrEqual(10); expect(t.questionIds.length).toBeLessThanOrEqual(28); });
   if (count === 25) expect(tests[0].questionIds).toHaveLength(25);
   if (count === 29) expect(ids).toHaveLength(20);
  }
  const grouped = pool.map((q, i) => ({ ...q, passageId: `p${Math.floor(i / 13)}` }));
  const tests = partitionTests(grouped, { seedPrefix: "passages", size: 20, minSize: 10 });
  expect(new Set(tests.flatMap(t => t.questionIds)).size).toBe(tests.reduce((n, t) => n + t.questionIds.length, 0));
  expect(tests.every(t => t.questionIds.length <= 28)).toBe(true);
 });
 it("handles empty pools and rejects invalid sizes", () => {
  expect(mixTest([], { seed: "empty", size: 10 }).questionIds).toEqual([]);
  expect(() => mixTest(pool, { seed: "invalid", size: 0 })).toThrow();
  expect(() => partitionTests(pool, { seedPrefix: "invalid", size: 10, minSize: 11 })).toThrow();
 });
});
