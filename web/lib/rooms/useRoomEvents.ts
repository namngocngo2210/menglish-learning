"use client";
import { useEffect, useRef, useState } from "react";
import { connectRoomEvents, type ConnState, type EventsHandlers } from "./events-machine";

type Handlers = Omit<EventsHandlers, "onStatus">;
/** Subscribes to /rt/rooms/<code>/events with automatic reconnect and polling fallback. */
export function useRoomEvents(code: string | null, handlers: Handlers) {
 const [conn, setConn] = useState<ConnState>({ status: "closed", errors: 0 });
 const latest = useRef(handlers);
 useEffect(() => { latest.current = handlers; });
 const control = useRef<ReturnType<typeof connectRoomEvents> | null>(null);
 useEffect(() => {
  if (!code || typeof EventSource === "undefined") return;
  let alive = true;
  const c = connectRoomEvents(code, {
   onSnapshot: r => { if (alive) latest.current.onSnapshot(r); },
   onEvent: (n, d) => { if (alive) latest.current.onEvent(n, d); },
   onRefresh: () => { if (alive) latest.current.onRefresh(); },
   onStatus: s => { if (alive) setConn(s); },
  });
  control.current = c;
  return () => { alive = false; control.current = null; c.close(); };
 }, [code]);
 return { status: conn.status, requestRefresh: () => control.current?.requestRefresh() };
}
