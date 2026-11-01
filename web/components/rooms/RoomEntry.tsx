"use client";
import { DoorOpen, PlusCircle } from "lucide-react";
import type { RoomCatalog } from "@/lib/rooms/form";
import { CreateRoomForm } from "./CreateRoomForm";
import { JoinCodeForm } from "./JoinCodeForm";

export function RoomEntry({ catalog }: { catalog: RoomCatalog }) {
 const card = "rounded-2xl border-2 border-navy/20 bg-white p-5 shadow-sm sm:p-6";
 return <div id="tao-phong" data-slot="room-entry" className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
  <section aria-labelledby="tao-phong-heading" className={card}>
   <h2 id="tao-phong-heading" className="mb-4 flex items-center gap-2 text-xl font-bold"><PlusCircle aria-hidden="true" className="size-6 text-primary"/>Tạo phòng</h2>
   <CreateRoomForm catalog={catalog}/>
  </section>
  <section id="vao-phong" aria-labelledby="vao-phong-heading" className={card}>
   <h2 id="vao-phong-heading" className="mb-4 flex items-center gap-2 text-xl font-bold"><DoorOpen aria-hidden="true" className="size-6 text-primary"/>Vào phòng bằng mã</h2>
   <JoinCodeForm/>
  </section>
 </div>;
}
