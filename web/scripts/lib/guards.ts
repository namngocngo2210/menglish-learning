import type { Question } from "../../lib/content/types";

export const GUARD_REASONS = ["duplicate-options", "cloze-inflection", "cloze-equivalent", "verb-equivalent"] as const;
export type GuardReason = typeof GUARD_REASONS[number];
export type GuardReport = { questions: Question[]; counts: Record<GuardReason, number>; excluded: number };

// Alternate spellings of the same past/participle, not general synonyms.
const equivalents = [
 ["learned", "learnt"], ["dreamed", "dreamt"], ["burned", "burnt"],
 ["spilled", "spilt"], ["spoiled", "spoilt"], ["kneeled", "knelt"],
] as const;
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const equivalent = (a: string, b: string) => equivalents.some(group => group.some(word => word === a) && group.some(word => word === b));

// Require a shared root under only simple s/es/ed/ing suffix removal, as well
// as the requested long prefix. Avoid treating arbitrary derivations as inflections.
function inflectionRoots(word: string): Set<string> {
 const roots = new Set([word]);
 // Irregular pair retaining a four-letter prefix; other irregulars are not guessed.
 if (word === "built") roots.add("build");
 for (const suffix of ["s", "es", "ed", "ing"]) {
  if (word.endsWith(suffix) && word.length - suffix.length >= 4) roots.add(word.slice(0, -suffix.length));
 }
 return roots;
}
function sharedInflection(a: string, b: string): boolean {
 if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b) || a === b) return false;
 let prefix = 0;
 while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++;
 if (prefix < Math.max(4, Math.max(a.length, b.length) - 3)) return false;
 const roots = inflectionRoots(b);
 return [...inflectionRoots(a)].some(root => roots.has(root));
}

/** First matching reason wins, so counts sum to distinct excluded questions. */
function exclusionReason(question: Question): GuardReason | undefined {
 const normalized = question.options.map(option => normalize(option.text));
 if (new Set(normalized).size !== normalized.length) return "duplicate-options";
 const kind = question.sourceRef?.match(/\|\s*(content-cloze|reading-cloze|verb-form)\s+\d+\s*$/)?.[1];
 const correct = question.options.find(option => option.key === question.correctKey)!.text.toLowerCase().trim();
 const distractors = question.options.filter(option => option.key !== question.correctKey).map(option => option.text.toLowerCase().trim());
 if (kind === "content-cloze" || kind === "reading-cloze") {
  if (distractors.some(text => sharedInflection(correct, text))) return "cloze-inflection";
  if (distractors.some(text => equivalent(correct, text))) return "cloze-equivalent";
 }
 // A narrowly scoped cheap grammar check: either spelling is a participle
 // immediately after a perfect auxiliary. No attempt at general agreement.
 if (kind === "verb-form" && /\b(?:has|have|had)\s+___\b/i.test(question.stem) && distractors.some(text => equivalent(correct, text))) return "verb-equivalent";
 return undefined;
}

/** Read-only filtering, preserving input order and all original question fields. */
export function guardQuestions(questions: readonly Question[]): GuardReport {
 const counts: Record<GuardReason, number> = { "duplicate-options": 0, "cloze-inflection": 0, "cloze-equivalent": 0, "verb-equivalent": 0 };
 const kept: Question[] = [];
 for (const question of questions) {
  const reason = exclusionReason(question);
  if (reason) counts[reason]++;
  else kept.push(question);
 }
 return { questions: kept, counts, excluded: questions.length - kept.length };
}
