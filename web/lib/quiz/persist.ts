import type { OptionKey } from "../content/types";

export const QUIZ_STORAGE_PREFIX = "ml:quiz:v1:";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface SavedQuiz { answers: Record<string, OptionKey>; checked: Record<string, boolean>; active: number }
const KEYS = new Set<string>(["A", "B", "C", "D"]);
function store(): StorageLike | undefined { try { return window.localStorage; } catch { return undefined; } }

/** Read saved state, ignoring anything that does not belong to the given question ids. */
export function readQuiz(id: string, questionIds: readonly string[], target: StorageLike | undefined = store()): SavedQuiz | undefined {
 try {
  const raw = target?.getItem(QUIZ_STORAGE_PREFIX + id);
  if (!raw) return undefined;
  const data = JSON.parse(raw);
  if (!data || data.v !== 1 || typeof data.answers !== "object" || !data.answers) return undefined;
  const known = new Set(questionIds);
  const answers: SavedQuiz["answers"] = {};
  for (const [qid, key] of Object.entries(data.answers)) if (known.has(qid) && typeof key === "string" && KEYS.has(key)) answers[qid] = key as OptionKey;
  const checked: SavedQuiz["checked"] = {};
  if (data.checked && typeof data.checked === "object") for (const [qid, v] of Object.entries(data.checked)) if (v === true && answers[qid]) checked[qid] = true;
  const active = Number.isInteger(data.active) && data.active >= 0 ? data.active : 0;
  if (!Object.keys(answers).length) return undefined;
  return { answers, checked, active };
 } catch { return undefined; }
}
export function writeQuiz(id: string, value: SavedQuiz, target: StorageLike | undefined = store()): void {
 try { target?.setItem(QUIZ_STORAGE_PREFIX + id, JSON.stringify({ v: 1, ...value })); } catch { /* Practice works without storage. */ }
}
export function clearQuiz(id: string, target: StorageLike | undefined = store()): void {
 try { target?.removeItem(QUIZ_STORAGE_PREFIX + id); } catch { /* ignore */ }
}
