import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Quiz } from "@/components/quiz/Quiz";
import type { QuizQuestion } from "@/lib/quiz/sections";

const q = (id: string, passageId?: string): QuizQuestion => ({ id, stem: `Unique stem ${id}`, options: (["A", "B", "C", "D"] as const).map(key => ({ key, text: `${id} option ${key}` })), correctKey: "A", explanation: `Secret explanation ${id}`, passageId });
const passages = [1, 2, 3].map(n => ({ id: `p${n}`, title: `Title ${n}`, body: `Passage body number ${n}.`, wordCount: 4, level: 1 }));

it("server HTML has every passage and question, stacked in section order, with no hidden sections", () => {
 const questions = [q("a1", "p1"), q("a2", "p1"), q("b1", "p2"), q("c1", "p3"), q("s1"), q("s2")];
 const html = renderToStaticMarkup(createElement(Quiz, { questions, passages }));
 for (const p of passages) expect(html).toContain(p.body);
 for (const x of questions) expect(html).toContain(x.stem);
 const order = ["Passage body number 1.", "Unique stem a1", "Passage body number 2.", "Unique stem b1", "Passage body number 3.", "Unique stem c1", "Unique stem s1"].map(s => html.indexOf(s));
 expect(order.every(i => i > 0)).toBe(true);
 expect([...order].sort((a, b) => a - b)).toEqual(order);
 expect(html.match(/<h3[^>]*>Bài đọc \d\/3/g)).toHaveLength(3);
 expect(html).toContain("Câu độc lập");
 expect(html).toContain('aria-label="Các phần của bài"');
 // Inactive sections are only hidden by CSS data attribute; <noscript> style re-displays them.
 expect(html).not.toMatch(/<section[^>]* hidden/);
 expect(html).toContain("<noscript><style>[data-inactive]{display:block!important}");
 expect(html).toContain("<noscript>");
 expect(html).not.toContain("Secret explanation");
 expect(html).not.toContain("Vị trí quảng cáo");
});
