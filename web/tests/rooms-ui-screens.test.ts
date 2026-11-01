import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { answeredCount, initialPlay, playReducer, toRoomSections } from "@/lib/rooms/play-state";
import { clockOffset, formatClock, milestoneCrossed, remainingMs } from "@/lib/rooms/timer";
import { duelHeadline, hasTies, initialLoad, isSharedRank, loadReducer, reviewStatus, reviewSummary } from "@/lib/rooms/results";
import { isDuel, leaveWarning, startState, statusLabel } from "@/lib/rooms/lobby";
import { errorMessage } from "@/lib/rooms/messages";
import { RoomsApiError } from "@/lib/rooms/client";
import { initialShell, shellReducer } from "@/lib/rooms/shell-state";
import type { PlayerView, QuizResponse, RankingRow, RoomSnapshot } from "@/lib/rooms/types";

const player = (id: string, over: Partial<PlayerView> = {}): PlayerView => ({ playerId: id, name: id, isHost: false, status: "joined", connected: true, ...over });
const room = (over: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
 code: "K7M2QX", state: "lobby", version: 1, serverNow: "2026-11-01T09:00:00Z",
 settings: { maxPlayers: 10, timeLimitMinutes: null, locked: false, test: {} }, startedAt: null, deadlineAt: null,
 players: [player("a", { isHost: true }), player("b")], submittedCount: 0, playerCount: 2, me: { playerId: "a", isHost: true, status: "joined" }, ...over,
});

describe("play reducer", () => {
 it("keeps unsynced choices until the server confirms them, newer choice wins", () => {
  let s = playReducer(initialPlay, { type: "select", id: "q1", key: "A" });
  s = playReducer(s, { type: "select", id: "q1", key: "B" });
  s = playReducer(s, { type: "synced", id: "q1", key: "A" });
  expect(s.unsynced).toEqual({ q1: "B" });
  s = playReducer(s, { type: "synced", id: "q1", key: "B" });
  expect(s.unsynced).toEqual({});
  expect(s.answers.q1).toBe("B");
 });
 it("restore never overrides unsaved local choices and drops invalid keys", () => {
  const s = playReducer(playReducer(initialPlay, { type: "select", id: "q1", key: "C" }), { type: "restore", answers: { q1: "A", q2: "D", q3: "Z" } });
  expect(s.answers).toEqual({ q1: "C", q2: "D" });
  expect(answeredCount(s, ["q1", "q2", "q3"])).toBe(2);
 });
 it("builds display sections that carry no answer data", () => {
  const quiz: QuizResponse = { questions: [{ id: "q1", passageId: "p1", stem: "S", options: [{ key: "A", text: "x" }, { key: "B", text: "y" }] }, { id: "q2", passageId: null, stem: "T", options: [{ key: "A", text: "x" }] }], passages: [{ id: "p1", title: "P", body: "one two three" }], answers: {} };
  const sections = toRoomSections(quiz);
  expect(sections.map(s => s.kind)).toEqual(["passage", "standalone"]);
  expect(sections[0].passage?.wordCount).toBe(3);
  expect(JSON.stringify(sections)).not.toMatch(/correctKey|explanation/);
 });
});

describe("timer", () => {
 it("calibrates to server time and never goes negative", () => {
  const offset = clockOffset("2026-11-01T09:00:00Z", Date.parse("2026-11-01T09:00:05Z"));
  expect(remainingMs("2026-11-01T09:10:00Z", offset, Date.parse("2026-11-01T09:00:05Z"))).toBe(600_000);
  expect(remainingMs("2026-11-01T09:10:00Z", offset, Date.parse("2026-11-01T10:00:00Z"))).toBe(0);
  expect(remainingMs(null, 0, 0)).toBeNull();
  expect(formatClock(61_000)).toBe("01:01");
 });
 it("announces the 5 minute, 1 minute and time-up milestones once", () => {
  expect(milestoneCrossed(301_000, 299_000)).toBe("five_minutes");
  expect(milestoneCrossed(61_000, 59_000)).toBe("one_minute");
  expect(milestoneCrossed(1000, 0)).toBe("time_up");
  expect(milestoneCrossed(299_000, 298_000)).toBeNull();
 });
});

