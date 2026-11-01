import { RoomsApiError } from "./client";
import type { CloseReason, PreviewResponse, RoomSnapshot, SseEventName } from "./types";

export type Phase = "loading" | "join" | "not_found" | "unavailable" | "lobby" | "playing" | "submitted" | "results" | "closed" | "superseded" | "kicked" | "error";
export interface ShellState { phase: Phase; room: RoomSnapshot | null; preview: PreviewResponse | null; closeReason: CloseReason | null; restarting: boolean; announcement: string | null; retryable: boolean }
export type ShellAction =
 | { type: "snapshot"; room: RoomSnapshot }
 | { type: "no_session"; preview: PreviewResponse }
 | { type: "api_error"; error: unknown }
 | { type: "event"; name: SseEventName; data: unknown }
 | { type: "session_lost" }
 | { type: "retry" };
export const initialShell: ShellState = { phase: "loading", room: null, preview: null, closeReason: null, restarting: false, announcement: null, retryable: false };

export function phaseOf(room: RoomSnapshot): Phase {
 switch (room.state) {
  case "lobby": return "lobby";
  case "playing": return room.me.status === "submitted" ? "submitted" : "playing";
  case "results": return "results";
  case "closed": return "closed";
 }
}
export function shellReducer(s: ShellState, a: ShellAction): ShellState {
 switch (a.type) {
  case "retry": return { ...initialShell };
  // Our cookie stopped working after we were in the room: kicked, or the room moved on without us.
  case "session_lost": return { ...s, phase: "kicked" };
  case "snapshot": return s.phase === "superseded" || s.phase === "kicked" ? s : { ...s, room: a.room, preview: null, restarting: false, retryable: false, phase: phaseOf(a.room) };
  case "no_session": return { ...s, preview: a.preview, phase: a.preview.joinable ? "join" : "unavailable" };
  case "api_error": {
   const e = a.error;
   if (e instanceof RoomsApiError) {
    if (e.status === 404 || e.code === "room_not_found") return { ...s, phase: "not_found" };
    if (e.code === "room_full" || e.code === "room_not_joinable") return { ...s, phase: "unavailable" };
   }
   // A transient failure after we already have a room keeps the current screen (the connection banner explains).
   return { ...s, phase: s.room ? s.phase : "error", retryable: true };
  }
  case "event": {
   const data = (a.data ?? {}) as Record<string, unknown>;
   if (a.name === "player_kicked" && s.room && data.playerId === s.room.me.playerId) return { ...s, phase: "kicked" };
   if (a.name === "superseded") return { ...s, phase: "superseded" };
   if (a.name === "room_closed") return { ...s, phase: "closed", closeReason: (data.reason as CloseReason) ?? null };
   if (a.name === "server_restarting") return { ...s, restarting: true };
   if (a.name === "host_changed") return { ...s, announcement: "Chủ phòng đã đổi." };
   return s;
  }
 }
}
