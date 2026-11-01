"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { createRoomsClient, RoomsApiError, type RoomsClient } from "@/lib/rooms/client";
import { RoomLobby } from "./RoomLobby";
import { RoomPlay } from "./RoomPlay";
import { RoomResults } from "./RoomResults";
import { RoomWaiting } from "./RoomWaiting";
import { initialShell, shellReducer, type Phase, type ShellState } from "@/lib/rooms/shell-state";
import { useRoomEvents } from "@/lib/rooms/useRoomEvents";
import { roomsLandingPath } from "@/lib/routes";
import type { CloseReason, JoinResponse } from "@/lib/rooms/types";
import { ghostCls } from "./fields";
import { JoinCodeForm } from "./JoinCodeForm";
import { JoinNameForm } from "./JoinNameForm";

const CLOSE_TEXT: Record<CloseReason, string> = {
 host_closed: "Chủ phòng đã đóng phòng.", idle: "Phòng đã đóng vì không có hoạt động.", empty: "Phòng đã đóng vì không còn ai trong phòng.",
 maintenance: "Phòng đã đóng để bảo trì hệ thống.", expired: "Phòng đã hết thời gian tồn tại.",
};
const btn = "inline-flex min-h-11 items-center justify-center rounded-xl bg-cta px-5 font-bold text-navy! no-underline hover:bg-cta-hover";

function Panel({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
 return <section className="mx-auto max-w-xl rounded-2xl border-2 border-navy/20 bg-white p-6 text-center shadow-sm sm:p-8">
  {icon}<h1 className="text-2xl font-extrabold">{title}</h1><div className="mt-3 space-y-4 text-navy-soft">{children}</div>
 </section>;
}
const toLanding = <Link href={roomsLandingPath()} className={btn}>Về trang Luyện tập nhóm</Link>;

function Body({ s, retry, code, client, onJoined, onBlocked }: { s: ShellState; retry: () => void; code: string; client: RoomsClient; onJoined: (r: JoinResponse) => void; onBlocked: (e: unknown) => void }) {
 const phase: Phase = s.phase;
 switch (phase) {
  case "loading": return <Panel title="Đang vào phòng…" icon={<Loader2 aria-hidden="true" className="mx-auto mb-3 size-8 animate-spin motion-reduce:animate-none text-primary"/>}/>;
  case "not_found": return <Panel title="Không tìm thấy phòng"><p role="alert">Mã sai hoặc phòng đã hết hạn. Mã có 6 ký tự, không phân biệt hoa thường.</p><div className="text-left"><JoinCodeForm id="thu-lai-ma"/></div>{toLanding}</Panel>;
  case "unavailable": {
   const full = !!s.preview && s.preview.playerCount >= s.preview.maxPlayers;
   return <Panel title={full ? "Phòng đã đủ người" : "Không vào được phòng"}>
    <p role="alert">{full ? `Phòng đã có ${s.preview!.playerCount}/${s.preview!.maxPlayers} người. Hãy nhờ chủ phòng tăng sức chứa hoặc tạo phòng mới.` : "Phòng đã bắt đầu, đã khóa hoặc đã kết thúc nên không vào thêm được."}</p>
    <div className="flex flex-col justify-center gap-3 sm:flex-row"><Link href={`${roomsLandingPath()}#tao-phong`} className={btn}>Tạo phòng mới</Link><Link href={`${roomsLandingPath()}#vao-phong`} className={ghostCls}>Nhập mã khác</Link></div>
   </Panel>;
  }
  case "closed": return <Panel title="Phòng đã đóng"><p>{s.closeReason ? CLOSE_TEXT[s.closeReason] : "Phòng không còn hoạt động."}</p>{toLanding}</Panel>;
  case "superseded": return <Panel title="Đang dùng ở tab khác"><p>Phòng này đang mở ở một tab khác của trình duyệt. Hãy đóng tab này hoặc tải lại để dùng ở đây.</p></Panel>;
  case "error": return <Panel title="Có lỗi xảy ra" icon={<AlertTriangle aria-hidden="true" className="mx-auto mb-3 size-8 text-red-700"/>}><p>Không tải được phòng. Kiểm tra kết nối rồi thử lại.</p><button type="button" className={btn} onClick={retry}>Thử lại</button></Panel>;
  case "join": return <div data-slot="join"><JoinNameForm code={code} preview={s.preview} onJoined={onJoined} onBlocked={onBlocked}/></div>;
  case "kicked": return <Panel title="Em không còn trong phòng"><p role="alert">Chủ phòng đã mời em ra, hoặc phòng đã chuyển sang bước khác nên phiên của em không còn hiệu lực.</p>{toLanding}</Panel>;
  case "lobby": return s.room && <RoomLobby client={client} room={s.room}/>;
  case "playing": return s.room && <RoomPlay client={client} room={s.room}/>;
  case "submitted": return s.room && <RoomWaiting client={client} room={s.room}/>;
  case "results": return s.room && <RoomResults client={client} room={s.room}/>;
 }
}

export function RoomShell({ code }: { code: string }) {
 const [s, dispatch] = useReducer(shellReducer, initialShell);
 const [client] = useState(() => createRoomsClient());
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

 const hasRoom = s.room !== null && s.phase !== "closed" && s.phase !== "superseded" && s.phase !== "kicked";
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
   <Body s={s} code={code} client={client} retry={() => dispatch({ type: "retry" })} onBlocked={error => dispatch({ type: "api_error", error })} onJoined={r => { if (r.room) dispatch({ type: "snapshot", room: r.room }); else void refresh(); }}/>
  </main>
 </div>;
}
