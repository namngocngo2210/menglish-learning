"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { createRoomsClient, RoomsApiError } from "@/lib/rooms/client";
import { initialShell, shellReducer, type Phase, type ShellState } from "@/lib/rooms/shell-state";
import { useRoomEvents } from "@/lib/rooms/useRoomEvents";
import { roomsLandingPath } from "@/lib/routes";
import type { CloseReason } from "@/lib/rooms/types";

const CLOSE_TEXT: Record<CloseReason, string> = {
 host_closed: "Chủ phòng đã đóng phòng.", idle: "Phòng đã đóng vì không có hoạt động.", empty: "Phòng đã đóng vì không còn ai trong phòng.",
 maintenance: "Phòng đã đóng để bảo trì hệ thống.", expired: "Phòng đã hết thời gian tồn tại.",
};
const btn = "inline-flex min-h-11 items-center justify-center rounded-xl bg-cta px-5 font-bold text-navy no-underline hover:bg-cta-hover";

function Panel({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
 return <section className="mx-auto max-w-xl rounded-2xl border-2 border-navy/20 bg-white p-6 text-center shadow-sm sm:p-8">
  {icon}<h1 className="text-2xl font-extrabold">{title}</h1><div className="mt-3 space-y-4 text-navy-soft">{children}</div>
 </section>;
}
const toLanding = <Link href={roomsLandingPath()} className={btn}>Về trang Luyện tập nhóm</Link>;

function Body({ s, retry }: { s: ShellState; retry: () => void }) {
 const phase: Phase = s.phase;
 switch (phase) {
  case "loading": return <Panel title="Đang vào phòng…" icon={<Loader2 aria-hidden="true" className="mx-auto mb-3 size-8 animate-spin motion-reduce:animate-none text-primary"/>}/>;
  case "not_found": return <Panel title="Không tìm thấy phòng"><p>Mã sai hoặc phòng đã hết hạn. Mã có 6 ký tự, không phân biệt hoa thường.</p>{toLanding}</Panel>;
  case "unavailable": return <Panel title="Không vào được phòng"><p>Phòng đã đủ người, đã khóa hoặc đã bắt đầu.</p>{toLanding}</Panel>;
  case "closed": return <Panel title="Phòng đã đóng"><p>{s.closeReason ? CLOSE_TEXT[s.closeReason] : "Phòng không còn hoạt động."}</p>{toLanding}</Panel>;
  case "superseded": return <Panel title="Đang dùng ở tab khác"><p>Phòng này đang mở ở một tab khác của trình duyệt. Hãy đóng tab này hoặc tải lại để dùng ở đây.</p></Panel>;
  case "error": return <Panel title="Có lỗi xảy ra" icon={<AlertTriangle aria-hidden="true" className="mx-auto mb-3 size-8 text-red-700"/>}><p>Không tải được phòng. Kiểm tra kết nối rồi thử lại.</p><button type="button" className={btn} onClick={retry}>Thử lại</button></Panel>;
  // Placeholders: the join form and in-room screens are implemented in later cards.
  case "join": return <div data-slot="join"><Panel title="Vào phòng"><p>Phòng {s.room?.code ?? ""} đang chờ người chơi.</p></Panel></div>;
  default: return <div data-slot={phase}><Panel title="Phòng luyện tập"><p>Màn hình “{phase}” sẽ có ở bản tiếp theo.</p></Panel></div>;
 }
}

export function RoomShell({ code }: { code: string }) {
 const [s, dispatch] = useReducer(shellReducer, initialShell);
 const client = useRef(createRoomsClient()).current;
 const etag = useRef<string | null>(null);
 const alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

 const refresh = useCallback(async () => {
  try {
   const r = await client.snapshot(code, etag.current);
   if (!alive.current || r.notModified) return;
   etag.current = r.etag;
   dispatch({ type: "snapshot", room: r.room });
  } catch (error) {
   if (!alive.current) return;
   if (error instanceof RoomsApiError && error.code === "no_session") {
    try { const preview = await client.preview(code); if (alive.current) dispatch({ type: "no_session", preview }); }
    catch (e) { if (alive.current) dispatch({ type: "api_error", error: e }); }
    return;
   }
   dispatch({ type: "api_error", error });
  }
 }, [client, code]);

 const hasRoom = s.room !== null && s.phase !== "closed" && s.phase !== "superseded";
 const { status } = useRoomEvents(hasRoom ? code : null, {
  onSnapshot: room => dispatch({ type: "snapshot", room }),
  onEvent: (name, data) => dispatch({ type: "event", name, data }),
  onRefresh: refresh,
 });
 useEffect(() => { if (s.phase === "loading") void refresh(); }, [s.phase, refresh]);

 const offline = status === "reconnecting" || status === "polling";
 return <div className="min-h-screen bg-surface">
  <header className="border-t-4 border-t-brand border-b border-b-navy-soft/20 px-5 py-3 font-bold">BeeJunior · Luyện tập nhóm</header>
  <main id="noi-dung" className="mx-auto max-w-3xl space-y-4 px-5 py-8 sm:px-8">
   <div role="status" aria-live="polite" className="space-y-2">
    {offline && <p className="flex items-center gap-2 rounded-xl border-2 border-navy/20 bg-warm p-3"><WifiOff aria-hidden="true" className="size-5"/>Mất kết nối, đang thử lại…</p>}
    {s.restarting && <p className="rounded-xl border-2 border-navy/20 bg-warm p-3">Máy chủ sắp khởi động lại. Bài làm của bạn đã được lưu.</p>}
    {s.announcement && <p className="sr-only">{s.announcement}</p>}
   </div>
   <Body s={s} retry={() => dispatch({ type: "retry" })}/>
  </main>
 </div>;
}
