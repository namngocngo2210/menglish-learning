import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScoreRing, ResultStars } from "@/components/quiz/ScoreRing";
import { SectionedPractice } from "@/components/quiz/SectionedPractice";
import { Mascot } from "@/components/art/Mascot";
import { resultPose, starCount, STAR_THRESHOLDS, TROPHY_THRESHOLD } from "@/lib/quiz/result-visual";
import { checkedStreak } from "@/lib/quiz/streak";
import { buildSections, type QuizQuestion } from "@/lib/quiz/sections";
const question: QuizQuestion = { id: "q1", stem: "They began to ___ the boat.", correctKey: "B", options: [{ key: "A", text: "turning" }, { key: "B", text: "turn" }], explanation: "Sau “to”, cấu trúc này dùng dạng nguyên thể của động từ “turn”." };
const externalRefs = /\bhref=|xlink:href|url\(http|<image/i;
describe("result visuals", () => {
 it.each([[49, 1], [50, 2], [84, 2], [85, 3]])("%i percent earns %i stars", (percent, stars) => {
  expect(starCount(percent)).toBe(stars);
  const markup = renderToStaticMarkup(createElement(ResultStars, { percent }));
  expect(markup.match(/<path/g)).toHaveLength(stars);
  expect(markup).not.toMatch(externalRefs);
 });
 it("exports thresholds and switches mascot at 60 percent", () => {
  expect(STAR_THRESHOLDS).toEqual([50, 85]); expect(TROPHY_THRESHOLD).toBe(60);
  expect(resultPose(59)).toBe("thinking"); expect(resultPose(60)).toBe("trophy");
 });
 it.each([0, 49, 50, 59, 60, 84, 85, 100])("reserves the ring and draws %i percent", percent => {
  const markup = renderToStaticMarkup(createElement(ScoreRing, { score: 7, total: 10, percent }));
  expect(markup).toContain('width="144" height="144"');
  expect(markup).toContain(`stroke-dasharray="${percent} 100"`);
  expect(markup).toContain("7/10"); expect(markup).toContain(`${percent}%`);
  expect(markup).toContain('aria-hidden="true"'); expect(markup).not.toMatch(externalRefs);
 });
 it("reuses original mascot artwork without external references", () => {
  for (const pose of ["correct", "oops", "trophy", "thinking", "sleepy", "group"] as const) expect(renderToStaticMarkup(createElement(Mascot, { pose, size: 48 }))).not.toMatch(externalRefs);
 });
});
describe("checked streak in question order", () => {
 const questions = ["a", "b", "c", "d"].map(id => ({ ...question, id }));
 it("ignores unchecked questions, including selected answers", () => {
  expect(checkedStreak(questions, { a: "B", b: "A", c: "B" }, { a: true, c: true })).toBe(2);
  expect(checkedStreak(questions, { a: "B" }, {})).toBe(0);
 });
 it("counts only trailing correct checked answers regardless of checking order", () => {
  expect(checkedStreak(questions, { a: "B", b: "A", c: "B", d: "B" }, { d: true, c: true, b: true, a: true })).toBe(2);
  expect(checkedStreak(questions, { a: "B", b: "A" }, { a: true, b: true })).toBe(0);
  expect(checkedStreak(questions, {}, { a: true })).toBe(0);
 });
});
describe("illustrated feedback", () => {
 it.each([["B", "correct"], ["A", "oops"], [undefined, undefined]] as const)("renders %s feedback", (selected, pose) => {
  const html = renderToStaticMarkup(createElement(SectionedPractice, { sections: buildSections([question]), answers: { q1: selected }, checked: { q1: true }, activeIndex: 0, onActiveChange: () => {}, onSelect: () => {} }));
  const feedback = html.slice(html.indexOf('id="feedback-q1"'));
  if (pose) expect(feedback).toContain(renderToStaticMarkup(createElement(Mascot, { pose, size: 48 })));
  else { expect(feedback).toContain("Em chưa chọn đáp án."); expect(feedback).not.toContain('viewBox="0 0 120 120"'); }
  expect(feedback).toContain(question.explanation);
  if (selected === "A") { expect(feedback).toContain("Vì sao đúng:"); expect(feedback).toContain("chưa phù hợp:"); expect(feedback).toContain("là dạng V-ing."); }
  expect(feedback).not.toMatch(externalRefs);
 });
});
