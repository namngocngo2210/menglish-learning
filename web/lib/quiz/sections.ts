import type { OptionKey, Question } from "../content/types";
import type { PoolPassage } from "../random-quiz";

/** What a question needs to be displayed. Live rooms only ever hold this (no answer key, no explanation). */
export type DisplayQuestion = Pick<Question, "id" | "stem" | "options" | "passageId">;
export type DisplayPassage = Pick<PoolPassage, "id" | "title" | "body" | "wordCount">;
export type QuizQuestion = DisplayQuestion & Pick<Question, "correctKey" | "explanation">;
export interface QuizSection<Q extends DisplayQuestion = QuizQuestion> {
 id: string;
 kind: "passage" | "standalone";
 /** Short navigator label, e.g. "Bài đọc 1/3". */
 label: string;
 passage?: DisplayPassage;
 questions: Q[];
}
export type Answers = Record<string, OptionKey | undefined>;

/**
 * Group a flat question list into ordered sections: one per passage (order of first
 * appearance, questions kept contiguous) plus one trailing block of standalone questions.
 */
export function buildSections<Q extends DisplayQuestion = QuizQuestion>(questions: readonly Q[], passages: readonly DisplayPassage[] = []): QuizSection<Q>[] {
 const byId = new Map(passages.map(p => [p.id, p]));
 const groups = new Map<string, Q[]>();
 const standalone: Q[] = [];
 for (const q of questions) {
  if (q.passageId && byId.has(q.passageId)) groups.set(q.passageId, [...(groups.get(q.passageId) ?? []), q]);
  else standalone.push(q);
 }
 const total = groups.size;
 const sections: QuizSection<Q>[] = [...groups.entries()].map(([passageId, qs], index) => ({
  id: `section-${passageId}`, kind: "passage", label: `Bài đọc ${index + 1}/${total}`, passage: byId.get(passageId)!, questions: qs,
 }));
 if (standalone.length) sections.push({ id: "section-standalone", kind: "standalone", label: total ? "Câu độc lập" : "Bài tập", questions: standalone });
 return sections;
}
/** Display numbers (1..N) following section order. */
export function numberQuestions(sections: readonly QuizSection<DisplayQuestion>[]): Record<string, number> {
 const numbers: Record<string, number> = {};
 let n = 0;
 for (const s of sections) for (const q of s.questions) numbers[q.id] = ++n;
 return numbers;
}
export function flattenSections<Q extends DisplayQuestion = QuizQuestion>(sections: readonly QuizSection<Q>[]): Q[] { return sections.flatMap(s => s.questions); }
export function sectionProgress(section: QuizSection<DisplayQuestion>, answers: Answers): { answered: number; total: number } {
 return { answered: section.questions.filter(q => answers[q.id] !== undefined).length, total: section.questions.length };
}
export function unansweredIds(sections: readonly QuizSection<DisplayQuestion>[], answers: Answers): string[] {
 return flattenSections(sections).filter(q => answers[q.id] === undefined).map(q => q.id);
}
