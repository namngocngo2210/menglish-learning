"use client";
import { useRef, useState } from "react";
import { Copy, Link2, Lock, Play, UserX, XCircle } from "lucide-react";
import { isDuel, shareUrl, startState, statusLabel } from "@/lib/rooms/lobby";
import { btnCta, btnSecondary, card, ConfirmDialog, ErrorLine, LeaveButton, PlayerList, StatusChip, useAction, type RoomScreenProps } from "./ui";

const TIME_OPTIONS = [{ value: "", label: "Không giới hạn" }, { value: "15", label: "15 phút" }, { value: "30", label: "30 phút" }] as const;

export function RoomLobby({ client, room }: RoomScreenProps) {
 const host = room.me.isHost;
 const [copied, setCopied] = useState("");
 const [confirmClose, setConfirmClose] = useState(false);
 const [kicking, setKicking] = useState<{ id: string; name: string } | null>(null);
 const closeTrigger = useRef<HTMLButtonElement>(null);
 const start = startState(room);
 const act = useAction();
 const test = room.settings.test;

 async function copy(what: "code" | "link") {
  const text = what === "code" ? room.code : shareUrl(window.location.origin, room.code);
  try { await navigator.clipboard.writeText(text); setCopied(what === "code" ? "Đã sao chép mã phòng." : "Đã sao chép đường dẫn."); }
  catch { setCopied(`Không sao chép tự động được. Hãy chép tay: ${text}`); }
 }
 return <div className="space-y-5" data-slot="lobby">
  <section className={card} aria-labelledby="lobby-title">
   <p className="text-sm font-bold text-primary">{isDuel(room) ? "Phòng đấu đôi" : "Phòng luyện tập nhóm"}</p>
   <h1 id="lobby-title" className="mt-1 text-2xl font-extrabold">{test.title ?? "Bài luyện tập"}</h1>
   <p className="mt-1 text-navy-soft">{[test.grade ? `Lớp ${test.grade}` : null, test.size ? `${test.size} câu` : null, room.settings.timeLimitMinutes ? `${room.settings.timeLimitMinutes} phút` : "Không giới hạn thời gian"].filter(Boolean).join(" · ")}</p>
   <div className="mt-4 flex flex-wrap items-center gap-3">
    <p className="rounded-xl border-2 border-navy bg-warm px-4 py-2 text-3xl font-extrabold tracking-[0.25em]" aria-label={`Mã phòng ${room.code.split("").join(" ")}`}>{room.code}</p>
    <button type="button" className={btnSecondary} onClick={() => copy("code")}><Copy aria-hidden="true" className="size-5"/>Sao chép mã</button>
    <button type="button" className={btnSecondary} onClick={() => copy("link")}><Link2 aria-hidden="true" className="size-5"/>Sao chép đường dẫn</button>
   </div>
   <p role="status" aria-live="polite" className="mt-2 min-h-6 text-sm font-semibold text-primary">{copied}</p>
   {room.settings.locked && <p className="mt-2 flex items-center gap-2 font-semibold"><Lock aria-hidden="true" className="size-5"/>Phòng đã khóa, không nhận thêm người.</p>}
  </section>

  <section className={card} aria-labelledby="players-title">
   <h2 id="players-title" className="flex items-baseline justify-between gap-3 text-xl font-bold"><span>Người chơi</span><span className="text-base font-semibold text-navy-soft">{room.playerCount}/{room.settings.maxPlayers} người</span></h2>
   <PlayerList room={room}>{p => <>
    <StatusChip label={statusLabel(p, room.state)}/>
    {host && p.playerId !== room.me.playerId && <button type="button" className={`${btnSecondary} px-3`} aria-label={`Mời ra khỏi phòng: ${p.name}`} onClick={() => setKicking({ id: p.playerId, name: p.name })}><UserX aria-hidden="true" className="size-5"/><span className="max-sm:sr-only">Mời ra</span></button>}
   </>}</PlayerList>
   <p role="status" className="mt-3 font-semibold text-navy-soft">{host ? start.hint : "Đang chờ chủ phòng bấm Bắt đầu…"}</p>
  </section>

  {host && <section className={card} aria-labelledby="host-title">
   <h2 id="host-title" className="text-xl font-bold">Điều khiển của chủ phòng</h2>
   <div className="mt-3 grid gap-4 sm:grid-cols-2">
    <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" className="size-5 accent-primary" checked={room.settings.locked} disabled={act.pending} onChange={e => void act.run(() => client.settings(room.code, { locked: e.target.checked }))}/>Khóa phòng (không nhận thêm người)</label>
    <label className="block font-semibold">Giới hạn thời gian
     <select className="mt-1 block min-h-11 w-full rounded-xl border-2 border-navy/30 bg-white px-3" value={room.settings.timeLimitMinutes === null ? "" : String(room.settings.timeLimitMinutes)} disabled={act.pending} onChange={e => void act.run(() => client.settings(room.code, { timeLimitMinutes: e.target.value === "" ? null : (Number(e.target.value) as 15 | 30) }))}>
      {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
     </select>
    </label>
   </div>
   <div className="mt-4"><ErrorLine message={act.error}/></div>
   <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <button type="button" className={btnCta} disabled={!start.enabled || act.pending} onClick={() => void act.run(() => client.start(room.code))}><Play aria-hidden="true" className="size-5"/>Bắt đầu</button>
    <button ref={closeTrigger} type="button" className={btnSecondary} onClick={() => setConfirmClose(true)}><XCircle aria-hidden="true" className="size-5"/>Đóng phòng</button>
    <LeaveButton client={client} room={room}/>
   </div>
  </section>}
  {!host && <div className="flex flex-col gap-3 sm:flex-row"><LeaveButton client={client} room={room}/></div>}
  {!host && <ErrorLine message={act.error}/>}

  <ConfirmDialog open={confirmClose} title="Đóng phòng?" onClose={() => { setConfirmClose(false); closeTrigger.current?.focus(); }}>
   <p>Mọi người sẽ bị đưa ra khỏi phòng và phòng bị xóa.</p>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={btnSecondary} onClick={() => setConfirmClose(false)}>Giữ phòng</button><button type="button" className={btnCta} onClick={() => { setConfirmClose(false); void act.run(() => client.close(room.code)); }}>Đóng phòng</button></div>
  </ConfirmDialog>
  <ConfirmDialog open={kicking !== null} title="Mời bạn ra khỏi phòng?" onClose={() => setKicking(null)}>
   <p>{kicking?.name} sẽ bị đưa ra khỏi phòng này.</p>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={btnSecondary} onClick={() => setKicking(null)}>Hủy</button><button type="button" className={btnCta} onClick={() => { const id = kicking!.id; setKicking(null); void act.run(() => client.kick(room.code, id)); }}>Mời ra</button></div>
  </ConfirmDialog>
 </div>;
}
