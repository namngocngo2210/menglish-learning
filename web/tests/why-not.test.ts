import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyVerbForm, whyNot } from "@/lib/quiz/why-not";
import { buildBank, ruleOnly } from "@/scripts/lib/build-bank";
import { ContentBundleSchema } from "@/lib/content/types";

const rule = (trigger: string, form: string, base: string) => `Sau “${trigger}”, cấu trúc này dùng ${form} của động từ “${base}”.`;

describe("classifyVerbForm", () => {
 it.each([
  ["turn", "turn", "nguyên thể"], ["turn", "turning", "V-ing"], ["turn", "turns", "-s/-es"], ["turn", "turned", "quá khứ (-ed)"],
  ["make", "making", "V-ing"], ["try", "tries", "-s/-es"], ["try", "tried", "quá khứ (-ed)"], ["travel", "travelled", "quá khứ (-ed)"],
  ["die", "dying", "V-ing"], ["go", "went", "quá khứ đơn"], ["go", "gone", "phân từ quá khứ"], ["tell", "told", "quá khứ / phân từ quá khứ"],
  ["have", "has", "-s/-es"], ["go", "goes", "-s/-es"],
 ])("%s -> %s is %s", (base, word, form) => expect(classifyVerbForm(base, word)).toBe(form));
 it("returns null for unknown words instead of guessing", () => {
  expect(classifyVerbForm("be", "bes")).toBeNull();
  expect(classifyVerbForm("turn", "table")).toBeNull();
 });
});

describe("whyNot", () => {
 it("explains a V-ing distractor after “to”", () => {
  expect(whyNot(rule("to", "dạng nguyên thể", "turn"), "turning")).toBe("Sau “to” cần dạng nguyên thể; “turning” là dạng V-ing.");
 });
 it("explains simple past vs past participle", () => {
  expect(whyNot(rule("had", "dạng phân từ quá khứ", "tear"), "tore")).toBe("Sau “had” cần dạng phân từ quá khứ; “tore” là dạng quá khứ đơn.");
 });
 it("returns null when the rule is not a verb-form rule or the word is unknown", () => {
  expect(whyNot("Chủ ngữ “We” đi với “are” ở hiện tại.", "is")).toBeNull();
  expect(whyNot(rule("will", "dạng nguyên thể", "be"), "bes")).toBeNull();
 });
});

describe("stored explanations", () => {
 const fragments = readdirSync("content/quarantine").filter(f => f.endsWith(".json")).sort().map(f => ContentBundleSchema.parse(JSON.parse(readFileSync(join("content/quarantine", f), "utf8"))));
 const source = new Map(fragments.flatMap(f => f.questions).map(q => [q.id, q]));
 const built = Object.values(buildBank(fragments)).flatMap(b => b.questions);
 it("ruleOnly drops only the “Đáp án đúng là x:” prefix", () => {
  expect(ruleOnly("Đáp án đúng là “see”: Sau “will”, cấu trúc này dùng dạng nguyên thể của động từ “see”.")).toBe("Sau “will”, cấu trúc này dùng dạng nguyên thể của động từ “see”.");
  expect(ruleOnly("Sau “to”, ...")).toBe("Sau “to”, ...");
 });
 it("changes only the explanation text: ids, stems, options and keys stay as in the source", () => {
  expect(built.length).toBeGreaterThan(1000);
  for (const q of built) {
   const original = source.get(q.id)!;
   expect(q.stem).toBe(original.stem); expect(q.options).toEqual(original.options); expect(q.correctKey).toBe(original.correctKey);
   expect(q.explanation).not.toMatch(/^Đáp án đúng/);
   expect(q.explanation.length).toBeGreaterThan(0);
  }
 });
});
