import type { Answers, QuizQuestion } from "./sections";

/** Count trailing correct answers among checked questions in display order. */
export function checkedStreak(questions: readonly QuizQuestion[], answers: Answers, checked: Record<string, boolean>): number {
 let streak = 0;
 for (const question of questions) {
  if (checked[question.id]) streak = answers[question.id] === question.correctKey ? streak + 1 : 0;
 }
 return streak;
}
