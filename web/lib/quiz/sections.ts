import type { OptionKey, Question } from "../content/types";
import type { PoolPassage } from "../random-quiz";

export type QuizQuestion = Pick<Question, "id" | "stem" | "options" | "correctKey" | "explanation" | "passageId">;
export interface QuizSection {
 id: string;
 kind: "passage" | "standalone";
 /** Short navigator label, e.g. "Bài đọc 1/3". */
 label: string;
 passage?: PoolPassage;
 questions: QuizQuestion[];
}
export type Answers = Record<string, OptionKey | undefined>;

/**
 * Group a flat question list into ordered sections: one per passage (order of first
 * appearance, questions kept contiguous) plus one trailing block of standalone questions.
 */
export function buildSections(questions: readonly QuizQuestion[], passages: readonly PoolPassage[] = []): QuizSection[] {
 const byId = new Map(passages.map(p => [p.id, p]));
 const groups = new Map<string, QuizQuestion[]>();
 const standalone: QuizQuestion[] = [];
 for (const q of questions) {
  if (q.passageId && byId.has(q.passageId)) groups.set(q.passageId, [...(groups.get(q.passageId) ?? []), q]);
  else standalone.push(q);
 }
 const total = groups.size;
 const sections: QuizSection[] = [...groups.entries()].map(([passageId, qs], index) => ({
  id: `section-${passageId}`, kind: "passage", label: `Bài đọc ${index + 1}/${total}`, passage: byId.get(passageId)!, questions: qs,
 }));
 if (standalone.length) sections.push({ id: "section-standalone", kind: "standalone", label: total ? "Câu độc lập" : "Bài tập", questions: standalone });
 return sections;
}
/** Display numbers (1..N) following section order. */
export function numberQuestions(sections: readonly QuizSection[]): Record<string, number> {
 const numbers: Record<string, number> = {};
 let n = 0;
 for (const s of sections) for (const q of s.questions) numbers[q.id] = ++n;
 return numbers;
}
export function flattenSections(sections: readonly QuizSection[]): QuizQuestion[] { return sections.flatMap(s => s.questions); }
export function sectionProgress(section: QuizSection, answers: Answers): { answered: number; total: number } {
 return { answered: section.questions.filter(q => answers[q.id] !== undefined).length, total: section.questions.length };
}
export function unansweredIds(sections: readonly QuizSection[], answers: Answers): string[] {
 return flattenSections(sections).filter(q => answers[q.id] === undefined).map(q => q.id);
}
