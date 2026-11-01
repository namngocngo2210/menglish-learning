import type { OptionKey } from "./schemas";
interface ScorableQuestion {
  id: string;
  correctKey: OptionKey;
}
export function isCorrect(
  question: Pick<ScorableQuestion, "correctKey">,
  selectedKey: OptionKey | undefined,
): boolean {
  return selectedKey === question.correctKey;
}
export function scoreTest(
  questions: readonly ScorableQuestion[],
  answers: Record<string, OptionKey | undefined>,
) {
  const perQuestion = questions.map((question) => ({
    questionId: question.id,
    selectedKey: answers[question.id],
    correctKey: question.correctKey,
    correct: isCorrect(question, answers[question.id]),
    answered: answers[question.id] !== undefined,
  }));
  const score = perQuestion.filter((q) => q.correct).length;
  return {
    score,
    total: questions.length,
    percent: questions.length ? (score / questions.length) * 100 : 0,
    perQuestion,
  };
}
export function scoreOutOf10(score: number, total: number): number {
  return total > 0 ? (score / total) * 10 : 0;
}
