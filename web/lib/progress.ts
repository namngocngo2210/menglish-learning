export const PROGRESS_KEY = "ml:progress:v1";
export interface Progress { best: number; last: number; total: number; at: string }
type StorageLike = Pick<Storage, "getItem" | "setItem">;
function storage(): StorageLike { return window.localStorage; }
function valid(value: unknown): value is Progress {
 if (!value || typeof value !== "object") return false;
 const p = value as Progress;
 return Number.isInteger(p.total) && p.total > 0 && Number.isInteger(p.last) && p.last >= 0 && p.last <= p.total && Number.isInteger(p.best) && p.best >= p.last && p.best <= p.total && typeof p.at === "string" && Number.isFinite(Date.parse(p.at));
}
export function readProgress(slug: string, store?: StorageLike): Progress | undefined {
 try { const data = JSON.parse((store ?? storage()).getItem(PROGRESS_KEY) ?? "{}"); const value = data?.[slug]; return valid(value) ? value : undefined; } catch { return undefined; }
}
export function saveProgress(slug: string, score: number, total: number, store?: StorageLike): void {
 try {
  const target = store ?? storage();
  const previous = readProgress(slug, target);
  const value = { best: Math.max(score, previous?.total === total ? previous.best : 0), last: score, total, at: new Date().toISOString() };
  if (!valid(value)) return;
  const parsed: unknown = JSON.parse(target.getItem(PROGRESS_KEY) ?? "{}");
  const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  target.setItem(PROGRESS_KEY, JSON.stringify({ ...data, [slug]: value }));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ml:progress"));
 } catch { /* Practice remains available when storage is disabled or full. */ }
}
export interface ProgressItem extends Progress { slug: string }
/** Every valid anonymous result stored on this device, for the parent-confirmed import. */
export function readAllProgress(store?: StorageLike): ProgressItem[] {
 try { const data = JSON.parse((store ?? storage()).getItem(PROGRESS_KEY) ?? "{}"); return Object.entries(data ?? {}).filter(([, v]) => valid(v)).map(([slug, v]) => ({ slug, ...(v as Progress) })).slice(0, 500); } catch { return []; }
}
