// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within, fireEvent } from "@testing-library/react";
import { Quiz } from "@/components/quiz/Quiz";
import { SectionedPractice } from "@/components/quiz/SectionedPractice";
import { buildSections, type QuizQuestion } from "@/lib/quiz/sections";

const q = (id: string, passageId?: string): QuizQuestion => ({ id, stem: `Stem ${id}`, options: (["A", "B", "C", "D"] as const).map(key => ({ key, text: `${id} opt ${key}` })), correctKey: "A", explanation: `Giải thích ${id}`, passageId });
const passages = [1, 2].map(n => ({ id: `p${n}`, title: `Title ${n}`, body: `Body ${n}`, wordCount: 2, level: 1 }));
const questions = [q("a1", "p1"), q("a2", "p1"), q("b1", "p2"), q("s1")];
const mount = (props = {}) => render(createElement(Quiz, { questions, passages, progressKey: "demo", ...props }));
const section = (id: string) => document.getElementById(`section-${id}`)!;
const hidden = (el: HTMLElement) => el.hasAttribute("data-inactive");
const pick = (id: string, key = "A") => fireEvent.click(document.querySelector(`input[name="quiz-${id}"][value="${key}"]`)!);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("sectioned quiz", () => {
 it("shows one section at a time and navigates with next/prev and the navigator", () => {
  mount();
  expect(hidden(section("p1"))).toBe(false);
  expect(hidden(section("p2"))).toBe(true);
  expect(hidden(section("standalone"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Phần sau/ }));
  expect(hidden(section("p2"))).toBe(false);
  expect(hidden(section("p1"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Phần trước/ }));
  expect(hidden(section("p1"))).toBe(false);
  const nav = screen.getByRole("navigation", { name: "Các phần của bài" });
  fireEvent.click(within(nav).getByText("Câu độc lập"));
  expect(hidden(section("standalone"))).toBe(false);
  expect(screen.getByRole("button", { name: /Phần sau/ }).hasAttribute("disabled")).toBe(true);
  expect(within(nav).getByText("Câu độc lập").closest("a")?.getAttribute("aria-current")).toBe("step");
 });
 it("renders per-section progress text", () => {
  mount();
  pick("a1");
  const nav = screen.getByRole("navigation", { name: "Các phần của bài" });
  expect(within(nav).getAllByText(/đã làm/).map(n => n.textContent)).toEqual(["1/2 đã làm", "0/1 đã làm", "0/1 đã làm"]);
 });
 it("gives desktop panes their own overflow container, focus stop and labels", () => {
  mount();
  const passagePane = document.getElementById("passage-pane-p1")!;
  const questionPane = screen.getByLabelText("Câu hỏi của Bài đọc 1/2");
  for (const pane of [passagePane, questionPane]) {
   expect(pane.tagName).toBe("SECTION");
   expect(pane.getAttribute("tabindex")).toBe("0");
   expect(pane.className).toContain("lg:overflow-y-auto");
   expect(pane.className).not.toContain("overscroll-contain");
  }
  expect(passagePane.getAttribute("aria-labelledby")).toBe("passage-p1");
  expect(document.getElementById("passage-p1")?.textContent).toBe("Title 1");
  expect(passagePane.querySelector("div.lg\\:sticky")).not.toBeNull();
  // Mobile: no nested scroll container, the page scrolls naturally.
  expect(document.querySelector("[data-quiz-sections] .overflow-y-auto:not([class*='lg:'])")).toBeNull();
 });
 it("collapses and expands the passage on mobile", () => {
  mount();
  const toggle = screen.getAllByRole("button", { name: "Ẩn bài đọc" })[0];
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(document.getElementById("passage-body-p1")?.className).toContain("max-lg:hidden");
  fireEvent.click(screen.getAllByRole("button", { name: "Xem bài đọc" })[0]);
  expect(document.getElementById("passage-body-p1")?.className).not.toContain("max-lg:hidden");
 });
 it("checks an answer, shows Vietnamese explanation and locks it", () => {
  mount();
  pick("a1", "B");
  fireEvent.click(screen.getAllByRole("button", { name: /Kiểm tra/ })[0]);
  expect(screen.getByText("Giải thích a1")).toBeTruthy();
  expect(document.querySelector<HTMLFieldSetElement>("#question-a1 fieldset")!.disabled).toBe(true);
 });
 it("asks for confirmation listing unanswered questions before submit", () => {
  mount();
  pick("a1");
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  const dialog = (document.querySelector("dialog[open]") as HTMLElement);
  expect(dialog.textContent).toContain("Em còn 3 câu chưa làm");
  expect(dialog.textContent).toContain("Bài đọc 1/2: còn 1 câu");
  expect(dialog.textContent).toContain("Câu độc lập: còn 1 câu");
  fireEvent.click(within(dialog).getByRole("button", { name: "Quay lại làm tiếp" }));
  expect(screen.queryByText("Kết quả của em")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  fireEvent.click(within((document.querySelector("dialog[open]") as HTMLElement)).getByRole("button", { name: "Nộp bài" }));
  expect(screen.getByText("Kết quả của em")).toBeTruthy();
  expect(screen.getByText("1/4")).toBeTruthy();
 });
 it("overview marks answered and unanswered questions and jumps to a section", () => {
  mount();
  pick("a1");
  fireEvent.click(screen.getByRole("button", { name: /Tổng quan/ }));
  const dialog = (document.querySelector("dialog[open]") as HTMLElement);
  expect(within(dialog).getAllByText(/chưa làm/).length).toBe(3);
  expect(within(dialog).getByText("đã làm", { selector: ".sr-only" }).textContent).toContain("đã làm");
  fireEvent.click(within(dialog).getByRole("button", { name: /^4/ }));
  expect(hidden(section("standalone"))).toBe(false);
 });
 it("persists answers and the active section across a remount", () => {
  const first = mount();
  pick("a1", "C");
  fireEvent.click(screen.getByRole("button", { name: /Phần sau/ }));
  pick("b1", "D");
  first.unmount();
  mount();
  expect(document.querySelector<HTMLInputElement>('input[name="quiz-a1"][value="C"]')!.checked).toBe(true);
  expect(document.querySelector<HTMLInputElement>('input[name="quiz-b1"][value="D"]')!.checked).toBe(true);
  expect(hidden(section("p2"))).toBe(false);
  expect(screen.getByText("Đã khôi phục bài làm đang dở.")).toBeTruthy();
 });
 it("clears saved state after submit", () => {
  mount();
  pick("a1");
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  fireEvent.click(within((document.querySelector("dialog[open]") as HTMLElement)).getByRole("button", { name: "Nộp bài" }));
  expect(localStorage.getItem("ml:quiz:v1:demo")).toBeNull();
 });
});

describe("SectionedPractice (presentational)", () => {
 it("hides check buttons and explanations in feedback=none mode", () => {
  const sections = buildSections(questions, passages);
  render(createElement(SectionedPractice, { sections, answers: { a1: "A" }, checked: { a1: true }, feedback: "none", activeIndex: 0, onActiveChange: () => {}, onSelect: () => {} }));
  expect(screen.queryByRole("button", { name: /Kiểm tra/ })).toBeNull();
  expect(screen.queryByText("Giải thích a1")).toBeNull();
 });
 it("is controlled: reports selections and section changes without owning state", () => {
  const sections = buildSections(questions, passages);
  const events: string[] = [];
  render(createElement(SectionedPractice, { sections, answers: {}, checked: {}, activeIndex: 0, onActiveChange: i => events.push(`s${i}`), onSelect: (id, key) => events.push(`${id}${key}`) }));
  pick("a1", "D");
  fireEvent.click(screen.getByRole("button", { name: /Phần sau/ }));
  expect(events).toEqual(["a1D", "s1"]);
 });
});
