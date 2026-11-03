import { loadBundle } from "./load";
import type { Grade, Skill } from "@/lib/routes";
import { toQuizPool, type QuizPool } from "@/lib/random-quiz";
export function getQuizPool(grade?: Grade, skill?: Skill, topic?: string): QuizPool {
 const bank = loadBundle();
 const questions = bank.questions.filter(q => grade ? q.grade === grade && (!skill || q.skill === skill && (topic === "tong-hop" || q.topicSlug === topic)) : q.grade === 8 || q.grade === 9);
 const ids = new Set(questions.map(q => q.passageId));
 return toQuizPool({ questions, passages: bank.passages.filter(p => ids.has(p.id)) });
}
