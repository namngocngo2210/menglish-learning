import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));
import { RoomLobby } from "@/components/rooms/RoomLobby";
import type { RoomsClient } from "@/lib/rooms/client";
import type { PlayerView, RoomSnapshot } from "@/lib/rooms/types";

const player = (id: string, over: Partial<PlayerView> = {}): PlayerView => ({ playerId: id, name: id.toUpperCase(), isHost: false, status: "joined", connected: true, ready: false, ...over });
const room = (meId: string, players: PlayerView[]): RoomSnapshot => ({
 code: "K7M2QX", state: "lobby", version: 1, serverNow: "2026-11-03T09:00:00Z",
 settings: { maxPlayers: 10, timeLimitMinutes: null, locked: false, test: {} }, startedAt: null, deadlineAt: null,
 players, submittedCount: 0, playerCount: players.length, me: { playerId: meId, isHost: meId === "a" },
});
const html = (r: RoomSnapshot, notice: string | null = null) => renderToStaticMarkup(createElement(RoomLobby, { client: {} as RoomsClient, room: r, notice }));

describe("RoomLobby ready step", () => {
 const three = [player("a", { isHost: true, ready: true }), player("b", { ready: true }), player("c")];

 it("guest sees a big Sẵn sàng toggle, the counter and a text badge per player", () => {
  const out = html(room("c", three));
  expect(out).toContain("Đã sẵn sàng 2/3");
  expect(out).toMatch(/aria-pressed="false"[^>]*>(?:<svg.*?<\/svg>)?Sẵn sàng</);
  expect(out).toContain("Chưa sẵn sàng");
  expect(out).not.toContain("Bỏ sẵn sàng");
  expect(out).toContain("Đang chờ mọi người sẵn sàng");
 });

 it("a ready player gets Bỏ sẵn sàng (pressed)", () => {
  const out = html(room("b", three));
  expect(out).toMatch(/aria-pressed="true"[^>]*>(?:<svg.*?<\/svg>)?Bỏ sẵn sàng</);
 });

 it("host: Bắt đầu is disabled with the reason, and enabled when everybody is ready", () => {
  const blocked = html(room("a", three));
  expect(blocked).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="start-hint"[^>]*>(?:<svg.*?<\/svg>)?Bắt đầu</);
  expect(blocked).toContain("Chờ 1 người sẵn sàng");
  const ok = html(room("a", [...three.slice(0, 2), player("c", { ready: true })]));
  expect(ok).not.toMatch(/disabled=""[^>]*aria-describedby="start-hint"/);
  expect(ok).toContain("Tất cả đã sẵn sàng, chủ phòng có thể bắt đầu");
 });

 it("shows the settings-reset notice", () => {
  expect(html(room("b", three), "Chủ phòng vừa đổi cài đặt bài. Mọi người cần bấm Sẵn sàng lại.")).toContain("data-slot=\"ready-reset-notice\"");
 });
});
