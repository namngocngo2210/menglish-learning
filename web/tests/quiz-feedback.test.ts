// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SectionedPractice } from "@/components/quiz/SectionedPractice";
import { buildSections, type QuizQuestion } from "@/lib/quiz/sections";
import type { OptionKey } from "@/lib/content/types";

const rule = "Sau “to”, cấu trúc này dùng dạng nguyên thể của động từ “turn”.";
const make = (explanation = rule): QuizQuestion => ({
 id: "q1", stem: "They began to ___ the boat toward the beach.", correctKey: "D", explanation,
 options: [{ key: "A", text: "turning" }, { key: "B", text: "turns" }, { key: "C", text: "table" }, { key: "D", text: "turn" }],
} as QuizQuestion);
function feedback(selected: OptionKey | undefined, question = make(), feedbackMode: "per-question" | "none" = "per-question") {
 const { container } = render(createElement(SectionedPractice, {
  sections: buildSections([question], []), answers: selected ? { q1: selected } : {}, checked: { q1: true }, feedback: feedbackMode,
  activeIndex: 0, onActiveChange: () => {}, onSelect: () => {},
 }));
 return container.querySelector("#feedback-q1")!;
}
const count = (text: string, needle: string) => text.split(needle).length - 1;
afterEach(cleanup);

describe("answer feedback", () => {
 it("correct: confirms and gives only the rule", () => {
  const box = feedback("D"); const text = box.textContent!;
  expect(text).toContain("Chính xác!"); expect(text).toContain(rule);
  expect(text).not.toContain("Đáp án đúng"); expect(text).not.toContain("chưa đúng"); expect(text).not.toContain("chưa phù hợp");
 });
 it("wrong: names the choice, states the key once, explains why it is right and why the choice is not", () => {
  const box = feedback("A"); const text = box.textContent!;
  expect(text).toContain("Chưa đúng — đáp án: D. turn");
  expect(count(text, "Đáp án đúng")).toBe(0); expect(count(text, "D. turn")).toBe(1);
  expect(text).toContain(`Vì sao đúng: ${rule}`);
  expect(text).toContain("Vì sao “turning” chưa phù hợp: Sau “to” cần dạng nguyên thể; “turning” là dạng V-ing.");
  expect(count(text, "Đáp án đúng là")).toBe(0);
 });
 it("wrong without a safe rule: neutral line, no invented reason", () => {
  const text = feedback("C").textContent!;
  expect(text).toContain("Phương án “C. table” chưa phù hợp với cấu trúc của câu.");
  expect(text).not.toContain("Vì sao “table”");
  const vocab = feedback("A", make("Từ trong bài gốc phù hợp với ngữ cảnh.")).textContent!;
  expect(vocab).toContain("Phương án “A. turning” chưa phù hợp với cấu trúc của câu.");
 });
 it("unanswered: says so, then key and rule", () => {
  const text = feedback(undefined).textContent!;
  expect(text).toContain("Em chưa chọn đáp án."); expect(text).toContain("Đáp án đúng: D. turn"); expect(text).toContain(rule);
  expect(text).not.toContain("chưa phù hợp");
 });
 it("keeps the polite live region and renders nothing in mode none", () => {
  cleanup();
  expect(feedback("A").getAttribute("aria-live")).toBe("polite");
  cleanup();
  const { container } = render(createElement(SectionedPractice, {
   sections: buildSections([make()], []), answers: { q1: "A" }, checked: { q1: true }, feedback: "none", activeIndex: 0, onActiveChange: () => {}, onSelect: () => {},
  }));
  expect(container.querySelector("#feedback-q1")).toBeNull();
 });
});
