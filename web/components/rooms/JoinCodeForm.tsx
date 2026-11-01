"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { checkCodeInput, extractRoomCode } from "@/lib/rooms/form";
import { roomPath } from "@/lib/routes";
import { ctaCls, Field, inputCls } from "./fields";

/** Enter a 6-char code (or paste a room link); the room shell then asks for the display name. */
export function JoinCodeForm({ id = "vao-ma" }: { id?: string }) {
 const router = useRouter();
 const [value, setValue] = useState("");
 const [error, setError] = useState<string | null>(null);
 function submit(e: React.FormEvent) {
  e.preventDefault();
  const r = checkCodeInput(extractRoomCode(value));
  if ("error" in r) { setError(r.error); document.getElementById(id)?.focus(); return; }
  router.push(roomPath(r.code));
 }
 return <form onSubmit={submit} noValidate className="space-y-4">
  <Field id={id} label="Mã phòng hoặc đường dẫn" hint="Mã có 6 ký tự, không phân biệt hoa thường." error={error}>{a => <input {...a} className={`${inputCls} font-mono text-xl tracking-widest uppercase`} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={120} value={value} onChange={e => { setValue(e.target.value); setError(null); }}/>}</Field>
  <button type="submit" className={ctaCls}><DoorOpen aria-hidden="true" className="size-5"/>Vào phòng</button>
 </form>;
}
