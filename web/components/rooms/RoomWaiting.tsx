"use client";
import { Flag } from "lucide-react";
import { activePlayers } from "@/lib/rooms/lobby";
import { btnCta, card, ErrorLine, LeaveButton, useAction, type RoomScreenProps } from "./ui";

/** After submitting: only a count, never other players' answers or scores. */
export function RoomWaiting({ client, room }: RoomScreenProps) {
 const act = useAction();
 const total = activePlayers(room).length;
 return <section className={`${card} space-y-4`} data-slot="submitted" aria-labelledby="wait-title">
  <h1 id="wait-title" className="text-2xl font-extrabold">Em đã nộp bài!</h1>
  <p role="status" aria-live="polite" className="text-xl font-bold">Đã nộp: {room.submittedCount}/{total} người</p>
  <progress className="block h-3 w-full accent-primary" max={total} value={room.submittedCount} aria-label="Số người đã nộp"/>
  <p className="text-navy-soft">Kết quả sẽ hiện khi mọi người nộp xong hoặc hết giờ. Em không sửa được bài đã nộp.</p>
  <ErrorLine message={act.error}/>
  <div className="flex flex-col gap-3 sm:flex-row">
   {room.me.isHost && <button type="button" className={btnCta} disabled={act.pending} onClick={() => void act.run(() => client.finish(room.code))}><Flag aria-hidden="true" className="size-5"/>Kết thúc sớm</button>}
   <LeaveButton client={client} room={room}/>
  </div>
 </section>;
}
