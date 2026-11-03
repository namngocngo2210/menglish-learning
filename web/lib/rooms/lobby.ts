import { roomPath } from "../routes";
import type { PlayerView, RoomSnapshot } from "./types";

export const MIN_START_PLAYERS = 2;
export const isDuel = (room: Pick<RoomSnapshot, "settings">) => room.settings.maxPlayers === 2;
export const activePlayers = (room: Pick<RoomSnapshot, "players">): PlayerView[] => room.players.filter(p => p.status !== "left");
export const connectedCount = (room: Pick<RoomSnapshot, "players">) => activePlayers(room).filter(p => p.connected).length;

/** Connected players who pressed Sẵn sàng, out of all connected players (the host counts like everyone else). */
export function readyCounts(room: Pick<RoomSnapshot, "players">): { ready: number; total: number } {
 const live = activePlayers(room).filter(p => p.connected);
 return { ready: live.filter(p => p.ready).length, total: live.length };
}

/** Host may start with at least two connected players and every connected player ready. */
export function startState(room: RoomSnapshot): { enabled: boolean; hint: string } {
 const { ready, total } = readyCounts(room);
 if (!room.me.isHost) return { enabled: false, hint: "Chờ chủ phòng bấm Bắt đầu…" };
 if (total < MIN_START_PLAYERS) return { enabled: false, hint: `Cần ít nhất ${MIN_START_PLAYERS} người đang kết nối (hiện có ${total}).` };
 if (ready < total) return { enabled: false, hint: `Chờ ${total - ready} người sẵn sàng` };
 return { enabled: true, hint: "Tất cả đã sẵn sàng, chủ phòng có thể bắt đầu" };
}
export const shareUrl = (origin: string, code: string) => `${origin.replace(/\/+$/, "")}${roomPath(code)}`;

/** D7: what happens to the match when this player leaves, shown before they confirm. */
export function leaveWarning(room: Pick<RoomSnapshot, "state" | "settings" | "me">): string {
 if (isDuel(room)) {
  if (room.state === "lobby") return "Đây là phòng đấu đôi. Nếu em rời phòng lúc này, ván đấu sẽ bị hủy.";
  if (room.state === "playing") return "Đây là phòng đấu đôi. Nếu em rời phòng khi đang làm bài, đối thủ sẽ thắng.";
 }
 if (room.state === "playing") return "Nếu em rời phòng, bài đang làm sẽ không được tính.";
 return "Em sẽ rời phòng và tên của em bị xóa khỏi phòng.";
}
export type StatusLabel = { text: string; tone: "ok" | "wait" | "off" };
export function statusLabel(p: PlayerView, roomState: RoomSnapshot["state"]): StatusLabel {
 if (!p.connected && p.status !== "submitted") return { text: "Mất kết nối", tone: "off" };
 if (p.status === "submitted") return { text: "Đã nộp", tone: "ok" };
 if (roomState === "playing") return { text: "Đang làm", tone: "wait" };
 return p.ready ? { text: "Sẵn sàng", tone: "ok" } : { text: "Chưa sẵn sàng", tone: "wait" };
}
