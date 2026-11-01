"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, DoorOpen, WifiOff } from "lucide-react";
import { errorMessage } from "@/lib/rooms/messages";
import type { RoomsClient } from "@/lib/rooms/client";
import { roomsLandingPath } from "@/lib/routes";
import { leaveWarning, type StatusLabel } from "@/lib/rooms/lobby";
import type { RoomSnapshot } from "@/lib/rooms/types";

export const btnCta = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-5 py-2 font-bold text-navy motion-safe:transition-colors hover:bg-cta-hover disabled:bg-navy-soft disabled:text-surface";
export const btnSecondary = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-primary bg-surface px-4 py-2 font-bold text-primary motion-safe:transition-colors hover:bg-sky-soft disabled:border-navy-soft/30 disabled:text-navy-soft/60";
export const card = "rounded-2xl border-2 border-navy/20 bg-white p-5 shadow-sm sm:p-6";
export interface RoomScreenProps { client: RoomsClient; room: RoomSnapshot }

/** Runs one API action at a time and keeps a readable error for role="alert". */
export function useAction() {
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
  setPending(true); setError(null);
  try { return await fn(); }
  catch (e) { if (alive.current) setError(errorMessage(e)); return undefined; }
  finally { if (alive.current) setPending(false); }
 }, []);
 return { run, pending, error, clearError: () => setError(null) };
}
export function ErrorLine({ message }: { message: string | null }) {
 return <div role="alert" className="min-h-0">{message && <p className="flex items-start gap-2 rounded-xl border-2 border-red-700/40 bg-red-50 p-3 font-semibold text-red-800"><AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0"/>{message}</p>}</div>;
}

export function ConfirmDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
 const ref = useRef<HTMLDialogElement>(null);
 const titleId = `dlg-${title.replace(/\W+/g, "-")}`;
 useEffect(() => {
  const d = ref.current;
  if (!d) return;
  if (open && !d.open) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
  if (!open && d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
 }, [open]);
 return <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} className="m-auto max-h-[90dvh] w-[min(92vw,34rem)] overflow-y-auto rounded-2xl border-2 border-navy/30 bg-surface p-0 text-navy backdrop:bg-navy/50">
  {open && <div className="space-y-4 p-5 sm:p-6"><h2 id={titleId} className="text-xl font-extrabold">{title}</h2>{children}</div>}
 </dialog>;
}

export function StatusChip({ label }: { label: StatusLabel }) {
 const Icon = label.tone === "ok" ? CheckCircle2 : label.tone === "wait" ? Clock3 : WifiOff;
 const tone = label.tone === "ok" ? "bg-green-100 text-green-900" : label.tone === "wait" ? "bg-sky-soft text-primary" : "bg-navy/10 text-navy-soft";
 return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${tone}`}><Icon aria-hidden="true" className="size-4"/>{label.text}</span>;
}

/** Leaves the room (D7 rules spelled out first) and returns to the landing page. */
export function LeaveButton({ client, room, className = btnSecondary }: RoomScreenProps & { className?: string }) {
 const [open, setOpen] = useState(false);
 const router = useRouter();
 const { run, pending, error } = useAction();
 const trigger = useRef<HTMLButtonElement>(null);
 const leave = async () => {
  const ok = await run(async () => { await client.leave(room.code); return true; });
  if (ok) router.replace(roomsLandingPath());
 };
 return <>
  <button ref={trigger} type="button" className={className} onClick={() => setOpen(true)}><DoorOpen aria-hidden="true" className="size-5"/>Rời phòng</button>
  <ConfirmDialog open={open} title="Rời phòng?" onClose={() => { setOpen(false); trigger.current?.focus(); }}>
   <p>{leaveWarning(room)}</p>
   <ErrorLine message={error}/>
   <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Ở lại</button><button type="button" className={btnCta} disabled={pending} onClick={leave}>{pending ? "Đang rời…" : "Rời phòng"}</button></div>
  </ConfirmDialog>
 </>;
}

export function PlayerList({ room, children }: { room: RoomSnapshot; children?: (player: RoomSnapshot["players"][number]) => ReactNode }) {
 return <ul className="divide-y divide-navy/10" aria-label="Người chơi trong phòng">
  {room.players.filter(p => p.status !== "left").map(p => <li key={p.playerId} className={`flex min-h-14 flex-wrap items-center gap-2 py-2 ${p.connected ? "" : "text-navy-soft"}`}>
   <span className="min-w-0 flex-1 font-bold">{p.name}{p.playerId === room.me.playerId && <span className="ml-2 rounded-full bg-warm-2 px-2 py-0.5 text-sm">Bạn</span>}{p.isHost && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-sm text-surface">Chủ phòng</span>}</span>
   {children?.(p)}
  </li>)}
 </ul>;
}
