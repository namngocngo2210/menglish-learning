import { expect, it, vi } from "vitest";
import { connectRoomEvents, connReducer, MAX_SSE_ERRORS, POLL_INTERVAL_MS, SSE_RETRY_MS, REFRESH_THROTTLE_MS, type ESLike, type Timers } from "@/lib/rooms/events-machine";
import { initialShell, shellReducer, phaseOf } from "@/lib/rooms/shell-state";
import { RoomsApiError } from "@/lib/rooms/client";
import type { RoomSnapshot } from "@/lib/rooms/types";

class FakeES implements ESLike {
  static all: FakeES[] = [];
  listeners = new Map<string, (e: { data?: string }) => void>();
  onopen: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; closed = false;
  constructor(public url: string) { FakeES.all.push(this); }
  addEventListener(t: string, fn: (e: { data?: string }) => void) { this.listeners.set(t, fn); }
  close() { this.closed = true; }
  emit(t: string, data: unknown) { this.listeners.get(t)?.({ data: JSON.stringify(data) }); }
}
function setup() {
  FakeES.all = []; vi.useFakeTimers();
  const h = { onSnapshot: vi.fn(), onEvent: vi.fn(), onRefresh: vi.fn(), onStatus: vi.fn() };
  const timers: Timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id as never), setInterval: (f, ms) => setInterval(f, ms), clearInterval: id => clearInterval(id as never) };
  const conn = connectRoomEvents("K7M2QX", h, { EventSource: FakeES, timers });
  return { h, conn, es: () => FakeES.all.at(-1)! };
}
const snap = (over: Partial<RoomSnapshot> = {}, me: Partial<RoomSnapshot["me"]> = {}) => ({ code: "K7M2QX", state: "lobby", version: 1, me: { playerId: "p", isHost: false, status: "joined", ...me }, ...over }) as RoomSnapshot;

it("reducer: open resets errors, third error switches to polling, stop is terminal", () => {
  let s = connReducer({ status: "closed", errors: 0 }, "start");
  s = connReducer(s, "error"); expect(s.status).toBe("reconnecting");
  s = connReducer(connReducer(s, "error"), "error"); expect(s).toEqual({ status: "polling", errors: MAX_SSE_ERRORS });
  expect(connReducer(s, "open").errors).toBe(0);
  s = connReducer(s, "stop"); expect(connReducer(s, "open").status).toBe("closed");
});

it("applies snapshot/rematch directly, other events trigger a throttled refresh", () => {
  const { h, conn, es } = setup();
  es().onopen!(null);
  expect(es().url).toBe("/rt/rooms/K7M2QX/events");
  es().emit("snapshot", { code: "K7M2QX" }); es().emit("rematch", { code: "K7M2QX" });
  expect(h.onSnapshot).toHaveBeenCalledTimes(2); expect(h.onRefresh).not.toHaveBeenCalled();
  es().emit("player_joined", {}); es().emit("progress", {}); es().emit("progress", {});
  expect(h.onRefresh).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(REFRESH_THROTTLE_MS + 1);
  expect(h.onRefresh).toHaveBeenCalledTimes(2);
  conn.close(); vi.useRealTimers();
});

it("falls back to 3s polling after repeated errors and probes SSE again later", () => {
  const { h, conn, es } = setup();
  const first = es();
  for (let i = 0; i < MAX_SSE_ERRORS; i++) first.onerror?.(null);
  expect(conn.getState().status).toBe("polling"); expect(first.closed).toBe(true);
  vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);
  expect(h.onRefresh).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(SSE_RETRY_MS);
  expect(FakeES.all).toHaveLength(2);
  es().onopen!(null);
  expect(conn.getState().status).toBe("open");
  h.onRefresh.mockClear(); vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
  expect(h.onRefresh).not.toHaveBeenCalled();
  conn.close(); vi.useRealTimers();
});

it("stops for good on superseded and room_closed, and cleans up on close", () => {
  for (const name of ["superseded", "room_closed"]) {
    const { h, conn, es } = setup();
    es().emit(name, { reason: "idle" });
    expect(h.onEvent).toHaveBeenCalledWith(name, { reason: "idle" });
    expect(conn.getState().status).toBe("closed"); expect(es() .closed).toBe(true);
    vi.advanceTimersByTime(SSE_RETRY_MS * 2); expect(FakeES.all).toHaveLength(1);
    vi.useRealTimers();
  }
  const { h, conn, es } = setup();
  conn.close(); es().emit("progress", {}); conn.requestRefresh();
  expect(h.onRefresh).not.toHaveBeenCalled(); vi.useRealTimers();
});

it("shell reducer derives phases from snapshots, errors and events", () => {
  expect(phaseOf(snap({ state: "playing" }, { status: "playing" }))).toBe("playing");
  expect(phaseOf(snap({ state: "playing" }, { status: "submitted" }))).toBe("submitted");
  let s = shellReducer(initialShell, { type: "snapshot", room: snap({ state: "results" }) });
  expect(s.phase).toBe("results");
  expect(shellReducer(initialShell, { type: "api_error", error: new RoomsApiError(404, "room_not_found", "x") }).phase).toBe("not_found");
  expect(shellReducer(initialShell, { type: "api_error", error: new RoomsApiError(409, "room_full", "x") }).phase).toBe("unavailable");
  expect(shellReducer(initialShell, { type: "api_error", error: new RoomsApiError(0, "network", "x") })).toMatchObject({ phase: "error", retryable: true });
  expect(shellReducer(s, { type: "api_error", error: new RoomsApiError(0, "network", "x") }).phase).toBe("results");
  const preview = { test: {}, playerCount: 1, maxPlayers: 10, joinable: true };
  expect(shellReducer(initialShell, { type: "no_session", preview }).phase).toBe("join");
  expect(shellReducer(initialShell, { type: "no_session", preview: { ...preview, joinable: false } }).phase).toBe("unavailable");
  s = shellReducer(s, { type: "event", name: "room_closed", data: { reason: "host_closed" } });
  expect(s).toMatchObject({ phase: "closed", closeReason: "host_closed" });
  s = shellReducer(initialShell, { type: "event", name: "superseded", data: null });
  expect(shellReducer(s, { type: "snapshot", room: snap() }).phase).toBe("superseded");
  expect(shellReducer(s, { type: "retry" })).toEqual(initialShell);
});
