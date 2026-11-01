import { SSE_EVENTS, type RoomSnapshot, type SseEventName } from "./types";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "polling" | "closed";
export interface ConnState { status: ConnStatus; errors: number }
export type ConnAction = "start" | "open" | "error" | "retry-sse" | "stop";
export const MAX_SSE_ERRORS = 3;
export const POLL_INTERVAL_MS = 3000;
export const SSE_RETRY_MS = 30_000;
export const REFRESH_THROTTLE_MS = 250;

export function connReducer(state: ConnState, action: ConnAction): ConnState {
 if (state.status === "closed" && action !== "start") return state;
 switch (action) {
  case "start": return { status: "connecting", errors: 0 };
  case "open": return { status: "open", errors: 0 };
  case "error": { const errors = state.errors + 1; return { status: errors >= MAX_SSE_ERRORS ? "polling" : "reconnecting", errors }; }
  // One more failure sends us straight back to polling.
  case "retry-sse": return state.status === "polling" ? { status: "connecting", errors: MAX_SSE_ERRORS - 1 } : state;
  case "stop": return { status: "closed", errors: state.errors };
 }
}

export interface ESLike { addEventListener(type: string, fn: (e: { data?: string }) => void): void; close(): void; onopen: ((e: unknown) => void) | null; onerror: ((e: unknown) => void) | null }
export interface Timers { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (id: unknown) => void; setInterval: (fn: () => void, ms: number) => unknown; clearInterval: (id: unknown) => void }
export interface EventsDeps { EventSource: new (url: string) => ESLike; timers: Timers }
export interface EventsHandlers {
 onSnapshot(room: RoomSnapshot): void;
 /** Any other event; the connection already schedules a throttled refresh. */
 onEvent(name: SseEventName, data: unknown): void;
 /** Refetch /snapshot (ETag-aware). Called throttled after events and every 3 s while polling. */
 onRefresh(): void;
 onStatus(state: ConnState): void;
}
const defaultTimers: Timers = {
 setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
 setInterval: (f, ms) => setInterval(f, ms), clearInterval: id => clearInterval(id as ReturnType<typeof setInterval>),
};

/** Framework-free SSE connection with polling fallback; the React hook is a thin wrapper. */
export function connectRoomEvents(code: string, handlers: EventsHandlers, deps: Partial<EventsDeps> = {}) {
 const ES = deps.EventSource ?? (globalThis.EventSource as unknown as EventsDeps["EventSource"]);
 const t = deps.timers ?? defaultTimers;
 let state: ConnState = { status: "closed", errors: 0 };
 let es: ESLike | null = null, poll: unknown = null, retry: unknown = null, throttle: unknown = null, pending = false;
 const set = (a: ConnAction) => { const next = connReducer(state, a); if (next.status !== state.status || next.errors !== state.errors) { state = next; handlers.onStatus(state); } };
 const clearTimers = () => { if (poll) t.clearInterval(poll); if (retry) t.clearTimeout(retry); if (throttle) t.clearTimeout(throttle); poll = retry = throttle = null; pending = false; };
 function requestRefresh() {
  if (state.status === "closed") return;
  if (throttle) { pending = true; return; }
  handlers.onRefresh();
  throttle = t.setTimeout(() => { throttle = null; if (pending) { pending = false; requestRefresh(); } }, REFRESH_THROTTLE_MS);
 }
 function dropSource() { if (es) { es.onopen = es.onerror = null; es.close(); es = null; } }
 function open() {
  dropSource();
  es = new ES(`/rt/rooms/${code}/events`);
  es.onopen = () => { if (poll) { t.clearInterval(poll); poll = null; } set("open"); };
  es.onerror = () => {
   set("error");
   if (state.status === "polling") {
    // Stop the browser's own retry loop; poll and probe SSE again later.
    dropSource();
    if (!poll) poll = t.setInterval(() => handlers.onRefresh(), POLL_INTERVAL_MS);
    retry = t.setTimeout(() => { retry = null; if (state.status !== "closed") { set("retry-sse"); open(); } }, SSE_RETRY_MS);
   }
  };
  for (const name of SSE_EVENTS) es.addEventListener(name, e => {
   let data: unknown = null;
   try { data = e.data ? JSON.parse(e.data) : null; } catch { return; }
   if (name === "snapshot" || name === "rematch") { handlers.onSnapshot(data as RoomSnapshot); return; }
   handlers.onEvent(name, data);
   if (name === "superseded" || name === "room_closed") { stop(); return; }
   if (name !== "server_restarting") requestRefresh();
  });
 }
 function stop() { clearTimers(); dropSource(); set("stop"); }
 set("start"); open();
 return { close: stop, requestRefresh, getState: () => state };
}
