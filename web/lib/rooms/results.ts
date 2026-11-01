import type { RankingRow, ResultsResponse, ReviewItem } from "./types";

export type LoadState<T> = { status: "idle" | "loading" } | { status: "ready"; data: T } | { status: "error"; error: unknown };
export type LoadAction<T> = { type: "load" } | { type: "ok"; data: T } | { type: "fail"; error: unknown };
export const initialLoad: LoadState<never> = { status: "idle" };
export function loadReducer<T>(s: LoadState<T>, a: LoadAction<T>): LoadState<T> {
 switch (a.type) {
  case "load": return s.status === "ready" ? s : { status: "loading" };
  case "ok": return { status: "ready", data: a.data };
  case "fail": return { status: "error", error: a.error };
 }
}

/** Competition ranking (1,1,3) computed client-side only to double check ties never get a speed tie-break. */
export function isSharedRank(rows: readonly RankingRow[], row: RankingRow): boolean {
 return rows.filter(r => r.rank === row.rank).length > 1;
}
export function podium(rows: readonly RankingRow[]): RankingRow[] { return rows.filter(r => r.rank <= 3); }
export function hasTies(rows: readonly RankingRow[]): boolean { return new Set(rows.map(r => r.rank)).size < rows.length; }

export function duelHeadline(duel: NonNullable<ResultsResponse["duel"]>, opponentLeft: boolean): string {
 if (duel.outcome === "win") return opponentLeft ? "Bạn thắng — đối thủ đã rời phòng" : "Bạn thắng!";
 if (duel.outcome === "draw") return "Hòa điểm!";
 return "Lần này đối thủ nhỉnh hơn";
}
export type ReviewStatus = "correct" | "wrong" | "blank";
export function reviewStatus(item: ReviewItem): ReviewStatus {
 return item.selectedKey === null ? "blank" : item.selectedKey === item.correctKey ? "correct" : "wrong";
}
export const reviewSummary = (items: readonly ReviewItem[]) => ({
 correct: items.filter(i => reviewStatus(i) === "correct").length,
 wrong: items.filter(i => reviewStatus(i) === "wrong").length,
 blank: items.filter(i => reviewStatus(i) === "blank").length,
});

export const REPORT_REASONS = [
 { value: "ten_khong_phu_hop", label: "Tên hiển thị không phù hợp" },
 { value: "noi_dung_sai", label: "Nội dung câu hỏi sai" },
 { value: "khac", label: "Lý do khác" },
] as const;
