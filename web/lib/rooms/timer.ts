/** Server-time helpers: the client clock may be off, so we measure the offset once per snapshot. */
export function clockOffset(serverNowIso: string, localNowMs: number): number {
 const server = Date.parse(serverNowIso);
 return Number.isFinite(server) ? server - localNowMs : 0;
}
/** Milliseconds left until `deadlineAt`, or null when the room has no timer. Never negative. */
export function remainingMs(deadlineAtIso: string | null, offsetMs: number, localNowMs: number): number | null {
 if (!deadlineAtIso) return null;
 const deadline = Date.parse(deadlineAtIso);
 if (!Number.isFinite(deadline)) return null;
 return Math.max(0, deadline - (localNowMs + offsetMs));
}
export function formatClock(ms: number): string {
 const total = Math.ceil(ms / 1000);
 const m = Math.floor(total / 60), s = total % 60;
 return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
export type TimerMilestone = "five_minutes" | "one_minute" | "time_up";
/** Which polite announcement (if any) was crossed between two readings. */
export function milestoneCrossed(prevMs: number | null, nextMs: number | null): TimerMilestone | null {
 if (prevMs === null || nextMs === null) return null;
 if (prevMs > 0 && nextMs <= 0) return "time_up";
 if (prevMs > 60_000 && nextMs <= 60_000) return "one_minute";
 if (prevMs > 300_000 && nextMs <= 300_000) return "five_minutes";
 return null;
}
export const MILESTONE_TEXT: Record<TimerMilestone, string> = {
 five_minutes: "Còn 5 phút.", one_minute: "Còn 1 phút.", time_up: "Hết giờ. Bài của em đang được nộp.",
};
