"use client";
import { useRef, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { createRoomsClient, RoomsApiError } from "@/lib/rooms/client";
import { cleanName, describeRoomError, summarizeTest, validateName } from "@/lib/rooms/form";
import type { JoinResponse, PreviewResponse } from "@/lib/rooms/types";
import { ctaCls, Field, inputCls } from "./fields";

const BLOCKING = ["room_full", "room_not_joinable", "room_not_found"];

export function JoinNameForm({ code, preview, onJoined, onBlocked }: { code: string; preview: PreviewResponse | null; onJoined: (r: JoinResponse) => void; onBlocked: (e: unknown) => void }) {
 const client = useRef(createRoomsClient()).current;
 const [name, setName] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [formError, setFormError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (busy) return;
  const err = validateName(name);
  setFormError(null);
  if (err) { setError(err); document.getElementById("vao-ten")?.focus(); return; }
  setBusy(true);
  try { onJoined(await client.join(code, cleanName(name))); }
  catch (e2) {
   if (e2 instanceof RoomsApiError && BLOCKING.includes(e2.code)) { onBlocked(e2); return; }
   const d = describeRoomError(e2);
   setBusy(false);
   if (d.field === "name") { setError(d.message); document.getElementById("vao-ten")?.focus(); } else setFormError(d.message);
  }
 }
 return <section aria-labelledby="vao-heading" className="mx-auto max-w-xl rounded-2xl border-2 border-navy/20 bg-white p-6 shadow-sm sm:p-8">
  <h1 id="vao-heading" className="text-2xl font-extrabold">Vào phòng</h1>
  <p className="mt-3 flex flex-wrap items-center gap-2"><span className="text-navy-soft">Mã phòng</span><span className="rounded-lg bg-sky-soft px-3 py-1 font-mono text-xl font-bold tracking-widest" aria-label={`Mã phòng ${[...code].join(" ")}`}>{code}</span></p>
  {preview && <div className="mt-3 rounded-xl border-2 border-navy/20 bg-sky-soft p-3" data-slot="room-summary">
   <p className="font-semibold">{summarizeTest(preview.test)}</p>
   <p className="flex items-center gap-1.5 text-navy-soft"><Users aria-hidden="true" className="size-4"/>{preview.playerCount}/{preview.maxPlayers} người</p>
  </div>}
  <form onSubmit={submit} noValidate className="mt-5 space-y-4">
   <Field id="vao-ten" label="Tên hiển thị" hint="Biệt danh 2–20 ký tự; tránh tên thật, số điện thoại." error={error}>{a => <input {...a} className={inputCls} maxLength={40} autoComplete="off" value={name} onChange={e => { setName(e.target.value); setError(null); }}/>}</Field>
   <div role="alert" className={formError ? "rounded-xl border-2 border-red-700 bg-red-50 p-3 font-semibold text-red-700" : "sr-only"}>{formError}</div>
   <button type="submit" className={ctaCls} disabled={busy}>{busy ? <><Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none"/>Đang vào phòng…</> : "Vào phòng"}</button>
  </form>
  <p className="mt-4 text-sm text-navy-soft">Không cần tài khoản. Tên chỉ tồn tại trong phòng này.</p>
 </section>;
}
