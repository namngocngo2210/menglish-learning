import type { Passage, Question } from "./content/types";
import { applyOptionOrder, mixTest } from "./mixer";
export type PoolQuestion = Pick<Question, "id" | "stem" | "options" | "correctKey" | "explanation" | "passageId" | "difficulty" | "skill">;
export type PoolPassage = Pick<Passage, "id" | "title" | "body" | "wordCount" | "level">;
export interface QuizPool { questions: PoolQuestion[]; passages: PoolPassage[] }
/** Strip bank provenance before serializing quiz data into HTML or pool JSON. */
export function toQuizPool(pool: { questions: readonly PoolQuestion[]; passages: readonly PoolPassage[] }): QuizPool {
 return {
  questions: pool.questions.map(({ id, stem, options, correctKey, explanation, passageId, difficulty, skill }) => ({ id, stem, options, correctKey, explanation, passageId, difficulty, skill })),
  passages: pool.passages.map(({ id, title, body, wordCount, level }) => ({ id, title, body, wordCount, level })),
 };
}
export function buildRandomQuiz(pool: QuizPool, seed: string, size: number) {
 const mixed = mixTest(pool.questions, { seed, size, difficultyMix: { 1: 0.4, 2: 0.4, 3: 0.2 } });
 const byId = new Map(pool.questions.map(q => [q.id, q]));
 const questions = mixed.questionIds.map(id => applyOptionOrder(byId.get(id)!, mixed.optionOrder[id]));
 const ids = [...new Set(questions.flatMap(q => q.passageId ? [q.passageId] : []))];
 return { seed, questions, passages: ids.map(id => pool.passages.find(p => p.id === id)!).filter(Boolean) };
}
