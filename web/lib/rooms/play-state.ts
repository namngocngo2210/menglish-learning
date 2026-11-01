import type { OptionKey } from "../content/types";
import { buildSections, type DisplayQuestion, type QuizSection } from "../quiz/sections";
import type { QuizResponse } from "./types";

/** The play screen only ever holds display data: this adapter has no way to carry an answer key. */
export function toRoomSections(quiz: QuizResponse): QuizSection<DisplayQuestion>[] {
 const questions: DisplayQuestion[] = quiz.questions.map(q => ({
  id: q.id, stem: q.stem, passageId: q.passageId ?? undefined,
  options: q.options.map(o => ({ key: o.key as OptionKey, text: o.text })),
 }));
 const passages = quiz.passages.map(p => ({ id: p.id, title: p.title, body: p.body, wordCount: p.body.trim().split(/\s+/).filter(Boolean).length }));
 return buildSections(questions, passages);
}

const KEYS: readonly string[] = ["A", "B", "C", "D"];
const isKey = (k: unknown): k is OptionKey => typeof k === "string" && KEYS.includes(k);

export interface PlayState {
 answers: Record<string, OptionKey | undefined>;
 /** Choices not yet confirmed by the server (retried until saved). */
 unsynced: Record<string, OptionKey>;
}
export type PlayAction =
 | { type: "restore"; answers: Record<string, string> }
 | { type: "select"; id: string; key: OptionKey }
 | { type: "synced"; id: string; key: OptionKey };
export const initialPlay: PlayState = { answers: {}, unsynced: {} };

export function playReducer(s: PlayState, a: PlayAction): PlayState {
 switch (a.type) {
  case "restore": {
   // Server copy is the base; choices made locally but not yet saved win over it.
   const answers: PlayState["answers"] = {};
   for (const [id, key] of Object.entries(a.answers)) if (isKey(key)) answers[id] = key;
   return { answers: { ...answers, ...s.unsynced }, unsynced: s.unsynced };
  }
  case "select": return { answers: { ...s.answers, [a.id]: a.key }, unsynced: { ...s.unsynced, [a.id]: a.key } };
  case "synced": {
   // A newer choice for the same question stays queued.
   if (s.unsynced[a.id] !== a.key) return s;
   const unsynced = { ...s.unsynced };
   delete unsynced[a.id];
   return { ...s, unsynced };
  }
 }
}
export const answeredCount = (s: PlayState, questionIds: readonly string[]) => questionIds.filter(id => s.answers[id] !== undefined).length;