describe("lobby rules", () => {
 it("start needs the host and two connected players", () => {
  expect(startState(room()).enabled).toBe(true);
  expect(startState(room({ players: [player("a", { isHost: true }), player("b", { connected: false })] })).enabled).toBe(false);
  expect(startState(room({ me: { playerId: "b", isHost: false } })).enabled).toBe(false);
 });
 it("D7 duel leave warnings", () => {
  const duel = (state: RoomSnapshot["state"]) => room({ state, settings: { ...room().settings, maxPlayers: 2 } });
  expect(isDuel(duel("lobby"))).toBe(true);
  expect(leaveWarning(duel("lobby"))).toMatch(/hủy/);
  expect(leaveWarning(duel("playing"))).toMatch(/đối thủ sẽ thắng/);
  expect(leaveWarning(room({ state: "playing" }))).not.toMatch(/đối thủ/);
 });
 it("status chips", () => {
  expect(statusLabel(player("x", { connected: false }), "playing").tone).toBe("off");
  expect(statusLabel(player("x", { status: "submitted" }), "playing").text).toBe("Đã nộp");
 });
});

describe("results helpers", () => {
 const row = (rank: number, id: string): RankingRow => ({ rank, playerId: id, name: id, correct: 5, total: 10, percent: 50, isMe: false, note: null });
 it("ties share a rank without any speed tie-break", () => {
  const rows = [row(1, "a"), row(1, "b"), row(3, "c")];
  expect(hasTies(rows)).toBe(true);
  expect(isSharedRank(rows, rows[0])).toBe(true);
  expect(isSharedRank(rows, rows[2])).toBe(false);
  expect(hasTies([row(1, "a"), row(2, "b")])).toBe(false);
 });
 it("duel headlines", () => {
  expect(duelHeadline({ outcome: "win", myCorrect: 1, theirCorrect: 0 }, true)).toMatch(/rời phòng/);
  expect(duelHeadline({ outcome: "draw", myCorrect: 1, theirCorrect: 1 }, false)).toMatch(/Hòa/);
 });
 it("review summary", () => {
  const items = [{ selectedKey: "A", correctKey: "A" }, { selectedKey: "B", correctKey: "A" }, { selectedKey: null, correctKey: "A" }].map((x, i) => ({ questionId: `q${i}`, stem: "", options: [], ...x }));
  expect(items.map(reviewStatus)).toEqual(["correct", "wrong", "blank"]);
  expect(reviewSummary(items)).toEqual({ correct: 1, wrong: 1, blank: 1 });
 });
 it("load reducer keeps ready data on a repeated load", () => {
  const ready = loadReducer(initialLoad, { type: "ok", data: 1 });
  expect(loadReducer(ready, { type: "load" })).toBe(ready);
  expect(loadReducer(initialLoad, { type: "load" }).status).toBe("loading");
  expect(loadReducer(ready, { type: "fail", error: new Error("x") }).status).toBe("error");
 });
});

describe("shell phases for the in-room screens", () => {
 it("follows the snapshot: playing, submitted, results", () => {
  const playing = shellReducer(initialShell, { type: "snapshot", room: room({ state: "playing", me: { playerId: "a", isHost: true, status: "playing" } }) });
  expect(playing.phase).toBe("playing");
  const submitted = shellReducer(playing, { type: "snapshot", room: room({ state: "playing", me: { playerId: "a", isHost: true, status: "submitted" } }) });
  expect(submitted.phase).toBe("submitted");
  expect(shellReducer(submitted, { type: "snapshot", room: room({ state: "results" }) }).phase).toBe("results");
 });
 it("kicked and lost sessions are terminal; disconnect keeps the screen", () => {
  const inLobby = shellReducer(initialShell, { type: "snapshot", room: room() });
  const kicked = shellReducer(inLobby, { type: "event", name: "player_kicked", data: { playerId: "a" } });
  expect(kicked.phase).toBe("kicked");
  expect(shellReducer(kicked, { type: "snapshot", room: room() }).phase).toBe("kicked");
  expect(shellReducer(inLobby, { type: "event", name: "player_kicked", data: { playerId: "b" } }).phase).toBe("lobby");
  expect(shellReducer(inLobby, { type: "api_error", error: new RoomsApiError(0, "network", "x") }).phase).toBe("lobby");
 });
 it("error messages are friendly", () => {
  expect(errorMessage(new RoomsApiError(429, "rate_limited", "x", 5))).toMatch(/5 giây/);
  expect(errorMessage(new Error("boom"))).not.toMatch(/boom/);
 });
});

describe("leak scan: in-room play/wait screens never touch answer data", () => {
 const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
 it.each(["components/rooms/RoomPlay.tsx", "components/rooms/RoomWaiting.tsx", "lib/rooms/play-state.ts"])("%s has no answer-key, explanation or score references", file => {
  expect(read(file)).not.toMatch(/correctKey|explanation|\.review\(|\.results\(|percent/);
 });
 it("rooms never render an ad slot", () => {
  for (const f of ["RoomPlay", "RoomWaiting", "RoomResults", "RoomLobby", "RoomShell"]) expect(read(`components/rooms/${f}.tsx`)).not.toMatch(/AdSlot|adsbygoogle/);
 });
});
